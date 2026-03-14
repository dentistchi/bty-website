/**
 * XP 도메인 경계 테스트.
 * xp.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { seasonalToCoreConversion } from "./xp";

describe("domain/rules/xp (edges)", () => {
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
});
