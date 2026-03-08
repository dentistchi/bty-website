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

describe("lib/bty/arena/domain", () => {
  describe("awardXp", () => {
    it("uses 45:1 rate when coreXp < 200 (beginner)", () => {
      const result = awardXp({ coreXp: 100, weeklyXp: 0, earnedSeasonalXp: 90 });
      expect(result.newCoreXp).toBe(102); // 90/45 = 2
      expect(result.newWeeklyXp).toBe(90);
    });
    it("uses 60:1 rate when coreXp >= 200", () => {
      const result = awardXp({ coreXp: 200, weeklyXp: 50, earnedSeasonalXp: 120 });
      expect(result.newCoreXp).toBe(202); // 120/60 = 2
      expect(result.newWeeklyXp).toBe(170);
    });
    it("floors negative/zero earned to 0", () => {
      const result = awardXp({ coreXp: 0, weeklyXp: 0, earnedSeasonalXp: -10 });
      expect(result.newCoreXp).toBe(0);
      expect(result.newWeeklyXp).toBe(0);
    });
  });

  describe("calculateLevel", () => {
    it("level = floor(weeklyXpTotal/100) + 1", () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(299)).toBe(3);
    });
  });

  describe("calculateTier", () => {
    it("0–99 Bronze, 100–199 Silver, 200–299 Gold, 300+ Platinum", () => {
      expect(calculateTier(0)).toBe("Bronze");
      expect(calculateTier(99)).toBe("Bronze");
      expect(calculateTier(100)).toBe("Silver");
      expect(calculateTier(199)).toBe("Silver");
      expect(calculateTier(200)).toBe("Gold");
      expect(calculateTier(299)).toBe("Gold");
      expect(calculateTier(300)).toBe("Platinum");
    });
  });

  describe("calculateLevelTierProgress", () => {
    it("returns level, tier, progressInLevel, progressPct", () => {
      const p = calculateLevelTierProgress(150);
      expect(p.level).toBe(2);
      expect(p.tier).toBe("Silver");
      expect(p.progressInLevel).toBe(50);
      expect(p.progressPct).toBe(0.5);
    });
  });

  describe("seasonReset", () => {
    it("keeps coreXp, sets weeklyXp to 0", () => {
      const result = seasonReset({ coreXp: 500, weeklyXp: 100 });
      expect(result.coreXp).toBe(500);
      expect(result.weeklyXp).toBe(0);
    });
  });

  describe("leaderboardSort", () => {
    it("sorts by xpTotal descending, does not mutate input", () => {
      const entries: LeaderboardEntry[] = [
        { userId: "a", xpTotal: 50 },
        { userId: "b", xpTotal: 200 },
        { userId: "c", xpTotal: 100 },
      ];
      const sorted = leaderboardSort(entries);
      expect(sorted.map((e) => e.xpTotal)).toEqual([200, 100, 50]);
      expect(entries[0].xpTotal).toBe(50);
    });
  });
});
