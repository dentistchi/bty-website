import { describe, it, expect } from "vitest";
import {
  stageNumberFromCoreXp,
  defaultSubName,
  stageStateFromCoreXp,
} from "./stage";

describe("domain/rules/stage", () => {
  describe("stageNumberFromCoreXp", () => {
    it("returns 1..7 (floor(coreXp/100)+1, cap 7)", () => {
      expect(stageNumberFromCoreXp(0)).toBe(1);
      expect(stageNumberFromCoreXp(100)).toBe(2);
      expect(stageNumberFromCoreXp(600)).toBe(7);
      expect(stageNumberFromCoreXp(9999)).toBe(7);
    });
    it("clamps negative coreXp to 0 and returns stage 1", () => {
      expect(stageNumberFromCoreXp(-1)).toBe(1);
      expect(stageNumberFromCoreXp(-100)).toBe(1);
    });
  });

  describe("defaultSubName", () => {
    it("returns default for code 0", () => {
      expect(defaultSubName(0, 0)).toBe("Spark");
      expect(defaultSubName(0, 3)).toBe("Inferno");
    });
    it("returns null for CODELESS ZONE (code 6)", () => {
      expect(defaultSubName(6, 0)).toBeNull();
    });
  });

  describe("stageStateFromCoreXp", () => {
    it("returns full state from core XP", () => {
      const s = stageStateFromCoreXp(0, null);
      expect(s.tier).toBe(0);
      expect(s.codeIndex).toBe(0);
      expect(s.stageNumber).toBe(1);
      expect(s.codeName).toBe("FORGE");
      expect(s.subName).toBe("Spark");
    });
    it("uses custom sub name when provided", () => {
      const s = stageStateFromCoreXp(250, "My Name");
      expect(s.subName).toBe("My Name");
    });
  });
});
