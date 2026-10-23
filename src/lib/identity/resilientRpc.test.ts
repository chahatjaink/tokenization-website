import { ContractFunctionRevertedError, ContractFunctionZeroDataError } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { IdentityRpc } from "@/lib/identity/rpc";
import { createResilientIdentityRpc } from "@/lib/identity/resilientRpc";
import { ContractReadRevert, isContractRevert } from "@/lib/identity/revert";

describe("isContractRevert", () => {
  it("recognizes a viem revert, zero data, and the local revert", () => {
    const viemError = new ContractFunctionRevertedError({
      abi: [],
      functionName: "identity",
      data: "0x",
    });
    const zeroData = new ContractFunctionZeroDataError({ functionName: "identity" });
    expect(isContractRevert(viemError)).toBe(true);
    expect(isContractRevert(zeroData)).toBe(true);
    expect(isContractRevert(new ContractReadRevert("identity"))).toBe(true);
    expect(isContractRevert(new Error("timeout"))).toBe(false);
  });
});

describe("createResilientIdentityRpc", () => {
  it("retries a non-revert on the plain client", async () => {
    const primary = stub({
      readContract: vi.fn(async () => {
        throw new Error("batch too large");
      }),
    });
    const plain = stub({
      readContract: vi.fn(async () => "ok"),
    });
    const rpc = createResilientIdentityRpc(primary, plain);
    await expect(
      rpc.readContract({ address: "0x0000000000000000000000000000000000000001", abi: [], functionName: "name" }, 1n),
    ).resolves.toBe("ok");
    expect(plain.readContract).toHaveBeenCalledOnce();
  });

  it("does not retry a contract revert", async () => {
    const primary = stub({
      readContract: vi.fn(async () => {
        throw new ContractReadRevert("identity");
      }),
    });
    const plain = stub({ readContract: vi.fn() });
    const rpc = createResilientIdentityRpc(primary, plain);
    await expect(
      rpc.readContract({ address: "0x0000000000000000000000000000000000000001", abi: [], functionName: "identity" }, 1n),
    ).rejects.toBeInstanceOf(ContractReadRevert);
    expect(plain.readContract).not.toHaveBeenCalled();
  });

  it("throws RPC_UNAVAILABLE when both clients fail", async () => {
    const primary = stub({
      getBlockNumber: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    const plain = stub({
      getBlockNumber: vi.fn(async () => {
        throw new Error("also down");
      }),
    });
    const rpc = createResilientIdentityRpc(primary, plain);
    await expect(rpc.getBlockNumber()).rejects.toMatchObject({ code: "RPC_UNAVAILABLE" });
  });
});

function stub(partial: Partial<IdentityRpc>): IdentityRpc {
  return {
    getBlockNumber: vi.fn(async () => 1n),
    getCode: vi.fn(async () => "0x01" as const),
    readContract: vi.fn(async () => null),
    ...partial,
  };
}
