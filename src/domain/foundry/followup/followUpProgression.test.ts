import { describe, it, expect } from "vitest";
import {
  FOLLOW_UP_OUTCOMES,
  TERMINAL_FOLLOW_UP_OUTCOME,
  canCheckInAgain,
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

/**
 * SLICE 3.2R-R3-R1 — the authority every surface asks before offering a way back.
 *
 * 3.2M-3's later check-in existed in the service and was unreachable in the product for three
 * slices. This predicate is what makes it reachable, so it is pinned exhaustively: it must agree
 * with `classifyFollowUpSubmission` on every state, because a surface that offers a transition
 * the write path refuses is the same defect wearing a different hat.
 */
describe("[3.2R-R3-R1] canCheckInAgain", () => {
  const NON_TERMINAL_OUTCOMES = FOLLOW_UP_OUTCOMES.filter((o) => o !== TERMINAL_FOLLOW_UP_OUTCOME);

  it("a settled non-terminal answer can take a later check-in", () => {
    for (const o of NON_TERMINAL_OUTCOMES) {
      expect(canCheckInAgain("RESPONDED", o), o).toBe(true);
    }
  });

  it("APPLIED is terminal — nothing may be offered after it", () => {
    expect(canCheckInAgain("RESPONDED", TERMINAL_FOLLOW_UP_OUTCOME)).toBe(false);
  });

  it("PENDING is false, because the FIRST response is a different path and is unchanged", () => {
    for (const o of [...FOLLOW_UP_OUTCOMES, null]) {
      expect(canCheckInAgain("PENDING", o), String(o)).toBe(false);
    }
  });

  it("a RESPONDED row with no outcome is not a check-in target (a shape that cannot exist in the DB)", () => {
    expect(canCheckInAgain("RESPONDED", null)).toBe(false);
  });

  it("it never disagrees with the write path — true iff some outcome would be accepted as progress", () => {
    for (const current of [...FOLLOW_UP_OUTCOMES, null]) {
      const writeWouldAccept = FOLLOW_UP_OUTCOMES.some(
        (next) => classifyFollowUpSubmission(current, next).kind === "progress",
      );
      expect(canCheckInAgain("RESPONDED", current), String(current)).toBe(writeWouldAccept);
    }
  });

  it("reporting an application still requires APPLIED — a reachable check-in establishes nothing", () => {
    for (const o of NON_TERMINAL_OUTCOMES) {
      expect(canCheckInAgain("RESPONDED", o) && reportsApplication(o), o).toBe(false);
    }
  });
});
