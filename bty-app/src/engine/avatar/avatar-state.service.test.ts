import { describe, it, expect } from "vitest";
import { computeTier, nextAvatarTierProgress, unlockedAssetsForTier } from "./avatar-state.service";

describe("avatar-state.service", () => {
  describe("computeTier", () => {
    it("maps thresholds 0/500/1500/3500/7000", () => {
      expect(computeTier(0)).toBe(0);
      expect(computeTier(499)).toBe(0);
      expect(computeTier(500)).toBe(1);
      expect(computeTier(1499)).toBe(1);
      expect(computeTier(1500)).toBe(2);
      expect(computeTier(3499)).toBe(2);
      expect(computeTier(3500)).toBe(3);
      expect(computeTier(6999)).toBe(3);
      expect(computeTier(7000)).toBe(4);
      expect(computeTier(999_999)).toBe(4);
    });

    it("clamps negative to 0 tier", () => {
      expect(computeTier(-10)).toBe(0);
    });
  });

  it("unlockedAssetsForTier is cumulative", () => {
    const t4 = unlockedAssetsForTier(4);
    expect(t4.length).toBeGreaterThan(unlockedAssetsForTier(0).length);
    expect(t4).toEqual(expect.arrayContaining(unlockedAssetsForTier(0)));
  });

  describe("nextAvatarTierProgress", () => {
    it("mid band tier 0", () => {
      const p = nextAvatarTierProgress(250, 0);
      expect(p.nextThresholdXp).toBe(500);
      expect(p.progress01).toBeCloseTo(0.5, 5);
    });
    it("tier 4 max", () => {
      const p = nextAvatarTierProgress(8000, 4);
      expect(p.nextThresholdXp).toBeNull();
      expect(p.progress01).toBe(1);
    });
  });
});
