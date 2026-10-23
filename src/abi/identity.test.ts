import { describe, expect, it } from "vitest";
import { identityAbi, tokenAbi } from "@/abi/identity";

describe("identity abis", () => {
  it("parses human-readable fragments into viem ABI items", () => {
    expect(tokenAbi[0]).toMatchObject({ type: "function", name: "identityRegistry" });
    expect(identityAbi.find((item) => item.type === "function" && item.name === "getClaim")).toMatchObject({
      name: "getClaim",
    });
  });
});
