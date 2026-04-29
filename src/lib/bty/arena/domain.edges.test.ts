/**
 * Edge-case tests for arena domain (Arena 9차).
 * 기존 동작만 검증, 비즈니스/XP 로직 변경 금지.
 */
import { describe, it, expect } from "vitest";
import {
  awardXp,
  calculateLevel,
  calculateTier,
  calculateLevelTierProgress,
  seasonReset,
  leaderboardSort,
  type LeaderboardEntry,
} from "./domain";

describe("domain (edges)", () => {
  describe("awardXp rate boundary", () => {
    it("coreXp 199 uses 45:1, 200 uses 60:1", () => {
      const at199 = awardXp({ coreXp: 199, weeklyXp: 0, earnedSeasonalXp: 45 });
      expect(at199.newCoreXp).toBe(200);
      expect(at199.newWeeklyXp).toBe(45);
      const at200 = awardXp({ coreXp: 200, weeklyXp: 0, earnedSeasonalXp: 60 });
      expect(at200.newCoreXp).toBe(201);
      expect(at200.newWeeklyXp).toBe(60);
    });
  });

  describe("calculateLevel / calculateTier boundaries", () => {
    it("level at 0 and 100 boundary", () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(100)).toBe(2);
    });
    it("tier at 99 Bronze, 100 Silver, 199 Silver, 200 Gold, 300 Platinum", () => {
      expect(calculateTier(99)).toBe("Bronze");
      expect(calculateTier(100)).toBe("Silver");
      expect(calculateTier(199)).toBe("Silver");
      expect(calculateTier(200)).toBe("Gold");
      expect(calculateTier(300)).toBe("Platinum");
    });
  });

  describe("calculateLevelTierProgress", () => {
    it("negative weeklyXpTotal clamped to 0 (level 1, progress 0)", () => {
      const r = calculateLevelTierProgress(-1);
      expect(r.level).toBe(1);
      expect(r.progressInLevel).toBe(0);
      expect(r.progressPct).toBe(0);
    });
    it("progressPct at 0 is 0, at 99 is 0.99, at 100 starts next level", () => {
      const at0 = calculateLevelTierProgress(0);
      expect(at0.level).toBe(1);
      expect(at0.tier).toBe("Bronze");
      expect(at0.progressInLevel).toBe(0);
      expect(at0.progressPct).toBe(0);
      const at99 = calculateLevelTierProgress(99);
      expect(at99.level).toBe(1);
      expect(at99.progressInLevel).toBe(99);
      expect(at99.progressPct).toBe(0.99);
      const at100 = calculateLevelTierProgress(100);
      expect(at100.level).toBe(2);
      expect(at100.tier).toBe("Silver");
      expect(at100.progressInLevel).toBe(0);
      expect(at100.progressPct).toBe(0);
    });
  });

  describe("seasonReset", () => {
    it("floors coreXp and sets weeklyXp to 0", () => {
      const r = seasonReset({ coreXp: 100.7, weeklyXp: 50 });
      expect(r.coreXp).toBe(100);
      expect(r.weeklyXp).toBe(0);
    });
  });

  describe("leaderboardSort", () => {
    it("handles empty array", () => {
      const sorted = leaderboardSort([]);
      expect(sorted).toEqual([]);
    });
    it("handles undefined xpTotal with 0 for sort", () => {
      const entries: LeaderboardEntry[] = [
        { userId: "a", xpTotal: 10 },
        { userId: "b" } as LeaderboardEntry,
        { userId: "c", xpTotal: 5 },
      ];
      const sorted = leaderboardSort(entries);
      expect(sorted[0].userId).toBe("a");
      expect(sorted[1].userId).toBe("c");
      expect(sorted[2].userId).toBe("b");
    });
  });
});
