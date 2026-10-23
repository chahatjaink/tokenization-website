import { encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hex } from "viem";

/** ERC-3643 claim id: keccak256(abi.encode(issuer, topic)). Not encodePacked. */
export function claimId(issuer: Address, topic: bigint): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [issuer, topic]));
}
