/**
 * domain/index — barrel re-exports 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import * as domain from "./index";

describe("domain/index", () => {
  it("re-exports constants", () => {
    expect(domain.CORE_XP_PER_TIER).toBe(10);
    expect(domain.CODE_NAMES).toBeDefined();
    expect(domain.CODE_NAMES).toHaveLength(7);
  });

  it("re-exports dojo flow helpers", () => {
    expect(typeof domain.validateDojo50Submit).toBe("function");
    expect(typeof domain.computeDojo50Result).toBe("function");
    expect(domain.DOJO_50_AREAS).toBeDefined();
  });

  it("re-exports rules", () => {
    expect(domain.tierFromCoreXp).toBeDefined();
    expect(typeof domain.tierFromCoreXp).toBe("function");
  });

  it("re-exports dashboard RECOMMENDATION_SOURCE_ORDER (C3 도메인)", () => {
    expect(domain.RECOMMENDATION_SOURCE_ORDER).toEqual(["arena", "foundry", "center"]);
  });

  it("re-exports SEASON_CARRYOVER_FRACTION from constants (C3 도메인)", () => {
    expect(domain.SEASON_CARRYOVER_FRACTION).toBe(0.1);
  });

  it("re-exports leadership-engine + foundry barrel (AIR stage threshold, STAGE_1)", () => {
    expect(domain.AIR_THRESHOLD_STAGE_ESCALATION).toBe(0.4);
    expect(domain.STAGE_1).toBe(1);
    expect(typeof domain.validateDojo50Submit).toBe("function");
  });

  it("re-exports arena tiebreak + center letter + healing phase (barrel 232)", () => {
    expect(typeof domain.rankByWeeklyXpWithTieBreak).toBe("function");
    expect(domain.validateLetterBody("x").ok).toBe(true);
    expect(domain.HEALING_PHASE_I_LABEL).toBe("Phase I");
  });

  it("re-exports leadership-engine STAGE_PROGRESS + AIR bands via barrel (233)", () => {
    expect(domain.STAGE_PROGRESS_PERCENT).toBeDefined();
    expect(domain.STAGE_PROGRESS_PERCENT?.[1]).toBe(25);
    expect(domain.AIR_BAND_IDS).toEqual(["low", "mid", "high"]);
  });

  it("barrel 234: LE forced-reset + center letter/resilience + healing vs dojo", () => {
    expect(typeof domain.evaluateForcedReset).toBe("function");
    expect(domain.energyToLevel(5)).toBe("high");
    expect(domain.LETTER_BODY_MAX_LENGTH).toBe(10_000);
    expect(domain.AWAKENING_ACT_NAMES[1]).toBe("Reflection Chamber");
    expect(domain.DOJO_50_AREAS).toHaveLength(5);
  });
});
