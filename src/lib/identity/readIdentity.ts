import { getAddress, isAddress, zeroAddress, type Abi, type Address, type Hex } from "viem";
import {
  claimIssuerAbi,
  claimTopicsRegistryAbi,
  idFactoryAbi,
  identityAbi,
  identityRegistryAbi,
  tokenAbi,
  trustedIssuersRegistryAbi,
} from "@/abi/identity";
import { ethereum, getChain, type ChainDefinition } from "@/config/chains";
import { IdentityReadError } from "@/domain/errors";
import { validateIdentityQuery } from "@/lib/identity/query";
import { isEmptyCode, type ContractCall, type IdentityRpc } from "@/lib/identity/rpc";
import type {
  ClaimRow,
  ClaimValidity,
  FactoryStatus,
  IdentityQuery,
  IdentityView,
  VerificationNote,
} from "@/lib/identity/types";

const MAX_TOPICS = 32;
const MAX_CLAIMS = 64;
const MAX_ISSUERS = 50;

type ReadDeps = {
  rpc: IdentityRpc;
  chain?: ChainDefinition;
};

export async function readIdentity(query: IdentityQuery, deps: ReadDeps): Promise<IdentityView> {
  const validated = validateIdentityQuery(query);
  const chain: ChainDefinition =
    deps.chain?.id === validated.chainId ? deps.chain : (getChain(validated.chainId) ?? ethereum);
  const rpc = deps.rpc;
  const blockNumber = await rpc.getBlockNumber();
  const factoryAddress = chain.idFactory;

  const [context, factoryCode] = await Promise.all([
    resolveContext(rpc, blockNumber, validated),
    factoryAddress ? rpc.getCode(factoryAddress, blockNumber) : Promise.resolve("0x" as Hex),
  ]);

  if (factoryAddress && isEmptyCode(factoryCode)) {
    throw new IdentityReadError("FACTORY_NOT_DEPLOYED");
  }

  const registry = context.registry;
  const [registryIdentityRaw, contains, isVerified, country, topicsRegistry, issuersRegistry, factory] =
    await Promise.all([
      readRequired("identity", () => readAddress(rpc, blockNumber, registry, identityRegistryAbi, "identity", [validated.wallet])),
      readRequired("contains", () => readBool(rpc, blockNumber, registry, identityRegistryAbi, "contains", [validated.wallet])),
      readRequired("isVerified", () => readBool(rpc, blockNumber, registry, identityRegistryAbi, "isVerified", [validated.wallet])),
      readRequired("investorCountry", () => readUint(rpc, blockNumber, registry, identityRegistryAbi, "investorCountry", [validated.wallet])),
      readRequired("topicsRegistry", () => readAddress(rpc, blockNumber, registry, identityRegistryAbi, "topicsRegistry")),
      readRequired("issuersRegistry", () => readAddress(rpc, blockNumber, registry, identityRegistryAbi, "issuersRegistry")),
      factoryAddress
        ? readFactoryIdentity(rpc, blockNumber, factoryAddress, validated.wallet)
        : Promise.resolve({ status: "not-configured" as const, address: null }),
    ]);

  const registryIdentity = isZero(registryIdentityRaw) ? null : registryIdentityRaw;
  let factoryIdentity = factory.address;
  let factoryStatus: FactoryStatus = factory.status;

  if (isZero(topicsRegistry) || isZero(issuersRegistry)) {
    throw new IdentityReadError("CONTRACT_REVERT", "The identity registry returned a zero registry address.");
  }

  const [topicsCode, issuersCode] = await Promise.all([
    rpc.getCode(topicsRegistry, blockNumber),
    rpc.getCode(issuersRegistry, blockNumber),
  ]);
  if (isEmptyCode(topicsCode) || isEmptyCode(issuersCode)) {
    throw new IdentityReadError("CONTRACT_REVERT", "A linked registry has no bytecode.");
  }

  const [requiredRaw, issuersRaw] = await Promise.all([
    readRequired("getClaimTopics", () =>
      readUintList(rpc, blockNumber, topicsRegistry, claimTopicsRegistryAbi, "getClaimTopics"),
    ),
    readRequired("getTrustedIssuers", () =>
      readAddressList(rpc, blockNumber, issuersRegistry, trustedIssuersRegistryAbi, "getTrustedIssuers"),
    ),
  ]);

  let truncated = requiredRaw.length > MAX_TOPICS || issuersRaw.length > MAX_ISSUERS;
  const requiredTopics = requiredRaw.slice(0, MAX_TOPICS);
  const issuers = issuersRaw.filter((issuer) => !isZero(issuer)).slice(0, MAX_ISSUERS);

  const extraTopicLists = await Promise.all(
    issuers.map(async (issuer) => {
      try {
        return await readUintList(
          rpc,
          blockNumber,
          issuersRegistry,
          trustedIssuersRegistryAbi,
          "getTrustedIssuerClaimTopics",
          [issuer],
        );
      } catch (error) {
        if (error instanceof IdentityReadError) throw error;
        return [];
      }
    }),
  );

  const topicOrder: bigint[] = [];
  const seenTopics = new Set<string>();
  const pushTopic = (topic: bigint) => {
    const key = topic.toString();
    if (seenTopics.has(key)) return;
    if (topicOrder.length >= MAX_TOPICS) {
      truncated = true;
      return;
    }
    seenTopics.add(key);
    topicOrder.push(topic);
  };
  for (const topic of requiredTopics) pushTopic(topic);
  for (const list of extraTopicLists) {
    for (const topic of list) pushTopic(topic);
  }

  const subject = await resolveSubject(rpc, blockNumber, registryIdentity, factoryIdentity);
  if (subject.dropFactory) {
    factoryIdentity = null;
    factoryStatus = "unavailable";
  }

  const claims = subject.address
    ? await loadClaims({
        rpc,
        blockNumber,
        identity: subject.address,
        topics: topicOrder,
        issuersRegistry,
        labels: chain.topicLabels,
        onTruncate: () => {
          truncated = true;
        },
      })
    : [];

  const linkedWallets =
    factoryStatus === "ok" && subject.address && factoryAddress
      ? await readLinkedWallets(rpc, blockNumber, factoryAddress, subject.address)
      : null;

  return {
    chainId: validated.chainId,
    blockNumber: blockNumber.toString(),
    wallet: validated.wallet,
    context: {
      kind: context.kind,
      token: context.token,
      registry,
    },
    contains,
    isVerified,
    verificationNote: verificationNote(contains, registryIdentity, requiredTopics.length),
    investorCountry: Number(country),
    registryIdentity,
    factoryIdentity,
    factoryStatus,
    identityMismatch: Boolean(
      registryIdentity && factoryIdentity && registryIdentity.toLowerCase() !== factoryIdentity.toLowerCase(),
    ),
    requiredTopics: requiredTopics.map((topic) => ({
      topic: topic.toString(),
      label: chain.topicLabels[topic.toString()] ?? null,
    })),
    claims,
    linkedWallets,
    truncated,
  };
}

async function resolveContext(
  rpc: IdentityRpc,
  blockNumber: bigint,
  query: { token?: Address; registry?: Address },
): Promise<IdentityView["context"]> {
  if (query.registry && !query.token) {
    const code = await rpc.getCode(query.registry, blockNumber);
    if (isEmptyCode(code)) throw new IdentityReadError("CONTEXT_NOT_A_CONTRACT");
    return { kind: "registry", token: null, registry: query.registry };
  }

  const token = query.token;
  if (!token) throw new IdentityReadError("MISSING_CONTEXT");
  const code = await rpc.getCode(token, blockNumber);
  if (isEmptyCode(code)) throw new IdentityReadError("CONTEXT_NOT_A_CONTRACT");

  const [name, symbol, registry] = await Promise.all([
    readOptional(() => readString(rpc, blockNumber, token, tokenAbi, "name")),
    readOptional(() => readString(rpc, blockNumber, token, tokenAbi, "symbol")),
    readRequired("identityRegistry", () => readAddress(rpc, blockNumber, token, tokenAbi, "identityRegistry")),
  ]);

  if (isZero(registry)) {
    throw new IdentityReadError("CONTRACT_REVERT", "identityRegistry() returned the zero address.");
  }
  const registryCode = await rpc.getCode(registry, blockNumber);
  if (isEmptyCode(registryCode)) {
    throw new IdentityReadError("CONTRACT_REVERT", "identityRegistry() did not point at a contract.");
  }

  return {
    kind: "token",
    token: { address: token, name, symbol },
    registry,
  };
}

async function readFactoryIdentity(
  rpc: IdentityRpc,
  blockNumber: bigint,
  factory: Address,
  wallet: Address,
): Promise<{ status: FactoryStatus; address: Address | null }> {
  try {
    const address = await readAddress(rpc, blockNumber, factory, idFactoryAbi, "getIdentity", [wallet]);
    return { status: "ok", address: isZero(address) ? null : address };
  } catch (error) {
    if (error instanceof IdentityReadError) throw error;
    return { status: "unavailable", address: null };
  }
}

async function resolveSubject(
  rpc: IdentityRpc,
  blockNumber: bigint,
  registryIdentity: Address | null,
  factoryIdentity: Address | null,
): Promise<{ address: Address | null; dropFactory: boolean }> {
  const candidate = registryIdentity ?? factoryIdentity;
  if (!candidate) return { address: null, dropFactory: false };
  const code = await rpc.getCode(candidate, blockNumber);
  if (!isEmptyCode(code)) return { address: candidate, dropFactory: false };
  if (registryIdentity) {
    throw new IdentityReadError("CONTRACT_REVERT", "Registered identity has no bytecode.");
  }
  return { address: null, dropFactory: true };
}

async function loadClaims(input: {
  rpc: IdentityRpc;
  blockNumber: bigint;
  identity: Address;
  topics: bigint[];
  issuersRegistry: Address;
  labels: Record<string, string>;
  onTruncate: () => void;
}): Promise<ClaimRow[]> {
  const idLists = await Promise.all(
    input.topics.map((topic) =>
      readRequired(`getClaimIdsByTopic(${topic})`, () =>
        readHexList(input.rpc, input.blockNumber, input.identity, identityAbi, "getClaimIdsByTopic", [topic]),
      ),
    ),
  );

  const ids: Hex[] = [];
  const seen = new Set<string>();
  for (const list of idLists) {
    for (const id of list) {
      const key = id.toLowerCase();
      if (seen.has(key)) continue;
      if (ids.length >= MAX_CLAIMS) {
        input.onTruncate();
        break;
      }
      seen.add(key);
      ids.push(id);
    }
  }

  const fetched = await Promise.all(
    ids.map(async (id) => {
      try {
        const raw = await input.rpc.readContract(
          call(input.identity, identityAbi, "getClaim", [id]),
          input.blockNumber,
        );
        const claim = normalizeClaim(raw);
        if (!claim || claim.topic === 0n) return null;
        return { id, claim };
      } catch (error) {
        if (error instanceof IdentityReadError) throw error;
        return null;
      }
    }),
  );

  const present = fetched.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return Promise.all(
    present.map(async ({ id, claim }) => {
      if (isZero(claim.issuer)) {
        return toRow(id, claim, false, "unverifiable", input.labels);
      }

      const trusted = await readRequired("hasClaimTopic", () =>
        readBool(input.rpc, input.blockNumber, input.issuersRegistry, trustedIssuersRegistryAbi, "hasClaimTopic", [
          claim.issuer,
          claim.topic,
        ]),
      );

      let validity: ClaimValidity;
      try {
        const valid = await readBool(
          input.rpc,
          input.blockNumber,
          claim.issuer,
          claimIssuerAbi,
          "isClaimValid",
          [input.identity, claim.topic, claim.signature, claim.data],
        );
        validity = valid ? "valid" : "invalid";
      } catch (error) {
        if (error instanceof IdentityReadError) throw error;
        validity = "unverifiable";
      }

      return toRow(id, claim, trusted, validity, input.labels);
    }),
  );
}

async function readLinkedWallets(
  rpc: IdentityRpc,
  blockNumber: bigint,
  factory: Address,
  identity: Address,
): Promise<Address[] | null> {
  try {
    return await readAddressList(rpc, blockNumber, factory, idFactoryAbi, "getWallets", [identity]);
  } catch (error) {
    if (error instanceof IdentityReadError) throw error;
    return null;
  }
}

function toRow(
  id: Hex,
  claim: NormalizedClaim,
  trusted: boolean,
  validity: ClaimValidity,
  labels: Record<string, string>,
): ClaimRow {
  const topic = claim.topic.toString();
  return {
    claimId: id,
    topic,
    label: labels[topic] ?? null,
    scheme: schemeLabel(claim.scheme),
    issuer: claim.issuer,
    trusted,
    validity,
    data: claim.data,
    uri: claim.uri,
  };
}

function verificationNote(
  contains: boolean,
  registryIdentity: Address | null,
  requiredCount: number,
): VerificationNote {
  if (!contains || !registryIdentity) return "not-registered";
  if (requiredCount === 0) return "no-claims-required";
  return "protocol";
}

function schemeLabel(scheme: bigint): string {
  if (scheme === 1n) return "ECDSA";
  if (scheme === 2n) return "RSA";
  return `scheme ${scheme.toString()}`;
}

type NormalizedClaim = {
  topic: bigint;
  scheme: bigint;
  issuer: Address;
  signature: Hex;
  data: Hex;
  uri: string;
};

function normalizeClaim(value: unknown): NormalizedClaim | null {
  const source = Array.isArray(value) ? arrayClaim(value) : recordClaim(value);
  if (!source) return null;
  if (!isAddress(source.issuer)) return null;
  return {
    topic: source.topic,
    scheme: source.scheme,
    issuer: getAddress(source.issuer),
    signature: source.signature,
    data: source.data,
    uri: source.uri,
  };
}

function arrayClaim(value: unknown[]): NormalizedClaim | null {
  if (value.length < 6) return null;
  const topic = asUint(value[0]);
  const scheme = asUint(value[1]);
  if (topic === null || scheme === null || typeof value[2] !== "string") return null;
  if (typeof value[3] !== "string" || typeof value[4] !== "string") return null;
  return {
    topic,
    scheme,
    issuer: value[2] as Address,
    signature: value[3] as Hex,
    data: value[4] as Hex,
    uri: typeof value[5] === "string" ? value[5] : "",
  };
}

function recordClaim(value: unknown): NormalizedClaim | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const topic = asUint(record.topic);
  const scheme = asUint(record.scheme);
  if (topic === null || scheme === null || typeof record.issuer !== "string") return null;
  if (typeof record.signature !== "string" || typeof record.data !== "string") return null;
  return {
    topic,
    scheme,
    issuer: record.issuer as Address,
    signature: record.signature as Hex,
    data: record.data as Hex,
    uri: typeof record.uri === "string" ? record.uri : "",
  };
}

function asUint(value: unknown): bigint | null {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return BigInt(value);
  return null;
}

async function readRequired<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof IdentityReadError) throw error;
    const reason = error instanceof Error ? error.message : label;
    throw new IdentityReadError("CONTRACT_REVERT", `${label} reverted.`, { cause: error instanceof Error ? error : reason });
  }
}

async function readOptional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof IdentityReadError) throw error;
    return null;
  }
}

function call(
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): ContractCall {
  return { address, abi, functionName, args };
}

async function readAddress(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): Promise<Address> {
  const value = await rpc.readContract(call(address, abi, functionName, args), blockNumber);
  if (typeof value !== "string" || !isAddress(value)) {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-address.`);
  }
  return getAddress(value);
}

async function readBool(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): Promise<boolean> {
  const value = await rpc.readContract(call(address, abi, functionName, args), blockNumber);
  if (typeof value !== "boolean") {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-boolean.`);
  }
  return value;
}

async function readUint(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): Promise<bigint> {
  const value = await rpc.readContract(call(address, abi, functionName, args), blockNumber);
  const parsed = asUint(value);
  if (parsed === null) {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-numeric value.`);
  }
  return parsed;
}

async function readString(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
): Promise<string> {
  const value = await rpc.readContract(call(address, abi, functionName), blockNumber);
  if (typeof value !== "string") {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-string.`);
  }
  return value;
}

async function readUintList(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): Promise<bigint[]> {
  const value = await rpc.readContract(call(address, abi, functionName, args), blockNumber);
  if (!Array.isArray(value)) {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-array.`);
  }
  return value.map((entry) => {
    const parsed = asUint(entry);
    if (parsed === null) {
      throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-numeric value.`);
    }
    return parsed;
  });
}

async function readAddressList(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): Promise<Address[]> {
  const value = await rpc.readContract(call(address, abi, functionName, args), blockNumber);
  if (!Array.isArray(value)) {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-array.`);
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || !isAddress(entry)) {
      throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-address.`);
    }
    return getAddress(entry);
  });
}

async function readHexList(
  rpc: IdentityRpc,
  blockNumber: bigint,
  address: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
): Promise<Hex[]> {
  const value = await rpc.readContract(call(address, abi, functionName, args), blockNumber);
  if (!Array.isArray(value)) {
    throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-array.`);
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(entry)) {
      throw new IdentityReadError("CONTRACT_REVERT", `${functionName}() returned a non-bytes32.`);
    }
    return entry as Hex;
  });
}

function isZero(address: Address): boolean {
  return address.toLowerCase() === zeroAddress;
}
