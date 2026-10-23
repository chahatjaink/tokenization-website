import type { Address } from "viem";

export const SUPPORTED_CHAIN_IDS = [1, 8453, 137, 56] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export type KnownContext = {
  label: string;
  token?: Address;
  registry?: Address;
};

export type ChainDefinition = {
  id: SupportedChainId;
  name: string;
  /** Official ONCHAINID IdFactory. Null when that factory is not deployed on the network. */
  idFactory: Address | null;
  topicLabels: Record<string, string>;
  knownContexts: KnownContext[];
  rpcEnv: "ETH_RPC_URL" | "BASE_RPC_URL" | "POLYGON_RPC_URL" | "BNB_RPC_URL";
};

/**
 * Topic ids are deployment-defined. This dictionary only decorates ids the
 * operator has confirmed. Unknown topics stay as the raw integer.
 *
 * The IdFactory address is the ERC-3643 association deployment, shared by
 * Ethereum, Base, and Polygon. BNB Smart Chain has no bytecode there.
 */
const ID_FACTORY = "0x23b64FBc42Ef1775F8A099965659c4c5C91e0CeC" as Address;

export const ethereum = {
  id: 1,
  name: "Ethereum",
  idFactory: ID_FACTORY,
  topicLabels: {},
  knownContexts: [],
  rpcEnv: "ETH_RPC_URL",
} as const satisfies ChainDefinition;

export const base = {
  id: 8453,
  name: "Base",
  idFactory: ID_FACTORY,
  topicLabels: {},
  knownContexts: [],
  rpcEnv: "BASE_RPC_URL",
} as const satisfies ChainDefinition;

export const polygon = {
  id: 137,
  name: "Polygon",
  idFactory: ID_FACTORY,
  topicLabels: {},
  knownContexts: [],
  rpcEnv: "POLYGON_RPC_URL",
} as const satisfies ChainDefinition;

export const bnb = {
  id: 56,
  name: "BNB Smart Chain",
  idFactory: null,
  topicLabels: {},
  knownContexts: [],
  rpcEnv: "BNB_RPC_URL",
} as const satisfies ChainDefinition;

export const chains = [ethereum, base, polygon, bnb] as const;

export function isSupportedChainId(value: number): value is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(value);
}

export function getChain(chainId: number): ChainDefinition | undefined {
  return chains.find((chain) => chain.id === chainId);
}
