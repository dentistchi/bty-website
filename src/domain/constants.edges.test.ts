/**
 * domain/constants — 경계 테스트.
 * constants.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  CORE_XP_PER_CODE,
  TIERS_PER_CODE,
  CORE_XP_PER_TIER,
  LEAGUE_CARRYOVER_FRACTION,
} from "./constants";

describe("domain/constants (edges)", () => {
  it("CORE_XP_PER_CODE equals TIERS_PER_CODE * CORE_XP_PER_TIER", () => {
    expect(CORE_XP_PER_CODE).toBe(TIERS_PER_CODE * CORE_XP_PER_TIER);
  });

  it("LEAGUE_CARRYOVER_FRACTION is in (0, 1]", () => {
    expect(LEAGUE_CARRYOVER_FRACTION).toBeGreaterThan(0);
    expect(LEAGUE_CARRYOVER_FRACTION).toBeLessThanOrEqual(1);
  });

  it("CORE_XP_PER_TIER and TIERS_PER_CODE are positive", () => {
    expect(CORE_XP_PER_TIER).toBeGreaterThan(0);
    expect(TIERS_PER_CODE).toBeGreaterThan(0);
  });

  it("CORE_XP_PER_CODE is positive", () => {
    expect(CORE_XP_PER_CODE).toBeGreaterThan(0);
  });

  it("CORE_XP_PER_TIER and TIERS_PER_CODE are finite", () => {
    expect(Number.isFinite(CORE_XP_PER_TIER)).toBe(true);
    expect(Number.isFinite(TIERS_PER_CODE)).toBe(true);
  });
});
