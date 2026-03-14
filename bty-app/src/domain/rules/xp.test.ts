import { describe, it, expect } from "vitest";
import { seasonalToCoreConversion } from "./xp";

describe("domain/rules/xp", () => {
  describe("seasonalToCoreConversion", () => {
    it("uses beginner rate 45:1 when currentCoreXp < 200", () => {
      const r = seasonalToCoreConversion(90, 100);
      expect(r.rate).toBe(45);
      expect(r.coreGain).toBe(2);
      expect(r.fractionalBuffer).toBeCloseTo(0);
    });

    it("uses standard rate 60:1 when currentCoreXp >= 200", () => {
      const r = seasonalToCoreConversion(120, 200);
      expect(r.rate).toBe(60);
      expect(r.coreGain).toBe(2);
      expect(r.fractionalBuffer).toBe(0);
    });

    it("floors core gain and returns fractional remainder in buffer", () => {
      const r = seasonalToCoreConversion(100, 300);
      expect(r.rate).toBe(60);
      expect(r.coreGain).toBe(1);
      expect(r.fractionalBuffer).toBeCloseTo(100 / 60 - 1, 10);
    });

    it("returns zero coreGain and full amount as buffer when seasonal is below rate", () => {
      const r = seasonalToCoreConversion(30, 300);
      expect(r.coreGain).toBe(0);
      expect(r.fractionalBuffer).toBeCloseTo(0.5, 10);
    });

    it("uses beginner rate at core 199 and standard rate at core 200 (boundary)", () => {
      const r199 = seasonalToCoreConversion(90, 199);
      expect(r199.rate).toBe(45);
      expect(r199.coreGain).toBe(2);
      const r200 = seasonalToCoreConversion(120, 200);
      expect(r200.rate).toBe(60);
      expect(r200.coreGain).toBe(2);
    });

    it("returns 0 coreGain and 0 buffer when seasonalEarned is 0", () => {
      const r = seasonalToCoreConversion(0, 100);
      expect(r.rate).toBe(45);
      expect(r.coreGain).toBe(0);
      expect(r.fractionalBuffer).toBe(0);
      const r2 = seasonalToCoreConversion(0, 300);
      expect(r2.rate).toBe(60);
      expect(r2.coreGain).toBe(0);
      expect(r2.fractionalBuffer).toBe(0);
    });
  });
});
