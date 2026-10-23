import { describe, expect, it } from "vitest";
import { probeChainId, probeRpcs } from "@/lib/rpc/probeRpcs";

describe("probeChainId", () => {
  it("accepts eth_chainId 0x1", async () => {
    const fetchImpl = mockFetch(json({ result: "0x1" }));
    await expect(probeChainId("https://rpc.example", { fetchImpl })).resolves.toBe(true);
  });

  it("rejects a wrong chain id", async () => {
    const fetchImpl = mockFetch(json({ result: "0x38" }));
    await expect(probeChainId("https://rpc.example", { fetchImpl })).resolves.toBe(false);
  });

  it("rejects HTTP 429", async () => {
    const fetchImpl = mockFetch(new Response("nope", { status: 429 }));
    await expect(probeChainId("https://rpc.example", { fetchImpl })).resolves.toBe(false);
  });

  it("rejects a timeout", async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        signal.addEventListener("abort", () => reject(signal.reason));
      })) as typeof fetch;
    await expect(probeChainId("https://rpc.example", { fetchImpl, timeoutMs: 20 })).resolves.toBe(false);
  });
});

describe("probeRpcs", () => {
  it("returns at most three healthy urls, fastest first", async () => {
    const urls = ["https://a.example", "https://b.example", "https://c.example", "https://d.example"];
    const latency = new Map([
      ["https://a.example", 30],
      ["https://b.example", 10],
      ["https://c.example", 20],
      ["https://d.example", 5],
    ]);
    const result = await probeRpcs(urls, {
      limit: 3,
      probeOne: async (url) => url !== "https://c.example",
      latency: (url) => latency.get(url) ?? 100,
    });
    expect(result).toEqual(["https://d.example", "https://b.example", "https://a.example"]);
  });

  it("does not probe past the candidate cap", async () => {
    const seen: string[] = [];
    await probeRpcs(["https://a.example", "https://b.example", "https://c.example"], {
      maxCandidates: 1,
      probeOne: async (url) => {
        seen.push(url);
        return true;
      },
    });
    expect(seen).toEqual(["https://a.example"]);
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function mockFetch(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}
