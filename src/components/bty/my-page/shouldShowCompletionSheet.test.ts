import { describe, expect, it } from "vitest";
import { shouldShowCompletionSheet } from "./MyPageLeadershipConsole";

/**
 * Completion-sheet scoping + seen guard. The sheet must fire ONLY for a completion
 * of a contract worked THIS session, once per session (Private-mode-proof), and must
 * NOT re-fire from a persisted localStorage flag or a remount.
 */
describe("shouldShowCompletionSheet", () => {
  const base = {
    actorCompletedId: "current-contract" as string | null,
    workedThisSession: true,
    alreadyShownThisSession: false,
    seenPersisted: false,
  };

  it("shows for a contract worked this session, not yet shown/seen", () => {
    expect(shouldShowCompletionSheet(base)).toBe(true);
  });

  it("does NOT show for a past latest-ever completion not worked this session", () => {
    expect(shouldShowCompletionSheet({ ...base, workedThisSession: false })).toBe(false);
  });

  it("does NOT re-show once shown this session (survives remount / Private mode)", () => {
    expect(shouldShowCompletionSheet({ ...base, alreadyShownThisSession: true })).toBe(false);
  });

  it("does NOT show when a persisted localStorage seen flag exists", () => {
    expect(shouldShowCompletionSheet({ ...base, seenPersisted: true })).toBe(false);
  });

  it("does NOT show when there is no completion id", () => {
    expect(shouldShowCompletionSheet({ ...base, actorCompletedId: null })).toBe(false);
  });

  it("Private mode (seenPersisted always false): first show yes, second show blocked by session guard", () => {
    // simulate two evaluations for the same contract in one session
    expect(shouldShowCompletionSheet({ ...base, seenPersisted: false, alreadyShownThisSession: false })).toBe(true);
    expect(shouldShowCompletionSheet({ ...base, seenPersisted: false, alreadyShownThisSession: true })).toBe(false);
  });
});
