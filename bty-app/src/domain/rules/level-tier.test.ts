import { describe, it, expect } from "vitest";
import {
  tierFromCoreXp,
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  codeNameFromIndex,
  stageFromCoreXp,
} from "./level-tier";

describe("domain/rules/level-tier", () => {
  describe("tierFromCoreXp", () => {
    it("returns floor(coreXp / 10), min 0", () => {
      expect(tierFromCoreXp(0)).toBe(0);
      expect(tierFromCoreXp(9)).toBe(0);
      expect(tierFromCoreXp(10)).toBe(1);
      expect(tierFromCoreXp(250)).toBe(25);
      expect(tierFromCoreXp(999)).toBe(99);
    });
  });

  describe("codeIndexFromTier", () => {
    it("returns 0..6 from tier (100 tiers per code)", () => {
      expect(codeIndexFromTier(0)).toBe(0);
      expect(codeIndexFromTier(99)).toBe(0);
      expect(codeIndexFromTier(100)).toBe(1);
      expect(codeIndexFromTier(699)).toBe(6);
      expect(codeIndexFromTier(700)).toBe(6);
    });
  });

  describe("subTierGroupFromTier", () => {
    it("returns 0..3 within code (25 tiers per group)", () => {
      expect(subTierGroupFromTier(0)).toBe(0);
      expect(subTierGroupFromTier(24)).toBe(0);
      expect(subTierGroupFromTier(25)).toBe(1);
      expect(subTierGroupFromTier(49)).toBe(1);
      expect(subTierGroupFromTier(75)).toBe(3);
    });
  });

  describe("resolveSubName", () => {
    it("returns custom when non-empty", () => {
      expect(resolveSubName(0, 0, "Custom")).toBe("Custom");
      expect(resolveSubName(0, 0, "  Trim  ")).toBe("Trim");
    });

    it("returns default for code 0 subTierGroup 0", () => {
      expect(resolveSubName(0, 0, null)).toBe("Spark");
      expect(resolveSubName(0, 0, "")).toBe("Spark");
    });

    it("returns fallback for CODELESS ZONE (code 6) when no custom", () => {
      expect(resolveSubName(6, 0, null)).toBe("—");
    });
  });

  describe("codeNameFromIndex", () => {
    it("returns CODE_NAMES for index 0..6", () => {
      expect(codeNameFromIndex(0)).toBe("FORGE");
      expect(codeNameFromIndex(6)).toBe("CODELESS ZONE");
    });
  });

  describe("stageFromCoreXp", () => {
    it("returns 1..7 from core XP (floor(coreXp/100)+1, cap 7)", () => {
      expect(stageFromCoreXp(0)).toBe(1);
      expect(stageFromCoreXp(99)).toBe(1);
      expect(stageFromCoreXp(100)).toBe(2);
      expect(stageFromCoreXp(600)).toBe(7);
      expect(stageFromCoreXp(9999)).toBe(7);
    });
  });
});
