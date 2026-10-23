import { describe, expect, it } from "vitest";
import { encodePacked, keccak256 } from "viem";
import { claimId } from "@/lib/identity/claimId";

const issuer = "0x1111111111111111111111111111111111111111";

describe("claimId", () => {
  it("matches keccak256(abi.encode(issuer, topic))", () => {
    expect(claimId(issuer, 1n)).toBe(
      "0x8eec1c9afb183a84aac7003cf8e730bfb6385f6e43761d6425fba4265de3a9eb",
    );
  });

  it("does not match encodePacked", () => {
    const packed = keccak256(encodePacked(["address", "uint256"], [issuer, 1n]));
    expect(packed).not.toBe(claimId(issuer, 1n));
  });
});
