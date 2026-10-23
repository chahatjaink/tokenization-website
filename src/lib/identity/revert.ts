import {
  AbiDecodingZeroDataError,
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
} from "viem";

export class ContractReadRevert extends Error {
  constructor(
    readonly functionName: string,
    options?: { cause?: unknown },
  ) {
    super(`${functionName} reverted`, options);
    this.name = "ContractReadRevert";
  }
}

export function isContractRevert(error: unknown): boolean {
  if (error instanceof ContractReadRevert) return true;
  if (!(error instanceof BaseError)) return false;
  return (
    error.walk(
      (candidate) =>
        candidate instanceof ContractFunctionRevertedError ||
        candidate instanceof ContractFunctionZeroDataError ||
        candidate instanceof AbiDecodingZeroDataError,
    ) !== null
  );
}
