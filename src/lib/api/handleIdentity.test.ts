import { beforeEach, describe, expect, it, vi } from "vitest";
import { zeroAddress } from "viem";
import { handleIdentity, resetIdentityCache } from "@/lib/api/handleIdentity";
import { IdentityReadError } from "@/domain/errors";
import type { IdentityView } from "@/lib/identity/types";

const wallet = "0x0000000000000000000000000000000000000001";
const token = "0x0000000000000000000000000000000000000002";

const view = {
  chainId: 1,
  blockNumber: "10",
  wallet,
  context: { kind: "token", token: { address: token, name: "Token", symbol: "TKN" }, registry: token },
  contains: true,
  isVerified: false,
  verificationNote: "protocol",
  investorCountry: 0,
  registryIdentity: wallet,
  factoryIdentity: null,
  factoryStatus: "ok",
  identityMismatch: false,
  requiredTopics: [],
  claims: [],
  linkedWallets: null,
  truncated: false,
} as IdentityView;

describe("handleIdentity", () => {
  beforeEach(() => resetIdentityCache());

  it("returns 400 for an invalid address", async () => {
    const response = await handleIdentity(request("wallet=nope&token=" + token));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_ADDRESS" } });
  });

  it("returns 400 for an unsupported chain", async () => {
    const response = await handleIdentity(request(`chain=10&wallet=${wallet}&token=${token}`));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNSUPPORTED_CHAIN" } });
  });

  it("accepts Base, Polygon, and BNB Smart Chain", async () => {
    const read = vi.fn(async (query: { chainId: number }) => ({ ...view, chainId: query.chainId }) as IdentityView);
    for (const chain of [8453, 137, 56]) {
      const response = await handleIdentity(request(`chain=${chain}&wallet=${wallet}&token=${token}`), {
        resolveRpcs: async () => ["https://rpc.example"],
        createRpc: () => ({
          getBlockNumber: async () => 1n,
          getCode: async () => "0x01",
          readContract: async () => null,
        }),
        read,
      });
      expect(response.status).toBe(200);
    }
    expect(read.mock.calls.map((call) => call[0].chainId)).toEqual([8453, 137, 56]);
  });

  it("returns 400 when the compliance context is missing", async () => {
    const response = await handleIdentity(request(`wallet=${wallet}`));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "MISSING_CONTEXT" } });
  });

  it("returns 422 when the context has no code", async () => {
    const response = await call({
      read: async () => {
        throw new IdentityReadError("CONTEXT_NOT_A_CONTRACT");
      },
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CONTEXT_NOT_A_CONTRACT" } });
  });

  it("returns 503 when the RPC directory is unavailable", async () => {
    const read = vi.fn();
    const response = await call({
      read,
      resolveRpcs: async () => {
        throw new IdentityReadError("RPC_DIRECTORY_UNAVAILABLE");
      },
    });
    expect(response.status).toBe(503);
    expect(read).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: "RPC_DIRECTORY_UNAVAILABLE" } });
    expect(JSON.stringify(body)).not.toContain("http");
  });

  it("returns the identity document", async () => {
    const response = await call({ read: async () => view });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      chainId: 1,
      wallet,
      blockNumber: "10",
      claims: [],
      factoryStatus: "ok",
    });
  });

  it("caches a success for the block-time window", async () => {
    const read = vi.fn(async () => view);
    const cache = new Map();
    const deps = { read, cache, now: () => 0, ttlMs: 12_000, resolveRpcs: async () => ["https://rpc.example"], createRpc: () => ({}) as never };
    await handleIdentity(request(`wallet=${wallet}&token=${token}`), deps);
    deps.now = () => 1_000;
    await handleIdentity(request(`wallet=${wallet}&token=${token}`), deps);
    expect(read).toHaveBeenCalledTimes(1);
    deps.now = () => 13_000;
    await handleIdentity(request(`wallet=${wallet}&token=${token}`), deps);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("hides unexpected error details", async () => {
    const response = await call({
      read: async () => {
        throw new Error("secret boom from the rpc url https://hidden.example");
      },
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "INTERNAL", message: "The identity read failed." } });
  });

  it("rejects the zero address", async () => {
    const response = await handleIdentity(request(`wallet=${zeroAddress}&token=${token}`));
    expect(response.status).toBe(400);
  });
});

function request(query: string): Request {
  return new Request(`http://localhost/api/identity?${query}`);
}

function call(overrides: Parameters<typeof handleIdentity>[1]): Promise<Response> {
  return handleIdentity(request(`wallet=${wallet}&token=${token}`), {
    resolveRpcs: async () => ["https://rpc.example"],
    createRpc: () => ({}) as never,
    ...overrides,
  });
}
