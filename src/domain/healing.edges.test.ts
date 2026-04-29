/**
 * Healing domain — 미커버 경계 (SPRINT 46 TASK 8 / 252 C3).
 */
import { describe, it, expect } from "vitest";
import {
  healingAwakeningCompletionCelebrationMessageKey,
  nextHealingAwakeningActAfter,
  healingAwakeningNextUnlockedAfterCompleting,
} from "./healing";

describe("healing domain edges (252)", () => {
  it("healingAwakeningCompletionCelebrationMessageKey is stable", () => {
    expect(healingAwakeningCompletionCelebrationMessageKey()).toBe(
      "healing_awakening_all_complete_next_steps"
    );
  });

  it("nextHealingAwakeningActAfter returns null when act 2 skipped (1 then 3)", () => {
    expect(nextHealingAwakeningActAfter([1, 3])).toBeNull();
  });

  it("healingAwakeningNextUnlockedAfterCompleting rejects completing 3 before 2", () => {
    expect(healingAwakeningNextUnlockedAfterCompleting(3, [1])).toBeNull();
  });
});
