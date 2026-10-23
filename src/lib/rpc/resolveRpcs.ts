import { getChain, type SupportedChainId } from "@/config/chains";
import { IdentityReadError } from "@/domain/errors";
import { probeRpcs } from "@/lib/rpc/probeRpcs";
import { selectRpcs } from "@/lib/rpc/selectRpcs";
import { isPublicHttpsUrl } from "@/lib/rpc/urls";

export const CHAINLIST_URL = "https://chainlist.org/rpcs.json";
const DEFAULT_TTL_MS = 10 * 60 * 1000;

type CacheEntry = { urls: string[]; expiresAt: number };
const cache = new Map<number, CacheEntry>();

export function resetRpcCache(): void {
  cache.clear();
}

export type ResolveRpcOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  envUrl?: string | null;
  probe?: (urls: string[]) => Promise<string[]>;
  ttlMs?: number;
  chainName?: string;
};

export async function resolveChainRpcs(chainId: number, options: ResolveRpcOptions = {}): Promise<string[]> {
  const now = options.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const envUrl = normalizeEnvUrl(options.envUrl);
  const cached = cache.get(chainId);

  if (cached && cached.expiresAt > now) return prepend(envUrl, cached.urls);

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(CHAINLIST_URL);
    if (!response.ok) {
      throw new IdentityReadError(
        "RPC_DIRECTORY_UNAVAILABLE",
        `Chainlist responded with HTTP ${response.status}.`,
      );
    }
    const payload: unknown = await response.json();
    const selected = selectRpcs(payload, chainId, options.chainName);
    const probe =
      options.probe ?? ((urls: string[]) => probeRpcs(urls, { expectedChainId: chainId }));
    const probed = await probe(selected);
    if (probed.length === 0) {
      throw new IdentityReadError("RPC_UNAVAILABLE");
    }
    cache.set(chainId, { urls: probed, expiresAt: now + ttlMs });
    return prepend(envUrl, probed);
  } catch (error) {
    const stale = cache.get(chainId);
    if (stale) return prepend(envUrl, stale.urls);
    if (error instanceof IdentityReadError) throw error;
    throw new IdentityReadError("RPC_DIRECTORY_UNAVAILABLE", undefined, { cause: error });
  }
}

export function resolveEthereumRpcs(options: ResolveRpcOptions = {}): Promise<string[]> {
  return resolveChainRpcs(1, { chainName: "Ethereum", ...options });
}

export function resolveEthereumRpcsFromEnv(
  options: Omit<ResolveRpcOptions, "envUrl"> = {},
): Promise<string[]> {
  return resolveEthereumRpcs({ ...options, envUrl: process.env.ETH_RPC_URL });
}

export function resolveChainRpcsFromEnv(
  chainId: SupportedChainId,
  options: Omit<ResolveRpcOptions, "envUrl" | "chainName"> = {},
): Promise<string[]> {
  const chain = getChain(chainId);
  return resolveChainRpcs(chainId, {
    ...options,
    chainName: chain?.name,
    envUrl: chain ? process.env[chain.rpcEnv] : undefined,
  });
}

function normalizeEnvUrl(envUrl: string | null | undefined): string | null {
  if (!envUrl) return null;
  const trimmed = envUrl.trim();
  return isPublicHttpsUrl(trimmed) ? trimmed : null;
}

function prepend(envUrl: string | null, urls: string[]): string[] {
  if (!envUrl) return [...urls];
  return [envUrl, ...urls.filter((url) => url !== envUrl)];
}
