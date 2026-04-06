import { describe, expect, it } from "vitest";
import { resolveContractFollowupTrigger } from "./contractFollowupEligibility";

describe("resolveContractFollowupTrigger", () => {
  const committed = "2026-01-01T12:00:00.000Z";

  it("returns before_next_chain when flag set", () => {
    expect(
      resolveContractFollowupTrigger({
        contractSessionId: "run-a",
        currentSessionId: "run-a",
        committedAtIso: committed,
        nowMs: Date.parse(committed) + 1000,
        beforeNextChain: true,
      }),
    ).toBe("before_next_chain");
  });

  it("returns after_24h when 24h elapsed", () => {
    expect(
      resolveContractFollowupTrigger({
        contractSessionId: "run-a",
        currentSessionId: "run-a",
        committedAtIso: committed,
        nowMs: Date.parse(committed) + 25 * 60 * 60 * 1000,
      }),
    ).toBe("after_24h");
  });

  it("returns new_session when session differs", () => {
    expect(
      resolveContractFollowupTrigger({
        contractSessionId: "run-old",
        currentSessionId: "run-new",
        committedAtIso: committed,
        nowMs: Date.parse(committed) + 60 * 1000,
      }),
    ).toBe("new_session");
  });

  it("returns null when same session and under 24h and no chain flag", () => {
    expect(
      resolveContractFollowupTrigger({
        contractSessionId: "run-a",
        currentSessionId: "run-a",
        committedAtIso: committed,
        nowMs: Date.parse(committed) + 60 * 1000,
      }),
    ).toBeNull();
  });

  it("returns null for invalid committed date", () => {
    expect(
      resolveContractFollowupTrigger({
        contractSessionId: "run-a",
        currentSessionId: "run-b",
        committedAtIso: "not-a-date",
        nowMs: Date.now(),
      }),
    ).toBeNull();
  });
});
