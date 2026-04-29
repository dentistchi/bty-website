/**
 * dentalRpg — RARITY_MIN/MAX, RARITY_LEVELS, EQUIPMENT_LEVEL_MIN/MAX, EQUIPMENT_LEVELS·타입 검증.
 */
import { describe, it, expect } from "vitest";
import {
  RARITY_MIN,
  RARITY_MAX,
  RARITY_LEVELS,
  EQUIPMENT_LEVEL_MIN,
  EQUIPMENT_LEVEL_MAX,
  EQUIPMENT_LEVELS,
  type RarityLevel,
  type EquipmentLevel,
} from "./dentalRpg";

describe("dentalRpg", () => {
  describe("rarity constants", () => {
    it("RARITY_MIN is 1, RARITY_MAX is 5", () => {
      expect(RARITY_MIN).toBe(1);
      expect(RARITY_MAX).toBe(5);
    });

    it("RARITY_LEVELS is [1,2,3,4,5]", () => {
      expect(RARITY_LEVELS).toEqual([1, 2, 3, 4, 5]);
      expect(RARITY_LEVELS).toHaveLength(5);
    });

    it("every RARITY_LEVELS element is valid RarityLevel (1–5)", () => {
      const valid: RarityLevel[] = [1, 2, 3, 4, 5];
      for (const r of RARITY_LEVELS) {
        expect(valid).toContain(r);
        expect(r).toBeGreaterThanOrEqual(RARITY_MIN);
        expect(r).toBeLessThanOrEqual(RARITY_MAX);
      }
    });
  });

  describe("equipment level constants", () => {
    it("EQUIPMENT_LEVEL_MIN is 1, EQUIPMENT_LEVEL_MAX is 5", () => {
      expect(EQUIPMENT_LEVEL_MIN).toBe(1);
      expect(EQUIPMENT_LEVEL_MAX).toBe(5);
    });

    it("EQUIPMENT_LEVELS is [1,2,3,4,5]", () => {
      expect(EQUIPMENT_LEVELS).toEqual([1, 2, 3, 4, 5]);
      expect(EQUIPMENT_LEVELS).toHaveLength(5);
    });

    it("every EQUIPMENT_LEVELS element is 1–5", () => {
      for (const l of EQUIPMENT_LEVELS) {
        expect(l).toBeGreaterThanOrEqual(EQUIPMENT_LEVEL_MIN);
        expect(l).toBeLessThanOrEqual(EQUIPMENT_LEVEL_MAX);
      }
    });

    it("EquipmentLevel type covers EQUIPMENT_LEVELS values", () => {
      const levels: EquipmentLevel[] = [...EQUIPMENT_LEVELS];
      expect(levels).toHaveLength(5);
      expect(levels).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
