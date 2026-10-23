import { parseAbi } from "viem";

export const idFactoryAbi = parseAbi([
  "function getIdentity(address _wallet) view returns (address)",
  "function getWallets(address _identity) view returns (address[])",
]);

export const tokenAbi = parseAbi([
  "function identityRegistry() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
]);

export const identityRegistryAbi = parseAbi([
  "function identity(address _userAddress) view returns (address)",
  "function contains(address _userAddress) view returns (bool)",
  "function isVerified(address _userAddress) view returns (bool)",
  "function investorCountry(address _userAddress) view returns (uint16)",
  "function topicsRegistry() view returns (address)",
  "function issuersRegistry() view returns (address)",
]);

export const claimTopicsRegistryAbi = parseAbi([
  "function getClaimTopics() view returns (uint256[])",
]);

export const trustedIssuersRegistryAbi = parseAbi([
  "function getTrustedIssuers() view returns (address[])",
  "function isTrustedIssuer(address _issuer) view returns (bool)",
  "function getTrustedIssuerClaimTopics(address _trustedIssuer) view returns (uint256[])",
  "function hasClaimTopic(address _issuer, uint256 _claimTopic) view returns (bool)",
  "function getTrustedIssuersForClaimTopic(uint256 claimTopic) view returns (address[])",
]);

export const identityAbi = parseAbi([
  "function getClaim(bytes32 _claimId) view returns (uint256 topic, uint256 scheme, address issuer, bytes signature, bytes data, string uri)",
  "function getClaimIdsByTopic(uint256 _topic) view returns (bytes32[])",
]);

export const claimIssuerAbi = parseAbi([
  "function isClaimValid(address _identity, uint256 claimTopic, bytes signature, bytes data) view returns (bool)",
]);
