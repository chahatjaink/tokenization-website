import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { base, bsc, mainnet, polygon, type Chain } from "viem/chains";
import { ethereum, type ChainDefinition, type SupportedChainId } from "@/config/chains";
import { IdentityReadError } from "@/domain/errors";
import type { ContractCall, IdentityRpc } from "@/lib/identity/rpc";
import { createResilientIdentityRpc } from "@/lib/identity/resilientRpc";
import { ContractReadRevert, isContractRevert } from "@/lib/identity/revert";

const VIEM_CHAIN: Record<SupportedChainId, Chain> = {
  1: mainnet,
  8453: base,
  137: polygon,
  56: bsc,
};

export function createChainRpc(chain: ChainDefinition, urls: string[]): IdentityRpc {
  if (urls.length === 0) throw new IdentityReadError("RPC_UNAVAILABLE");

  const network = VIEM_CHAIN[chain.id];
  const transport = fallback(
    urls.map((url) => http(url, { timeout: 8_000, retryCount: 0 })),
    { rank: false, retryCount: 0 },
  );

  const primary = createPublicClient({
    chain: network,
    transport,
    batch: { multicall: { batchSize: 64, wait: 0 } },
  });
  const plain = createPublicClient({
    chain: network,
    transport,
    batch: { multicall: false },
  });

  return createResilientIdentityRpc(toIdentityRpc(primary), toIdentityRpc(plain));
}

export function createEthereumRpc(urls: string[]): IdentityRpc {
  return createChainRpc(ethereum, urls);
}

function toIdentityRpc(client: PublicClient): IdentityRpc {
  return {
    getBlockNumber: () => client.getBlockNumber(),
    async getCode(address, blockNumber) {
      try {
        const code = await client.getCode({ address, blockNumber });
        return code ?? "0x";
      } catch (error) {
        throw translate(error, "getCode");
      }
    },
    async readContract(call: ContractCall, blockNumber: bigint) {
      try {
        return await client.readContract({
          address: call.address,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
          blockNumber,
        } as Parameters<PublicClient["readContract"]>[0]);
      } catch (error) {
        throw translate(error, call.functionName);
      }
    },
  };
}

function translate(error: unknown, functionName: string): Error {
  if (isContractRevert(error)) return new ContractReadRevert(functionName, { cause: error });
  if (error instanceof IdentityReadError) return error;
  return error instanceof Error ? error : new Error("RPC request failed.");
}
