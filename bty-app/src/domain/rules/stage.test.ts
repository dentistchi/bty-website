import { describe, it, expect } from "vitest";
import {
  codeIndexFromTier,
  subTierGroupFromTier,
  stageNumberFromCoreXp,
  codeNameFromIndex,
  defaultSubName,
  resolveSubName,
  stageStateFromCoreXp,
} from "./stage";

describe("domain/rules/stage", () => {
  describe("codeIndexFromTier", () => {
    it("returns 0..6 (100 tiers per code)", () => {
      expect(codeIndexFromTier(0)).toBe(0);
      expect(codeIndexFromTier(99)).toBe(0);
      expect(codeIndexFromTier(100)).toBe(1);
      expect(codeIndexFromTier(600)).toBe(6);
    });
  });

  describe("subTierGroupFromTier", () => {
    it("returns 0..3 (25 tiers per group)", () => {
      expect(subTierGroupFromTier(0)).toBe(0);
      expect(subTierGroupFromTier(25)).toBe(1);
      expect(subTierGroupFromTier(50)).toBe(2);
      expect(subTierGroupFromTier(75)).toBe(3);
    });
  });

  describe("stageNumberFromCoreXp", () => {
    it("returns 1..7 (floor(coreXp/100)+1, cap 7)", () => {
      expect(stageNumberFromCoreXp(0)).toBe(1);
      expect(stageNumberFromCoreXp(100)).toBe(2);
      expect(stageNumberFromCoreXp(600)).toBe(7);
      expect(stageNumberFromCoreXp(9999)).toBe(7);
    });
  });

  describe("codeNameFromIndex", () => {
    it("returns CODE_NAMES for index 0..6", () => {
      expect(codeNameFromIndex(0)).toBe("FORGE");
      expect(codeNameFromIndex(6)).toBe("CODELESS ZONE");
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

  describe("resolveSubName", () => {
    it("returns custom when non-empty", () => {
      expect(resolveSubName(0, 0, "Custom")).toBe("Custom");
    });
    it("returns default when custom null/empty", () => {
      expect(resolveSubName(0, 0, null)).toBe("Spark");
    });
    it("returns fallback for code 6 when no custom", () => {
      expect(resolveSubName(6, 0, null)).toBe("—");
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
