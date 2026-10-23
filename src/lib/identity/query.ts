import { getAddress, isAddress, type Address } from "viem";
import { isSupportedChainId, type SupportedChainId } from "@/config/chains";
import { IdentityReadError } from "@/domain/errors";
import type { IdentityQuery } from "@/lib/identity/types";

export type ValidatedQuery = {
  chainId: SupportedChainId;
  wallet: Address;
  token?: Address;
  registry?: Address;
};

export function parseIdentityQuery(url: URL): IdentityQuery {
  const chainRaw = url.searchParams.get("chain");
  const chainId = chainRaw === null || chainRaw.trim() === "" ? 1 : Number(chainRaw);
  if (!Number.isInteger(chainId)) {
    throw new IdentityReadError("UNSUPPORTED_CHAIN");
  }

  return {
    chainId,
    wallet: url.searchParams.get("wallet") ?? "",
    token: blankToUndefined(url.searchParams.get("token")),
    registry: blankToUndefined(url.searchParams.get("registry")),
  };
}

export function validateIdentityQuery(query: IdentityQuery): ValidatedQuery {
  if (!isSupportedChainId(query.chainId)) throw new IdentityReadError("UNSUPPORTED_CHAIN");

  const wallet = parseAddress(query.wallet, "Enter a valid address.");
  if (isZero(wallet)) throw new IdentityReadError("INVALID_ADDRESS");

  const token = query.token ? parseAddress(query.token, "Enter a valid token address.") : undefined;
  const registry = query.registry
    ? parseAddress(query.registry, "Enter a valid IdentityRegistry address.")
    : undefined;

  if (!token && !registry) throw new IdentityReadError("MISSING_CONTEXT");
  if (token) return { chainId: query.chainId, wallet, token };
  return { chainId: query.chainId, wallet, registry };
}

function parseAddress(value: string, message: string): Address {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) throw new IdentityReadError("INVALID_ADDRESS", message);
  return getAddress(trimmed);
}

function isZero(address: Address): boolean {
  return address === "0x0000000000000000000000000000000000000000";
}

function blankToUndefined(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
