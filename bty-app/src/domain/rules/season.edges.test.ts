/**
 * Season 도메인 경계 테스트.
 * season.test.ts와 중복 없이 경계·엣지만.
 */
import { describe, it, expect } from "vitest";
import { isDateWithinSeason, carryoverWeeklyXp } from "./season";
import type { SeasonWindow } from "../types";

describe("domain/rules/season (edges)", () => {
  it("isDateWithinSeason returns true when startDate equals endDate (single-day window)", () => {
    const window: SeasonWindow = {
      id: "single",
      startDate: "2026-06-15",
      endDate: "2026-06-15",
    };
    expect(isDateWithinSeason("2026-06-15", window)).toBe(true);
    expect(isDateWithinSeason("2026-06-14", window)).toBe(false);
    expect(isDateWithinSeason("2026-06-16", window)).toBe(false);
  });

  it("carryoverWeeklyXp returns 0 for zero input", () => {
    expect(carryoverWeeklyXp(0)).toBe(0);
  });

  it("carryoverWeeklyXp with 10 weeklyXp yields 1 (0.1 fraction boundary)", () => {
    expect(carryoverWeeklyXp(10)).toBe(1);
  });

  it("carryoverWeeklyXp with positive weeklyXp returns non-negative floor", () => {
    const result = carryoverWeeklyXp(100);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("carryoverWeeklyXp floors negative input (boundary: domain does not clamp)", () => {
    expect(carryoverWeeklyXp(-1)).toBe(Math.floor(-0.1));
    expect(carryoverWeeklyXp(-10)).toBe(-1);
  });

  it("isDateWithinSeason rejects date before start when dates are adjacent", () => {
    const window: SeasonWindow = { id: "adj", startDate: "2026-01-02", endDate: "2026-01-02" };
    expect(isDateWithinSeason("2026-01-01", window)).toBe(false);
  });

  it("isDateWithinSeason returns true for first and last day of multi-day window", () => {
    const window: SeasonWindow = { id: "multi", startDate: "2026-01-01", endDate: "2026-01-31" };
    expect(isDateWithinSeason("2026-01-01", window)).toBe(true);
    expect(isDateWithinSeason("2026-01-31", window)).toBe(true);
    expect(isDateWithinSeason("2026-01-15", window)).toBe(true);
    expect(isDateWithinSeason("2025-12-31", window)).toBe(false);
    expect(isDateWithinSeason("2026-02-01", window)).toBe(false);
  });
});
