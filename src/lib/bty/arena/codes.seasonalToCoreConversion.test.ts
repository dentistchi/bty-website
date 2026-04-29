/**
 * Unit tests for seasonalToCoreConversion from Arena codes module.
 * Verifies existing behavior only; no business/XP logic change.
 * Rate 45 when core < 200 (Beginner boost), else 60:1.
 */
import { describe, it, expect } from "vitest";
import { seasonalToCoreConversion } from "./codes";

describe("seasonalToCoreConversion (Arena codes)", () => {
  it("uses rate 45 when currentCoreXp < 200", () => {
    const r = seasonalToCoreConversion(90, 0);
    expect(r.rate).toBe(45);
    expect(r.coreGain).toBe(2);
    expect(r.fractionalBuffer).toBe(0);
  });

  it("uses rate 60 when currentCoreXp >= 200", () => {
    const r = seasonalToCoreConversion(120, 200);
    expect(r.rate).toBe(60);
    expect(r.coreGain).toBe(2);
    expect(r.fractionalBuffer).toBe(0);
  });

  it("boundary at 199 uses rate 45, at 200 uses rate 60", () => {
    const r199 = seasonalToCoreConversion(90, 199);
    expect(r199.rate).toBe(45);
    const r200 = seasonalToCoreConversion(120, 200);
    expect(r200.rate).toBe(60);
  });

  it("coreGain is floor(seasonalEarned / rate)", () => {
    expect(seasonalToCoreConversion(44, 300).coreGain).toBe(0);
    expect(seasonalToCoreConversion(60, 300).coreGain).toBe(1);
    expect(seasonalToCoreConversion(119, 300).coreGain).toBe(1);
    expect(seasonalToCoreConversion(120, 300).coreGain).toBe(2);
  });

  it("fractionalBuffer is remainder 0 <= x < 1", () => {
    const r = seasonalToCoreConversion(30, 300);
    expect(r.coreGain).toBe(0);
    expect(r.fractionalBuffer).toBe(0.5);
    expect(r.fractionalBuffer).toBeGreaterThanOrEqual(0);
    expect(r.fractionalBuffer).toBeLessThan(1);
  });
});
