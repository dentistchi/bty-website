import { describe, it, expect } from "vitest";
import { phaseCompletionCriteriaMet, normalizeStoredHealingPhase } from "./healingPhase";

describe("healingPhase", () => {
  it("phase 1 requires at least one assessment", () => {
    expect(
      phaseCompletionCriteriaMet(1, {
        assessmentSubmissionCount: 0,
        dearMeLetterCount: 0,
        completedAwakeningActIds: [],
      })
    ).toBe(false);
    expect(
      phaseCompletionCriteriaMet(1, {
        assessmentSubmissionCount: 1,
        dearMeLetterCount: 0,
        completedAwakeningActIds: [],
      })
    ).toBe(true);
  });

  it("phase 2 requires assessment and letter", () => {
    expect(
      phaseCompletionCriteriaMet(2, {
        assessmentSubmissionCount: 1,
        dearMeLetterCount: 0,
        completedAwakeningActIds: [],
      })
    ).toBe(false);
    expect(
      phaseCompletionCriteriaMet(2, {
        assessmentSubmissionCount: 1,
        dearMeLetterCount: 1,
        completedAwakeningActIds: [],
      })
    ).toBe(true);
  });

  it("normalizeStoredHealingPhase clamps invalid to 1", () => {
    expect(normalizeStoredHealingPhase(99)).toBe(1);
    expect(normalizeStoredHealingPhase(3)).toBe(3);
  });
});
