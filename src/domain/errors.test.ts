import { describe, expect, it } from "vitest";
import { IdentityReadError } from "@/domain/errors";
import { withDeadline } from "@/domain/deadline";

describe("IdentityReadError", () => {
  it("maps codes to HTTP status and a public message", () => {
    const error = new IdentityReadError("RPC_DIRECTORY_UNAVAILABLE");
    expect(error.status).toBe(503);
    expect(error.message).toBe("Could not load RPC endpoints from Chainlist.");
    expect(error.code).toBe("RPC_DIRECTORY_UNAVAILABLE");
  });
});

describe("withDeadline", () => {
  it("returns the work result", async () => {
    await expect(withDeadline(1_000, async () => 7)).resolves.toBe(7);
  });

  it("propagates a domain error", async () => {
    const error = new IdentityReadError("CONTRACT_REVERT", "identity reverted.");
    await expect(
      withDeadline(1_000, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("rejects when the deadline elapses", async () => {
    const error = await withDeadline(20, () => new Promise(() => undefined)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IdentityReadError);
    expect((error as IdentityReadError).code).toBe("UPSTREAM_TIMEOUT");
  });
});
