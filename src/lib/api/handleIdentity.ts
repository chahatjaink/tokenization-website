import { getChain } from "@/config/chains";
import { withDeadline } from "@/domain/deadline";
import { IdentityReadError } from "@/domain/errors";
import { readIdentity } from "@/lib/identity/readIdentity";
import type { IdentityRpc } from "@/lib/identity/rpc";
import type { IdentityQuery, IdentityView } from "@/lib/identity/types";
import { parseIdentityQuery, validateIdentityQuery, type ValidatedQuery } from "@/lib/identity/query";
import { resolveChainRpcsFromEnv } from "@/lib/rpc/resolveRpcs";
import { createChainRpc } from "@/lib/identity/viemRpc";

const RESULT_TTL_MS = 12_000;

type CacheEntry = { expiresAt: number; view: IdentityView };

const sharedCache = new Map<string, CacheEntry>();

export function resetIdentityCache(): void {
  sharedCache.clear();
}

export type HandleDeps = {
  now?: () => number;
  ttlMs?: number;
  deadlineMs?: number;
  cache?: Map<string, CacheEntry>;
  resolveRpcs?: () => Promise<string[]>;
  createRpc?: (urls: string[]) => IdentityRpc;
  read?: (query: IdentityQuery, deps: { rpc: IdentityRpc }) => Promise<IdentityView>;
};

export async function handleIdentity(request: Request, deps: HandleDeps = {}): Promise<Response> {
  let validated: ValidatedQuery;
  try {
    validated = validateIdentityQuery(parseIdentityQuery(new URL(request.url)));
  } catch (error) {
    return toResponse(error);
  }

  const cache = deps.cache ?? sharedCache;
  const now = deps.now?.() ?? Date.now();
  const ttlMs = deps.ttlMs ?? RESULT_TTL_MS;
  const key = cacheKey(validated);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return json(hit.view, 200);

  try {
    const view = await withDeadline(deps.deadlineMs ?? 20_000, async () => {
      const chain = getChain(validated.chainId);
      if (!chain) throw new IdentityReadError("UNSUPPORTED_CHAIN");
      const resolve = deps.resolveRpcs ?? (() => resolveChainRpcsFromEnv(chain.id));
      const create = deps.createRpc ?? ((urls: string[]) => createChainRpc(chain, urls));
      const read = deps.read ?? ((query, reader) => readIdentity(query, { ...reader, chain }));
      const rpc = create(await resolve());
      return read(validated, { rpc });
    });
    cache.set(key, { expiresAt: now + ttlMs, view });
    return json(view, 200);
  } catch (error) {
    return toResponse(error);
  }
}

function cacheKey(query: ValidatedQuery): string {
  const context = query.token ? `token:${query.token}` : `registry:${query.registry}`;
  return `${query.chainId}:${query.wallet}:${context}`;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function toResponse(error: unknown): Response {
  if (error instanceof IdentityReadError) {
    logServerError(error.code, error);
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  logServerError("INTERNAL", error);
  return json({ error: { code: "INTERNAL", message: "The identity read failed." } }, 500);
}

function logServerError(code: string, detail: unknown): void {
  if (process.env.NODE_ENV === "test") return;
  console.error(code, detail);
}
