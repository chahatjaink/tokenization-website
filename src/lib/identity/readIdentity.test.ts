import { getAddress, zeroAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { bnb, ethereum } from "@/config/chains";
import { IdentityReadError } from "@/domain/errors";
import { readIdentity } from "@/lib/identity/readIdentity";
import type { ContractCall, IdentityRpc } from "@/lib/identity/rpc";
import { ContractReadRevert } from "@/lib/identity/revert";

const wallet = getAddress("0x0000000000000000000000000000000000000001");
const token = getAddress("0x0000000000000000000000000000000000000002");
const registry = getAddress("0x0000000000000000000000000000000000000003");
const onchainId = getAddress("0x0000000000000000000000000000000000000004");
const otherId = getAddress("0x0000000000000000000000000000000000000005");
const ctr = getAddress("0x0000000000000000000000000000000000000006");
const tir = getAddress("0x0000000000000000000000000000000000000007");
const issuer = getAddress("0x0000000000000000000000000000000000000008");
const issuerTwo = getAddress("0x0000000000000000000000000000000000000009");
const claimA = `0x${"ab".repeat(32)}` as Hex;
const claimB = `0x${"cd".repeat(32)}` as Hex;

class FakeRpc implements IdentityRpc {
  calls: string[] = [];
  code = new Map<string, Hex>();
  private handlers = new Map<string, (args: readonly unknown[]) => unknown>();

  on(address: string, functionName: string, handler: (args: readonly unknown[]) => unknown) {
    this.handlers.set(`${address.toLowerCase()}:${functionName}`, handler);
  }

  set(address: string, functionName: string, value: unknown) {
    this.on(address, functionName, () => value);
  }

  async getBlockNumber() {
    this.calls.push("block");
    return 18_000_000n;
  }

  async getCode(address: Address) {
    this.calls.push(`code:${address.toLowerCase()}`);
    return this.code.get(address.toLowerCase()) ?? "0x01";
  }

  async readContract(call: ContractCall) {
    const key = `${call.address.toLowerCase()}:${call.functionName}`;
    this.calls.push(key);
    const handler = this.handlers.get(key);
    if (!handler) throw new ContractReadRevert(call.functionName);
    const result = handler(call.args ?? []);
    if (result instanceof Error) throw result;
    return result;
  }
}

function claim(topic: bigint, claimIssuer: Address, data: Hex = "0x22") {
  return {
    topic,
    scheme: 1n,
    issuer: claimIssuer,
    signature: "0x11",
    data,
    uri: "https://example.test/claim",
  };
}

function prime(rpc: FakeRpc) {
  rpc.set(token, "name", "Example Token");
  rpc.set(token, "symbol", "EXT");
  rpc.set(token, "identityRegistry", registry);
  rpc.set(registry, "identity", onchainId);
  rpc.set(registry, "contains", true);
  rpc.set(registry, "isVerified", true);
  rpc.set(registry, "investorCountry", 840);
  rpc.set(registry, "topicsRegistry", ctr);
  rpc.set(registry, "issuersRegistry", tir);
  rpc.set(ethereum.idFactory, "getIdentity", onchainId);
  rpc.set(ethereum.idFactory, "getWallets", [wallet]);
  rpc.set(ctr, "getClaimTopics", [1n]);
  rpc.set(tir, "getTrustedIssuers", [issuer]);
  rpc.set(tir, "getTrustedIssuerClaimTopics", [1n]);
  rpc.on(onchainId, "getClaimIdsByTopic", () => [claimA]);
  rpc.on(onchainId, "getClaim", () => claim(1n, issuer));
  rpc.on(tir, "hasClaimTopic", () => true);
  rpc.on(issuer, "isClaimValid", () => true);
  return rpc;
}

describe("readIdentity", () => {
  it("rejects an unsupported chain before any RPC call", async () => {
    const rpc = prime(new FakeRpc());
    await expect(readIdentity({ chainId: 10, wallet, token }, { rpc })).rejects.toMatchObject({
      code: "UNSUPPORTED_CHAIN",
    });
    expect(rpc.calls).toEqual([]);
  });

  it("rejects an invalid wallet before any RPC call", async () => {
    const rpc = prime(new FakeRpc());
    await expect(readIdentity({ chainId: 1, wallet: "0xnope", token }, { rpc })).rejects.toMatchObject({
      code: "INVALID_ADDRESS",
    });
    expect(rpc.calls).toEqual([]);
  });

  it("reads a registered wallet and decodes a trusted claim", async () => {
    const rpc = prime(new FakeRpc());
    const view = await readIdentity(
      { chainId: 1, wallet, token },
      { rpc, chain: { ...ethereum, topicLabels: { "1": "KYC" } } },
    );
    expect(view).toMatchObject({
      chainId: 1,
      blockNumber: "18000000",
      wallet,
      contains: true,
      isVerified: true,
      verificationNote: "protocol",
      investorCountry: 840,
      registryIdentity: onchainId,
      factoryIdentity: onchainId,
      factoryStatus: "ok",
      identityMismatch: false,
      truncated: false,
      context: { kind: "token", registry, token: { address: token, name: "Example Token", symbol: "EXT" } },
    });
    expect(view.requiredTopics).toEqual([{ topic: "1", label: "KYC" }]);
    expect(view.claims).toEqual([
      expect.objectContaining({
        topic: "1",
        label: "KYC",
        scheme: "ECDSA",
        issuer,
        trusted: true,
        validity: "valid",
        uri: "https://example.test/claim",
      }),
    ]);
    expect(view.linkedWallets).toEqual([wallet]);
  });

  it("flags a factory and registry mismatch and reads claims from the registry identity", async () => {
    const rpc = prime(new FakeRpc());
    rpc.set(ethereum.idFactory, "getIdentity", otherId);
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.identityMismatch).toBe(true);
    expect(view.registryIdentity).toBe(onchainId);
    expect(view.factoryIdentity).toBe(otherId);
    expect(rpc.calls).toContain(`${onchainId.toLowerCase()}:getClaimIdsByTopic`);
    expect(rpc.calls.some((entry) => entry.startsWith(`${otherId.toLowerCase()}:getClaim`))).toBe(false);
  });

  it("shows factory claims when the wallet is not registered", async () => {
    const rpc = prime(new FakeRpc());
    rpc.set(registry, "identity", zeroAddress);
    rpc.set(registry, "contains", false);
    rpc.set(registry, "isVerified", false);
    rpc.set(ethereum.idFactory, "getIdentity", otherId);
    rpc.on(otherId, "getClaimIdsByTopic", () => [claimA]);
    rpc.on(otherId, "getClaim", () => claim(1n, issuer));
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.registryIdentity).toBeNull();
    expect(view.factoryIdentity).toBe(otherId);
    expect(view.verificationNote).toBe("not-registered");
    expect(view.claims).toHaveLength(1);
  });

  it("returns null identities when neither source has one", async () => {
    const rpc = prime(new FakeRpc());
    rpc.set(registry, "identity", zeroAddress);
    rpc.set(registry, "contains", false);
    rpc.set(registry, "isVerified", false);
    rpc.set(ethereum.idFactory, "getIdentity", zeroAddress);
    rpc.set(ctr, "getClaimTopics", []);
    rpc.set(tir, "getTrustedIssuers", []);
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.registryIdentity).toBeNull();
    expect(view.factoryIdentity).toBeNull();
    expect(view.claims).toEqual([]);
    expect(view.verificationNote).toBe("not-registered");
    expect(rpc.calls.some((entry) => entry.endsWith(":getClaim") || entry.endsWith(":getClaimIdsByTopic"))).toBe(
      false,
    );
  });

  it("marks an empty topic list as no claims required and still reads issuer topics", async () => {
    const rpc = prime(new FakeRpc());
    rpc.set(ctr, "getClaimTopics", []);
    rpc.set(tir, "getTrustedIssuerClaimTopics", [7n]);
    rpc.on(onchainId, "getClaimIdsByTopic", (args) => (args[0] === 7n ? [claimA] : []));
    rpc.on(onchainId, "getClaim", () => claim(7n, issuer));
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.verificationNote).toBe("no-claims-required");
    expect(view.requiredTopics).toEqual([]);
    expect(view.claims.map((entry) => entry.topic)).toEqual(["7"]);
  });

  it("drops claims whose topic is zero", async () => {
    const rpc = prime(new FakeRpc());
    rpc.on(onchainId, "getClaimIdsByTopic", () => [claimA, claimB]);
    rpc.on(onchainId, "getClaim", (args) => (args[0] === claimA ? claim(0n, issuer) : claim(1n, issuer)));
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.claims).toHaveLength(1);
    expect(view.claims[0]?.claimId).toBe(claimB);
  });

  it("keeps a sibling claim when one issuer cannot be verified", async () => {
    const rpc = prime(new FakeRpc());
    rpc.set(tir, "getTrustedIssuers", [issuer, issuerTwo]);
    rpc.on(onchainId, "getClaimIdsByTopic", () => [claimA, claimB]);
    rpc.on(onchainId, "getClaim", (args) =>
      args[0] === claimA ? claim(1n, issuer, "0xa1") : claim(1n, issuerTwo, "0xb2"),
    );
    rpc.on(issuerTwo, "isClaimValid", () => {
      throw new ContractReadRevert("isClaimValid");
    });
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.claims.map((entry) => entry.validity)).toEqual(["valid", "unverifiable"]);
  });

  it("marks a signed claim untrusted when the registry does not trust the issuer", async () => {
    const rpc = prime(new FakeRpc());
    rpc.on(tir, "hasClaimTopic", () => false);
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.claims[0]).toMatchObject({ trusted: false, validity: "valid" });
  });

  it("throws when the token address has no code", async () => {
    const rpc = prime(new FakeRpc());
    rpc.code.set(token.toLowerCase(), "0x");
    await expect(readIdentity({ chainId: 1, wallet, token }, { rpc })).rejects.toMatchObject({
      code: "CONTEXT_NOT_A_CONTRACT",
    });
    expect(rpc.calls.some((entry) => entry.endsWith(":identityRegistry"))).toBe(false);
  });

  it("treats all-zero bytecode as no contract", async () => {
    const rpc = prime(new FakeRpc());
    rpc.code.set(token.toLowerCase(), "0x00");
    await expect(readIdentity({ chainId: 1, wallet, token }, { rpc })).rejects.toMatchObject({
      code: "CONTEXT_NOT_A_CONTRACT",
    });
  });

  it("throws when a required view reverts", async () => {
    const rpc = prime(new FakeRpc());
    rpc.on(registry, "identity", () => {
      throw new ContractReadRevert("identity");
    });
    await expect(readIdentity({ chainId: 1, wallet, token }, { rpc })).rejects.toMatchObject({
      code: "CONTRACT_REVERT",
    });
  });

  it("reads a BNB registry without an ONCHAINID factory", async () => {
    const rpc = prime(new FakeRpc());
    const view = await readIdentity({ chainId: 56, wallet, token }, { rpc, chain: bnb });
    expect(view.chainId).toBe(56);
    expect(view.factoryStatus).toBe("not-configured");
    expect(view.factoryIdentity).toBeNull();
    expect(view.isVerified).toBe(true);
    expect(rpc.calls.some((entry) => entry.includes("getIdentity"))).toBe(false);
  });

  it("throws when the factory has no bytecode", async () => {
    const rpc = prime(new FakeRpc());
    rpc.code.set(ethereum.idFactory.toLowerCase(), "0x");
    await expect(readIdentity({ chainId: 1, wallet, token }, { rpc })).rejects.toMatchObject({
      code: "FACTORY_NOT_DEPLOYED",
    });
  });

  it("propagates a total RPC failure", async () => {
    const rpc = prime(new FakeRpc());
    rpc.getBlockNumber = async () => {
      throw new IdentityReadError("RPC_UNAVAILABLE");
    };
    await expect(readIdentity({ chainId: 1, wallet, token }, { rpc })).rejects.toMatchObject({
      code: "RPC_UNAVAILABLE",
    });
  });

  it("leaves token metadata empty when name and symbol revert", async () => {
    const rpc = prime(new FakeRpc());
    rpc.on(token, "name", () => {
      throw new ContractReadRevert("name");
    });
    rpc.on(token, "symbol", () => {
      throw new ContractReadRevert("symbol");
    });
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.context.token).toMatchObject({ name: null, symbol: null });
  });

  it("reports linked wallets as unavailable when getWallets reverts", async () => {
    const rpc = prime(new FakeRpc());
    rpc.on(ethereum.idFactory, "getWallets", () => {
      throw new ContractReadRevert("getWallets");
    });
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.linkedWallets).toBeNull();
    expect(view.claims).toHaveLength(1);
  });

  it("uses a pasted registry without calling a token", async () => {
    const rpc = prime(new FakeRpc());
    const view = await readIdentity({ chainId: 1, wallet, registry }, { rpc });
    expect(view.context).toMatchObject({ kind: "registry", token: null, registry });
    expect(rpc.calls.some((entry) => entry.endsWith(":identityRegistry"))).toBe(false);
  });

  it("prefers a token when both context addresses are present", async () => {
    const rpc = prime(new FakeRpc());
    const otherRegistry = getAddress("0x00000000000000000000000000000000000000aa");
    const view = await readIdentity({ chainId: 1, wallet, token, registry: otherRegistry }, { rpc });
    expect(view.context.registry).toBe(registry);
  });

  it("caps a long required topic list", async () => {
    const rpc = prime(new FakeRpc());
    rpc.set(ctr, "getClaimTopics", Array.from({ length: 33 }, (_, index) => BigInt(index + 1)));
    rpc.set(tir, "getTrustedIssuers", []);
    rpc.on(onchainId, "getClaimIdsByTopic", () => []);
    const view = await readIdentity({ chainId: 1, wallet, token }, { rpc });
    expect(view.truncated).toBe(true);
    expect(view.requiredTopics).toHaveLength(32);
  });
});
