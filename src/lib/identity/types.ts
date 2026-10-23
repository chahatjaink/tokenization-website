import type { Address, Hex } from "viem";
import type { SupportedChainId } from "@/config/chains";

export type VerificationNote = "not-registered" | "no-claims-required" | "protocol";
export type ClaimValidity = "valid" | "invalid" | "unverifiable";
export type FactoryStatus = "ok" | "unavailable" | "not-configured" | "not-deployed";

export type IdentityQuery = {
  chainId: number;
  wallet: string;
  token?: string;
  registry?: string;
};

export type ClaimRow = {
  claimId: Hex;
  topic: string;
  label: string | null;
  scheme: string;
  issuer: Address;
  trusted: boolean;
  validity: ClaimValidity;
  data: Hex;
  uri: string;
};

export type IdentityView = {
  chainId: SupportedChainId;
  blockNumber: string;
  wallet: Address;
  context: {
    kind: "token" | "registry";
    token: { address: Address; name: string | null; symbol: string | null } | null;
    registry: Address;
  };
  contains: boolean;
  isVerified: boolean;
  verificationNote: VerificationNote;
  investorCountry: number;
  registryIdentity: Address | null;
  factoryIdentity: Address | null;
  factoryStatus: FactoryStatus;
  identityMismatch: boolean;
  requiredTopics: { topic: string; label: string | null }[];
  claims: ClaimRow[];
  linkedWallets: Address[] | null;
  truncated: boolean;
};
