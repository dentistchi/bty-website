/**
 * C6 242 — 주간 랭킹은 weeklyXp만; 시즌 필드 무관. Awakening 3액트 완료 후 재완료 불가.
 */
import { describe, it, expect } from "vitest";
import { rankByWeeklyXpOnly } from "./rules/leaderboard";
import {
  canCompleteHealingAwakeningAct,
  isHealingAwakeningCompletionHistoryValid,
  nextHealingAwakeningActAfter,
} from "./healing";

describe("242 season vs weekly + awakening all-complete", () => {
  it("weekly leaderboard order ignores season-like fields on entries", () => {
    const entries = [
      { id: "a", weeklyXp: 80, seasonWeek: 99 as unknown as number },
      { id: "b", weeklyXp: 120, seasonTier: "S9" as unknown as string },
    ];
    const r = rankByWeeklyXpOnly(entries);
    expect(r[0].id).toBe("b");
    expect(r[1].id).toBe("a");
  });

  it("awakening [1,2,3] valid; no next act; cannot complete any act again", () => {
    expect(isHealingAwakeningCompletionHistoryValid([1, 2, 3])).toBe(true);
    expect(nextHealingAwakeningActAfter([1, 2, 3])).toBeNull();
    expect(canCompleteHealingAwakeningAct(1, [1, 2, 3])).toBe(false);
    expect(canCompleteHealingAwakeningAct(2, [1, 2, 3])).toBe(false);
    expect(canCompleteHealingAwakeningAct(3, [1, 2, 3])).toBe(false);
  });
});
