import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityReadError } from "@/domain/errors";
import { CHAINLIST_URL, resetRpcCache, resolveChainRpcs, resolveEthereumRpcs } from "@/lib/rpc/resolveRpcs";

const directory = [
  {
    chainId: 1,
    rpc: [
      { url: "https://one.example", tracking: "none" },
      { url: "https://two.example", tracking: "limited" },
    ],
  },
];

describe("resolveEthereumRpcs", () => {
  beforeEach(() => resetRpcCache());

  it("probes Chainlist results and caches them", async () => {
    const fetchImpl = vi.fn(async () => json(directory));
    const probe = vi.fn(async () => ["https://one.example"]);
    const first = await resolveEthereumRpcs({ fetchImpl, probe, now: () => 0, ttlMs: 1_000 });
    const second = await resolveEthereumRpcs({ fetchImpl, probe, now: () => 500, ttlMs: 1_000 });
    expect(first).toEqual(["https://one.example"]);
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(CHAINLIST_URL);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("refetches after the cache expires", async () => {
    const fetchImpl = vi.fn(async () => json(directory));
    const probe = vi.fn(async () => ["https://one.example"]);
    await resolveEthereumRpcs({ fetchImpl, probe, now: () => 0, ttlMs: 1_000 });
    await resolveEthereumRpcs({ fetchImpl, probe, now: () => 1_001, ttlMs: 1_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("prepends a public ETH_RPC_URL and drops an invalid one", async () => {
    const fetchImpl = async () => json(directory);
    const probe = async () => ["https://one.example"];
    await expect(
      resolveEthereumRpcs({ fetchImpl, probe, envUrl: "https://paid.example/rpc", now: () => 0 }),
    ).resolves.toEqual(["https://paid.example/rpc", "https://one.example"]);
    resetRpcCache();
    await expect(
      resolveEthereumRpcs({ fetchImpl, probe, envUrl: "http://localhost:8545", now: () => 0 }),
    ).resolves.toEqual(["https://one.example"]);
  });

  it("throws when Chainlist cannot be read and nothing is cached", async () => {
    const fetchImpl = async () => {
      throw new Error("offline");
    };
    await expect(resolveEthereumRpcs({ fetchImpl, now: () => 0 })).rejects.toMatchObject({
      code: "RPC_DIRECTORY_UNAVAILABLE",
    });
  });

  it("reuses the last good list when a refresh fails", async () => {
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(json(directory))
      .mockRejectedValueOnce(new Error("offline"));
    const probe = async () => ["https://one.example"];
    await resolveEthereumRpcs({ fetchImpl, probe, now: () => 0, ttlMs: 10 });
    await expect(resolveEthereumRpcs({ fetchImpl, probe, now: () => 11, ttlMs: 10 })).resolves.toEqual([
      "https://one.example",
    ]);
  });

  it("keeps a separate cache for each chain", async () => {
    const fetchImpl = vi.fn(async () =>
      json([
        ...directory,
        { chainId: 137, rpc: [{ url: "https://polygon.example", tracking: "none" }] },
      ]),
    );
    const probe = vi.fn(async (urls: string[]) => urls.slice(0, 1));
    await expect(resolveEthereumRpcs({ fetchImpl, probe, now: () => 0, ttlMs: 1_000 })).resolves.toEqual([
      "https://one.example",
    ]);
    await expect(
      resolveChainRpcs(137, { fetchImpl, probe, chainName: "Polygon", now: () => 10, ttlMs: 1_000 }),
    ).resolves.toEqual(["https://polygon.example"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws RPC_UNAVAILABLE when every probe fails", async () => {
    const fetchImpl = async () => json(directory);
    await expect(resolveEthereumRpcs({ fetchImpl, probe: async () => [], now: () => 0 })).rejects.toBeInstanceOf(
      IdentityReadError,
    );
    resetRpcCache();
    await expect(resolveEthereumRpcs({ fetchImpl, probe: async () => [], now: () => 0 })).rejects.toMatchObject({
      code: "RPC_UNAVAILABLE",
    });
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
