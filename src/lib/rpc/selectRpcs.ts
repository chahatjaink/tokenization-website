import { IdentityReadError } from "@/domain/errors";
import { isPublicHttpsUrl } from "@/lib/rpc/urls";

type ChainlistRpc = {
  url?: unknown;
  tracking?: unknown;
};

const TRACK_RANK: Record<string, number> = {
  none: 0,
  limited: 1,
};

export function selectRpcs(payload: unknown, chainId = 1, chainName = "Ethereum"): string[] {
  if (!Array.isArray(payload)) {
    throw new IdentityReadError(
      "RPC_DIRECTORY_UNAVAILABLE",
      "Chainlist returned an unexpected payload.",
    );
  }

  const chain = payload.find(
    (entry) =>
      isRecord(entry) &&
      entry.chainId === chainId &&
      entry.isTestnet !== true &&
      Array.isArray(entry.rpc),
  );

  if (!chain || !isRecord(chain) || !Array.isArray(chain.rpc)) {
    throw new IdentityReadError(
      "RPC_DIRECTORY_UNAVAILABLE",
      `Chainlist has no ${chainName} entry.`,
    );
  }

  const ranked: { url: string; rank: number; index: number }[] = [];
  chain.rpc.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const rpc = entry as ChainlistRpc;
    if (typeof rpc.url !== "string" || typeof rpc.tracking !== "string") return;
    const rank = TRACK_RANK[rpc.tracking];
    if (rank === undefined) return;
    if (!isPublicHttpsUrl(rpc.url)) return;
    ranked.push({ url: rpc.url, rank, index });
  });

  ranked.sort((left, right) => left.rank - right.rank || left.index - right.index);

  const urls: string[] = [];
  for (const entry of ranked) {
    if (!urls.includes(entry.url)) urls.push(entry.url);
  }

  if (urls.length === 0) {
    throw new IdentityReadError(
      "RPC_DIRECTORY_UNAVAILABLE",
      `Chainlist has no usable ${chainName} RPC URLs.`,
    );
  }

  return urls;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
