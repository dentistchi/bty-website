import { describe, it, expect } from "vitest";
import {
  FOLLOW_UP_OUTCOMES,
  TERMINAL_FOLLOW_UP_OUTCOME,
  classifyFollowUpSubmission,
  reportsApplication,
} from "./followUpObligation";

/**
 * SLICE 3.2M-3 — honesty must not be a dead end.
 *
 * The obligation was first-wins and immutable, so a learner who truthfully answered "not yet"
 * on day 7 could never come back on day 14 and say they had done it. The product punished the
 * honest answer. APPLIED is terminal; the other three are check-ins someone may move on from.
 */
const NON_TERMINAL = FOLLOW_UP_OUTCOMES.filter((o) => o !== TERMINAL_FOLLOW_UP_OUTCOME);

describe("[3.2M-3] follow-up progression", () => {
  it("the first report is the first report, whatever it says", () => {
    for (const o of FOLLOW_UP_OUTCOMES) {
      expect(classifyFollowUpSubmission(null, o).kind, o).toBe("first");
    }
  });

  it("the same answer again is a double tap, not a second check-in", () => {
    for (const o of FOLLOW_UP_OUTCOMES) {
      expect(classifyFollowUpSubmission(o, o).kind, o).toBe("repeat");
    }
  });

  it("every non-terminal answer can later become APPLIED", () => {
    for (const from of NON_TERMINAL) {
      expect(classifyFollowUpSubmission(from, "APPLIED").kind, from).toBe("progress");
    }
  });

  it("non-terminal answers can also move between each other — people change their minds honestly", () => {
    expect(classifyFollowUpSubmission("NOT_YET", "BLOCKED").kind).toBe("progress");
    expect(classifyFollowUpSubmission("BLOCKED", "PARTLY_APPLIED").kind).toBe("progress");
  });

  it("APPLIED is terminal — nothing downgrades or replaces it", () => {
    for (const to of NON_TERMINAL) {
      expect(classifyFollowUpSubmission("APPLIED", to).kind, to).toBe("terminal_locked");
    }
  });

  it("only APPLIED reports an application — partly is not mostly", () => {
    expect(reportsApplication("APPLIED")).toBe(true);
    for (const o of [...NON_TERMINAL, null]) {
      expect(reportsApplication(o), String(o)).toBe(false);
    }
  });
});
