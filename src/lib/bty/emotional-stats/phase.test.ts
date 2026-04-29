/**
 * v3 acceleration_first_30_days and phase_tuning (healing-coaching-spec-v3.json).
 */
import { describe, it, expect } from "vitest";
import {
  getAccelerationFactor,
  getPhaseMultiplier,
  getConsistencyCap,
} from "./phase";

describe("getAccelerationFactor", () => {
  it("returns 1 for day 0 or after 30", () => {
    expect(getAccelerationFactor(0)).toBe(1);
    expect(getAccelerationFactor(31)).toBe(1);
    expect(getAccelerationFactor(100)).toBe(1);
  });
  it("applies acc = 1.25 - (user_day/100) for day 1–30, clamped [0.5, 1.25]", () => {
    expect(getAccelerationFactor(1)).toBeCloseTo(1.25 - 1 / 100);
    expect(getAccelerationFactor(25)).toBeCloseTo(1.25 - 25 / 100);
    expect(getAccelerationFactor(30)).toBeCloseTo(1.25 - 30 / 100);
    expect(getAccelerationFactor(100)).toBe(1);
  });
  it("for userDay 1–30 result is in [0.5, 1.25]; day 30 is lowest in range", () => {
    expect(getAccelerationFactor(30)).toBeCloseTo(1.25 - 30 / 100);
    expect(getAccelerationFactor(30)).toBeGreaterThanOrEqual(0.5);
    expect(getAccelerationFactor(1)).toBeLessThanOrEqual(1.25);
  });
});

describe("getPhaseMultiplier", () => {
  it("day 1–7: 1.2, 8–21: 1, 22–30: 0.9", () => {
    expect(getPhaseMultiplier(1)).toBe(1.2);
    expect(getPhaseMultiplier(7)).toBe(1.2);
    expect(getPhaseMultiplier(8)).toBe(1);
    expect(getPhaseMultiplier(21)).toBe(1);
    expect(getPhaseMultiplier(22)).toBe(0.9);
    expect(getPhaseMultiplier(30)).toBe(0.9);
  });
  it("after 30: post_30_day_normalization 0.85", () => {
    expect(getPhaseMultiplier(31)).toBe(0.85);
    expect(getPhaseMultiplier(100)).toBe(0.85);
  });
  it("day 0: 1", () => {
    expect(getPhaseMultiplier(0)).toBe(1);
  });
});

describe("getConsistencyCap", () => {
  it("day 1–7: 1.4, 8–21: 1.3, 22–30: 1.2", () => {
    expect(getConsistencyCap(1)).toBe(1.4);
    expect(getConsistencyCap(7)).toBe(1.4);
    expect(getConsistencyCap(8)).toBe(1.3);
    expect(getConsistencyCap(21)).toBe(1.3);
    expect(getConsistencyCap(22)).toBe(1.2);
    expect(getConsistencyCap(30)).toBe(1.2);
  });
  it("after 30: 1.4", () => {
    expect(getConsistencyCap(31)).toBe(1.4);
  });
});
