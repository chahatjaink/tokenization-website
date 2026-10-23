import { IdentityReadError } from "@/domain/errors";
import type { IdentityRpc } from "@/lib/identity/rpc";
import { ContractReadRevert, isContractRevert } from "@/lib/identity/revert";

/** Tries the multicall client, then the same call without multicall, once. */
export function createResilientIdentityRpc(primary: IdentityRpc, plain: IdentityRpc): IdentityRpc {
  return {
    getBlockNumber: () => retry(() => primary.getBlockNumber(), () => plain.getBlockNumber()),
    getCode: (address, blockNumber) =>
      retry(
        () => primary.getCode(address, blockNumber),
        () => plain.getCode(address, blockNumber),
      ),
    readContract: (call, blockNumber) =>
      retry(
        () => primary.readContract(call, blockNumber),
        () => plain.readContract(call, blockNumber),
      ),
  };
}

async function retry<T>(primary: () => Promise<T>, plain: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (error instanceof TypeError) throw error;
    if (isContractRevert(error)) {
      throw error instanceof ContractReadRevert
        ? error
        : new ContractReadRevert("read", { cause: error });
    }
    try {
      return await plain();
    } catch (retryError) {
      if (retryError instanceof TypeError) throw retryError;
      if (isContractRevert(retryError)) {
        throw retryError instanceof ContractReadRevert
          ? retryError
          : new ContractReadRevert("read", { cause: retryError });
      }
      if (retryError instanceof IdentityReadError) throw retryError;
      throw new IdentityReadError("RPC_UNAVAILABLE", undefined, { cause: retryError });
    }
  }
}
