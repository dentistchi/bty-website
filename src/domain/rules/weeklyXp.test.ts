import { describe, it, expect } from "vitest";
import {
  awardXp,
  calculateLevel,
  calculateTier,
  calculateLevelTierProgress,
  seasonReset,
  leaderboardSort,
  WEEKLY_LEVEL_STEP,
  WEEKLY_TIER_SILVER_MIN,
  WEEKLY_TIER_GOLD_MIN,
  WEEKLY_TIER_PLATINUM_MIN,
  type LeaderboardEntry,
} from "./weeklyXp";

describe("domain/rules/weeklyXp", () => {
  describe("awardXp", () => {
    it("uses 45:1 rate when coreXp < 200", () => {
      const r = awardXp({ coreXp: 100, weeklyXp: 0, earnedSeasonalXp: 90 });
      expect(r.newCoreXp).toBe(102);
      expect(r.newWeeklyXp).toBe(90);
    });

    it("uses 60:1 rate when coreXp >= 200", () => {
      const r = awardXp({ coreXp: 200, weeklyXp: 50, earnedSeasonalXp: 120 });
      expect(r.newCoreXp).toBe(202);
      expect(r.newWeeklyXp).toBe(170);
    });

    it("floors negative/zero earned to 0", () => {
      const r = awardXp({ coreXp: 0, weeklyXp: 0, earnedSeasonalXp: -10 });
      expect(r.newCoreXp).toBe(0);
      expect(r.newWeeklyXp).toBe(0);
    });

    it("rate boundary: 199 → 45:1, 200 → 60:1", () => {
      const at199 = awardXp({ coreXp: 199, weeklyXp: 0, earnedSeasonalXp: 45 });
      expect(at199.newCoreXp).toBe(200);
      const at200 = awardXp({ coreXp: 200, weeklyXp: 0, earnedSeasonalXp: 60 });
      expect(at200.newCoreXp).toBe(201);
    });

    it("floors fractional inputs", () => {
      const r = awardXp({ coreXp: 100.9, weeklyXp: 10.5, earnedSeasonalXp: 44.7 });
      expect(r.newCoreXp).toBe(100);
      expect(r.newWeeklyXp).toBe(54);
    });
  });

  describe("calculateLevel", () => {
    it("level = floor(weeklyXp / 100) + 1", () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(299)).toBe(3);
      expect(calculateLevel(1000)).toBe(11);
    });

    it("negative input clamps to level 1", () => {
      expect(calculateLevel(-50)).toBe(1);
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
      expect(calculateTier(9999)).toBe("Platinum");
    });

    it("negative input returns Bronze", () => {
      expect(calculateTier(-100)).toBe("Bronze");
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

    it("at exact boundary (200), progress is 0", () => {
      const p = calculateLevelTierProgress(200);
      expect(p.level).toBe(3);
      expect(p.tier).toBe("Gold");
      expect(p.progressInLevel).toBe(0);
      expect(p.progressPct).toBe(0);
    });

    it("at 0, level 1 Bronze 0%", () => {
      const p = calculateLevelTierProgress(0);
      expect(p.level).toBe(1);
      expect(p.tier).toBe("Bronze");
      expect(p.progressPct).toBe(0);
    });
  });

  describe("seasonReset", () => {
    it("keeps coreXp, sets weeklyXp to 0", () => {
      const r = seasonReset({ coreXp: 500, weeklyXp: 100 });
      expect(r.coreXp).toBe(500);
      expect(r.weeklyXp).toBe(0);
    });

    it("floors coreXp", () => {
      const r = seasonReset({ coreXp: 100.7, weeklyXp: 50 });
      expect(r.coreXp).toBe(100);
      expect(r.weeklyXp).toBe(0);
    });

    it("clamps negative coreXp to 0", () => {
      const r = seasonReset({ coreXp: -10, weeklyXp: 50 });
      expect(r.coreXp).toBe(0);
      expect(r.weeklyXp).toBe(0);
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

    it("handles empty array", () => {
      expect(leaderboardSort([])).toEqual([]);
    });

    it("handles undefined xpTotal as 0", () => {
      const entries: LeaderboardEntry[] = [
        { userId: "a", xpTotal: 10 },
        { userId: "b" } as LeaderboardEntry,
      ];
      const sorted = leaderboardSort(entries);
      expect(sorted[0].userId).toBe("a");
      expect(sorted[1].userId).toBe("b");
    });
  });

  describe("weekly tier constants (C3 rules 도메인)", () => {
    it("WEEKLY_LEVEL_STEP is 100 and tier mins are multiples", () => {
      expect(WEEKLY_LEVEL_STEP).toBe(100);
      expect(WEEKLY_TIER_SILVER_MIN).toBe(100);
      expect(WEEKLY_TIER_GOLD_MIN).toBe(200);
      expect(WEEKLY_TIER_PLATINUM_MIN).toBe(300);
    });
  });
});
