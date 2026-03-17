/**
 * XP 도메인 경계 테스트.
 * xp.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { seasonalToCoreConversion } from "./xp";

describe("domain/rules/xp (edges)", () => {
  it("seasonalToCoreConversion returns rate, coreGain, fractionalBuffer", () => {
    const r = seasonalToCoreConversion(10, 0);
    expect(Object.keys(r).sort()).toEqual(["coreGain", "fractionalBuffer", "rate"].sort());
  });

  it("seasonalEarned 0 yields coreGain 0 and fractionalBuffer 0", () => {
    const r = seasonalToCoreConversion(0, 100);
    expect(r.coreGain).toBe(0);
    expect(r.fractionalBuffer).toBe(0);
    expect(r.rate).toBe(45);
  });

  it("currentCoreXp exactly 200 uses default rate 60 (not beginner 45)", () => {
    const r = seasonalToCoreConversion(60, 200);
    expect(r.rate).toBe(60);
    expect(r.coreGain).toBe(1);
  });

  it("rate is positive and coreGain is non-negative", () => {
    const r = seasonalToCoreConversion(100, 0);
    expect(r.rate).toBeGreaterThan(0);
    expect(r.coreGain).toBeGreaterThanOrEqual(0);
  });

  it("fractionalBuffer is number", () => {
    const r = seasonalToCoreConversion(10, 0);
    expect(typeof r.fractionalBuffer).toBe("number");
  });
});
