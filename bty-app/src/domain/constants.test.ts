import { describe, it, expect } from "vitest";
import {
  CODE_NAMES,
  SUB_NAMES,
  CORE_XP_PER_TIER,
  TIERS_PER_CODE,
  CORE_XP_PER_CODE,
  BEGINNER_CORE_XP_THRESHOLD,
  SEASONAL_TO_CORE_RATE_BEGINNER,
  SEASONAL_TO_CORE_RATE_STANDARD,
  LEAGUE_WINDOW_DAYS,
  LEAGUE_CARRYOVER_FRACTION,
  ELITE_TOP_FRACTION,
  ELITE_MIN_USERS,
} from "./constants";

describe("domain/constants", () => {
  describe("CODE_NAMES", () => {
    it("has 7 entries (code index 0–6)", () => {
      expect(CODE_NAMES).toHaveLength(7);
    });
    it("first is FORGE, last is CODELESS ZONE", () => {
      expect(CODE_NAMES[0]).toBe("FORGE");
      expect(CODE_NAMES[6]).toBe("CODELESS ZONE");
    });
  });

  describe("SUB_NAMES", () => {
    it("has entries for code index 0–6", () => {
      expect(Object.keys(SUB_NAMES)).toHaveLength(7);
      for (let i = 0; i <= 6; i++) {
        expect(SUB_NAMES[i as keyof typeof SUB_NAMES]).toBeDefined();
      }
    });
    it("code 6 (CODELESS ZONE) has null sub names", () => {
      expect(SUB_NAMES[6]).toBeNull();
    });
    it("code 0 has 4 sub names (Spark, Ember, Flame, Inferno)", () => {
      const row = SUB_NAMES[0];
      expect(row).toHaveLength(4);
      expect(row).toEqual(["Spark", "Ember", "Flame", "Inferno"]);
    });
  });

  describe("XP & Tier constants", () => {
    it("CORE_XP_PER_TIER is 10", () => {
      expect(CORE_XP_PER_TIER).toBe(10);
    });
    it("TIERS_PER_CODE is 100", () => {
      expect(TIERS_PER_CODE).toBe(100);
    });
    it("CORE_XP_PER_CODE equals TIERS_PER_CODE * CORE_XP_PER_TIER", () => {
      expect(CORE_XP_PER_CODE).toBe(TIERS_PER_CODE * CORE_XP_PER_TIER);
    });
    it("BEGINNER_CORE_XP_THRESHOLD is 200", () => {
      expect(BEGINNER_CORE_XP_THRESHOLD).toBe(200);
    });
    it("seasonal-to-core rates are positive", () => {
      expect(SEASONAL_TO_CORE_RATE_BEGINNER).toBe(45);
      expect(SEASONAL_TO_CORE_RATE_STANDARD).toBe(60);
    });
  });

  describe("League / Season constants", () => {
    it("LEAGUE_WINDOW_DAYS is 30", () => {
      expect(LEAGUE_WINDOW_DAYS).toBe(30);
    });
    it("LEAGUE_CARRYOVER_FRACTION is 0–1", () => {
      expect(LEAGUE_CARRYOVER_FRACTION).toBeGreaterThanOrEqual(0);
      expect(LEAGUE_CARRYOVER_FRACTION).toBeLessThanOrEqual(1);
      expect(LEAGUE_CARRYOVER_FRACTION).toBe(0.1);
    });
  });

  describe("Leaderboard constants", () => {
    it("ELITE_TOP_FRACTION is 0.05", () => {
      expect(ELITE_TOP_FRACTION).toBe(0.05);
    });
    it("ELITE_MIN_USERS is at least 1", () => {
      expect(ELITE_MIN_USERS).toBeGreaterThanOrEqual(1);
      expect(ELITE_MIN_USERS).toBe(1);
    });
  });
});
