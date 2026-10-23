import { describe, expect, it } from "vitest";
import { IdentityReadError } from "@/domain/errors";
import { selectRpcs } from "@/lib/rpc/selectRpcs";

const ethereum = {
  name: "Ethereum Mainnet",
  chainId: 1,
  rpc: [
    { url: "https://fast.example/rpc", tracking: "none" },
    { url: "wss://fast.example/rpc", tracking: "none" },
    { url: "https://eth.example/v2/${KEY}", tracking: "none" },
    { url: "http://insecure.example", tracking: "none" },
    { url: "https://127.0.0.1/rpc", tracking: "none" },
    { url: "https://tracked.example", tracking: "yes" },
    { url: "https://limited.example", tracking: "limited" },
    { url: "https://unknown.example", tracking: "unspecified" },
    "https://string.example",
    { url: "https://limited-2.example", tracking: "limited" },
    { url: "https://fast.example/rpc", tracking: "none" },
  ],
};

describe("selectRpcs", () => {
  it("keeps public https endpoints, none before limited", () => {
    expect(selectRpcs([ethereum, { chainId: 56, rpc: [{ url: "https://bsc.example", tracking: "none" }] }])).toEqual([
      "https://fast.example/rpc",
      "https://limited.example",
      "https://limited-2.example",
    ]);
  });

  it("rejects a payload that is not a chain list", () => {
    expect(() => selectRpcs({ chainId: 1 })).toThrow(IdentityReadError);
    try {
      selectRpcs({ chainId: 1 });
    } catch (error) {
      expect(error).toMatchObject({ code: "RPC_DIRECTORY_UNAVAILABLE" });
    }
  });

  it("selects another supported network from the same directory", () => {
    expect(
      selectRpcs(
        [ethereum, { chainId: 137, rpc: [{ url: "https://polygon.example", tracking: "none" }] }],
        137,
        "Polygon",
      ),
    ).toEqual(["https://polygon.example"]);
  });

  it("rejects a missing chain and an empty filter", () => {
    expect(() => selectRpcs([{ chainId: 56, rpc: [] }])).toThrowError(
      expect.objectContaining({ code: "RPC_DIRECTORY_UNAVAILABLE" }),
    );
    expect(() =>
      selectRpcs([{ chainId: 1, isTestnet: true, rpc: [{ url: "https://ok.example", tracking: "none" }] }]),
    ).toThrowError(expect.objectContaining({ code: "RPC_DIRECTORY_UNAVAILABLE" }));
    expect(() =>
      selectRpcs([{ chainId: 1, rpc: [{ url: "https://tracked.example", tracking: "yes" }] }]),
    ).toThrowError(expect.objectContaining({ message: "Chainlist has no usable Ethereum RPC URLs." }));
  });
});
