import type { Abi, Address, Hex } from "viem";

export type ContractCall = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export interface IdentityRpc {
  getBlockNumber(): Promise<bigint>;
  getCode(address: Address, blockNumber: bigint): Promise<Hex>;
  readContract(call: ContractCall, blockNumber: bigint): Promise<unknown>;
}

export function isEmptyCode(code: Hex): boolean {
  return /^0x0*$/i.test(code);
}
