import { describe, it, expect } from "vitest";
import { isDateWithinSeason, carryoverWeeklyXp } from "./season";

describe("domain/rules/season", () => {
  describe("isDateWithinSeason", () => {
    const window = { id: "test-season", startDate: "2026-01-01", endDate: "2026-01-31" };

    it("returns true when date is within window (inclusive)", () => {
      expect(isDateWithinSeason("2026-01-01", window)).toBe(true);
      expect(isDateWithinSeason("2026-01-15", window)).toBe(true);
      expect(isDateWithinSeason("2026-01-31", window)).toBe(true);
    });

    it("returns false when date is before start", () => {
      expect(isDateWithinSeason("2025-12-31", window)).toBe(false);
    });

    it("returns false when date is after end", () => {
      expect(isDateWithinSeason("2026-02-01", window)).toBe(false);
    });
  });

  describe("carryoverWeeklyXp", () => {
    it("returns floor(weeklyXpTotal * 0.1) for season carryover", () => {
      expect(carryoverWeeklyXp(0)).toBe(0);
      expect(carryoverWeeklyXp(100)).toBe(10);
      expect(carryoverWeeklyXp(99)).toBe(9);
      expect(carryoverWeeklyXp(1000)).toBe(100);
    });

    it("floors fractional weeklyXpTotal", () => {
      expect(carryoverWeeklyXp(15.9)).toBe(1);
      expect(carryoverWeeklyXp(100.4)).toBe(10);
    });
  });
});
