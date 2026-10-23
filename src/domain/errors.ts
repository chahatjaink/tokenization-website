export const identityErrorCodes = [
  "INVALID_ADDRESS",
  "UNSUPPORTED_CHAIN",
  "MISSING_CONTEXT",
  "CONTEXT_NOT_A_CONTRACT",
  "FACTORY_NOT_DEPLOYED",
  "CONTRACT_REVERT",
  "RPC_DIRECTORY_UNAVAILABLE",
  "RPC_UNAVAILABLE",
  "UPSTREAM_TIMEOUT",
] as const;

export type IdentityErrorCode = (typeof identityErrorCodes)[number];

const STATUS: Record<IdentityErrorCode, number> = {
  INVALID_ADDRESS: 400,
  UNSUPPORTED_CHAIN: 400,
  MISSING_CONTEXT: 400,
  CONTEXT_NOT_A_CONTRACT: 422,
  FACTORY_NOT_DEPLOYED: 422,
  CONTRACT_REVERT: 502,
  RPC_DIRECTORY_UNAVAILABLE: 503,
  RPC_UNAVAILABLE: 503,
  UPSTREAM_TIMEOUT: 504,
};

const MESSAGE: Record<IdentityErrorCode, string> = {
  INVALID_ADDRESS: "Enter a valid address.",
  UNSUPPORTED_CHAIN: "Choose Ethereum, Base, Polygon, or BNB Smart Chain.",
  MISSING_CONTEXT: "Provide a token address or an IdentityRegistry address.",
  CONTEXT_NOT_A_CONTRACT: "That address is not a contract on the selected network.",
  FACTORY_NOT_DEPLOYED: "The ONCHAINID factory has no bytecode on the selected network.",
  CONTRACT_REVERT: "A required contract call reverted.",
  RPC_DIRECTORY_UNAVAILABLE: "Could not load RPC endpoints from Chainlist.",
  RPC_UNAVAILABLE: "RPC endpoints did not respond.",
  UPSTREAM_TIMEOUT: "The identity read timed out.",
};

export class IdentityReadError extends Error {
  readonly code: IdentityErrorCode;
  readonly status: number;

  constructor(code: IdentityErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? MESSAGE[code], options);
    this.name = "IdentityReadError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function identityErrorMessage(code: IdentityErrorCode): string {
  return MESSAGE[code];
}
