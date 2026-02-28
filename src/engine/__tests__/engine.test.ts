/**
 * BTY Arena engine — unit tests.
 * Run from repo root: npx vitest run src/engine
 *
 * Test vectors (data table reference):
 *
 * awardCoreXp:
 *   currentCoreXp | amount | expected
 *   0             | 50     | 50
 *   100           | 25     | 125
 *   200           | 0      | 200
 *   10            | -5     | 10 (clamped via max(0))
 *
 * awardWeeklyXp:
 *   currentWeeklyXp | amount | expected
 *   0                | 100   | 100
 *   500              | 50    | 550
 *
 * calculateLevelFromCoreXp (= tier):
 *   coreXp | expected level (tier)
 *   0      | 0
 *   9      | 0
 *   10     | 1
 *   99     | 9
 *   100    | 10
 *   700    | 70
 *
 * calculateTierFromLevel:
 *   level | expected tier
 *   0     | 0
 *   10    | 10
 *   70    | 70
 *
 * calculateStageFromTier (stage = min(7, floor(tier/10)+1)):
 *   tier | expected stage
 *   0    | 1
 *   9    | 1
 *   10   | 2
 *   69   | 7
 *   70   | 7
 *
 * leaderboardSortWeekly:
 *   entries (userId, weeklyXp) -> sorted by weeklyXp desc
 *
 * seasonResetPlanner:
 *   now         | endDate    | currentWeeklyXp | isResetDue | newWeeklyXpAfterReset (10% carryover)
 *   2026-01-15  | 2026-01-31 | 1000            | false      | 100
 *   2026-02-01  | 2026-01-31 | 1000            | true       | 100
 */

import { describe, it, expect } from "vitest";
import {
  awardCoreXp,
  awardWeeklyXp,
  calculateLevelFromCoreXp,
  calculateTierFromLevel,
  calculateStageFromTier,
  leaderboardSortWeekly,
  seasonResetPlanner,
} from "../index";

describe("awardCoreXp", () => {
  it("adds amount to current (0 + 50 = 50)", () => {
    expect(awardCoreXp(0, 50)).toBe(50);
  });
  it("adds amount to current (100 + 25 = 125)", () => {
    expect(awardCoreXp(100, 25)).toBe(125);
  });
  it("handles zero amount", () => {
    expect(awardCoreXp(200, 0)).toBe(200);
  });
  it("clamps negative amount to 0", () => {
    expect(awardCoreXp(10, -5)).toBe(10);
  });
});

describe("awardWeeklyXp", () => {
  it("adds amount to current", () => {
    expect(awardWeeklyXp(0, 100)).toBe(100);
    expect(awardWeeklyXp(500, 50)).toBe(550);
  });
});

describe("calculateLevelFromCoreXp", () => {
  it("returns tier = floor(coreXp/10)", () => {
    expect(calculateLevelFromCoreXp(0)).toBe(0);
    expect(calculateLevelFromCoreXp(9)).toBe(0);
    expect(calculateLevelFromCoreXp(10)).toBe(1);
    expect(calculateLevelFromCoreXp(99)).toBe(9);
    expect(calculateLevelFromCoreXp(100)).toBe(10);
    expect(calculateLevelFromCoreXp(700)).toBe(70);
  });
});

describe("calculateTierFromLevel", () => {
  it("returns level as tier (identity for 0-based level)", () => {
    expect(calculateTierFromLevel(0)).toBe(0);
    expect(calculateTierFromLevel(10)).toBe(10);
    expect(calculateTierFromLevel(70)).toBe(70);
  });
});

describe("calculateStageFromTier", () => {
  it("returns stage 1..7 from tier", () => {
    expect(calculateStageFromTier(0)).toBe(1);
    expect(calculateStageFromTier(9)).toBe(1);
    expect(calculateStageFromTier(10)).toBe(2);
    expect(calculateStageFromTier(69)).toBe(7);
    expect(calculateStageFromTier(70)).toBe(7);
  });
});

describe("leaderboardSortWeekly", () => {
  it("sorts by weeklyXp descending", () => {
    const entries = [
      { userId: "a", weeklyXp: 100 },
      { userId: "b", weeklyXp: 300 },
      { userId: "c", weeklyXp: 200 },
    ];
    const sorted = leaderboardSortWeekly(entries);
    expect(sorted.map((e) => e.userId)).toEqual(["b", "c", "a"]);
    expect(sorted.map((e) => e.weeklyXp)).toEqual([300, 200, 100]);
  });
  it("does not mutate input", () => {
    const entries = [{ userId: "a", weeklyXp: 50 }];
    leaderboardSortWeekly(entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].weeklyXp).toBe(50);
  });
});

describe("seasonResetPlanner", () => {
  it("returns isResetDue false when now < endDate", () => {
    const plan = seasonResetPlanner(
      "2026-01-15",
      { id: "S1", startDate: "2026-01-01", endDate: "2026-01-31" },
      1000
    );
    expect(plan.isResetDue).toBe(false);
    expect(plan.resetDate).toBe("2026-01-31");
    expect(plan.newWeeklyXpAfterReset).toBe(100); // 10% carryover
    expect(plan.coreXpUnaffected).toBe(true);
  });
  it("returns isResetDue true when now >= endDate", () => {
    const plan = seasonResetPlanner(
      "2026-02-01",
      { id: "S1", startDate: "2026-01-01", endDate: "2026-01-31" },
      1000
    );
    expect(plan.isResetDue).toBe(true);
    expect(plan.newWeeklyXpAfterReset).toBe(100);
  });
});
