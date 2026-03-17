/**
 * WeeklyXp 도메인 경계 테스트.
 * weeklyXp.test.ts와 중복 없이 경계·엣지만.
 */
import { describe, it, expect } from "vitest";
import {
  calculateTier,
  calculateLevel,
  awardXp,
  seasonReset,
  leaderboardSort,
  type LeaderboardEntry,
} from "./weeklyXp";

describe("domain/rules/weeklyXp (edges)", () => {
  it("calculateTier boundary: 99 Bronze, 100 Silver", () => {
    expect(calculateTier(99)).toBe("Bronze");
    expect(calculateTier(100)).toBe("Silver");
  });

  it("calculateTier boundary: 199 Silver, 200 Gold", () => {
    expect(calculateTier(199)).toBe("Silver");
    expect(calculateTier(200)).toBe("Gold");
  });

  it("calculateTier boundary: 299 Gold, 300 Platinum", () => {
    expect(calculateTier(299)).toBe("Gold");
    expect(calculateTier(300)).toBe("Platinum");
  });

  it("calculateLevel boundary: 0 → 1, 99 → 1, 100 → 2", () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
  });

  it("awardXp leaves core unchanged when earnedSeasonalXp is 0", () => {
    const r = awardXp({ coreXp: 100, weeklyXp: 50, earnedSeasonalXp: 0 });
    expect(r.newCoreXp).toBe(100);
    expect(r.newWeeklyXp).toBe(50);
  });

  it("awardXp adds earnedSeasonalXp to weeklyXp", () => {
    const r = awardXp({ coreXp: 0, weeklyXp: 0, earnedSeasonalXp: 1 });
    expect(r.newWeeklyXp).toBe(1);
  });

  it("seasonReset keeps coreXp unchanged (domain invariant)", () => {
    const r = seasonReset({ coreXp: 999, weeklyXp: 100 });
    expect(r.coreXp).toBe(999);
    expect(r.weeklyXp).toBe(0);
  });

  it("seasonReset returns object with coreXp and weeklyXp keys", () => {
    const r = seasonReset({ coreXp: 0, weeklyXp: 50 });
    expect(r).toHaveProperty("coreXp");
    expect(r).toHaveProperty("weeklyXp");
  });

  it("leaderboardSort single entry returns copy", () => {
    const entries: LeaderboardEntry[] = [{ userId: "a", xpTotal: 10 }];
    const sorted = leaderboardSort(entries);
    expect(sorted).toHaveLength(1);
    expect(sorted).not.toBe(entries);
    expect(sorted[0].xpTotal).toBe(10);
  });

  it("leaderboardSort empty array returns empty array", () => {
    const sorted = leaderboardSort([]);
    expect(sorted).toEqual([]);
    expect(sorted).not.toBe([]);
  });

  it("leaderboardSort ranks by weekly xpTotal desc only (multi-entry)", () => {
    const entries: LeaderboardEntry[] = [
      { userId: "c", xpTotal: 50 },
      { userId: "a", xpTotal: 200 },
      { userId: "b", xpTotal: 100 },
    ];
    const sorted = leaderboardSort(entries);
    expect(sorted.map((e) => e.userId)).toEqual(["a", "b", "c"]);
    expect(sorted[0].xpTotal).toBe(200);
  });

  it("seasonReset return has coreXp and weeklyXp keys", () => {
    const r = seasonReset({ coreXp: 50, weeklyXp: 10 });
    expect(r).toHaveProperty("coreXp");
    expect(r).toHaveProperty("weeklyXp");
  });
});
