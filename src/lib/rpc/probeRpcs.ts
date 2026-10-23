const CHAIN_ID_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "eth_chainId",
  params: [],
});

export async function probeChainId(
  url: string,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    expectedChainId?: number;
  } = {},
): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2_500;
  const expectedChainId = options.expectedChainId ?? 1;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: CHAIN_ID_BODY,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) return false;
    const result = payload.result;
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result)) return false;
    return Number(BigInt(result)) === expectedChainId;
  } catch {
    return false;
  }
}

export async function probeRpcs(
  urls: string[],
  options: {
    probeOne?: (url: string) => Promise<boolean>;
    latency?: (url: string) => number;
    limit?: number;
    concurrency?: number;
    maxCandidates?: number;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    expectedChainId?: number;
  } = {},
): Promise<string[]> {
  const limit = options.limit ?? 3;
  const concurrency = options.concurrency ?? 5;
  const candidates = urls.slice(0, options.maxCandidates ?? 15);
  const probeOne =
    options.probeOne ??
    ((url: string) =>
      probeChainId(url, {
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs,
        expectedChainId: options.expectedChainId,
      }));

  const results: { url: string; ms: number }[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const current = cursor;
      cursor += 1;
      const url = candidates[current];
      if (!url) return;
      const started = performance.now();
      const ok = await probeOne(url);
      if (!ok) continue;
      results.push({ url, ms: options.latency?.(url) ?? performance.now() - started });
    }
  }

  const workers = Math.min(concurrency, candidates.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results
    .sort((left, right) => left.ms - right.ms)
    .slice(0, limit)
    .map((entry) => entry.url);
}
