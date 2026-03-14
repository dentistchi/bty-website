/**
 * Level-tier 도메인 경계 테스트.
 * level-tier.test.ts와 중복 없이 경계·엣지만.
 */
import { describe, it, expect } from "vitest";
import {
  codeIndexFromTier,
  subTierGroupFromTier,
  resolveSubName,
  stageFromCoreXp,
  tierFromCoreXp,
} from "./level-tier";

describe("domain/rules/level-tier (edges)", () => {
  it("codeIndexFromTier clamps tier 700+ to code index 6", () => {
    expect(codeIndexFromTier(700)).toBe(6);
    expect(codeIndexFromTier(701)).toBe(6);
    expect(codeIndexFromTier(999)).toBe(6);
  });

  it("codeIndexFromTier clamps negative tier to 0", () => {
    expect(codeIndexFromTier(-1)).toBe(0);
    expect(codeIndexFromTier(-100)).toBe(0);
  });

  it("codeIndexFromTier at 99 is 0 and at 100 is 1 (code boundary)", () => {
    expect(codeIndexFromTier(99)).toBe(0);
    expect(codeIndexFromTier(100)).toBe(1);
  });

  it("subTierGroupFromTier at code boundary (tier 100) returns 0", () => {
    expect(subTierGroupFromTier(100)).toBe(0);
    expect(subTierGroupFromTier(124)).toBe(0);
  });

  it("resolveSubName code 6 with empty custom returns fallback", () => {
    expect(resolveSubName(6, 0, null)).toBe("—");
    expect(resolveSubName(6, 1, "")).toBe("—");
    expect(resolveSubName(6, 3, "  ")).toBe("—");
  });

  it("stageFromCoreXp caps at 7 for 600+ core XP", () => {
    expect(stageFromCoreXp(600)).toBe(7);
    expect(stageFromCoreXp(699)).toBe(7);
    expect(stageFromCoreXp(700)).toBe(7);
  });

  it("tierFromCoreXp and stageFromCoreXp consistency at 0", () => {
    expect(tierFromCoreXp(0)).toBe(0);
    expect(stageFromCoreXp(0)).toBe(1);
  });

  it("tierFromCoreXp with negative coreXp returns 0", () => {
    expect(tierFromCoreXp(-1)).toBe(0);
    expect(tierFromCoreXp(-100)).toBe(0);
  });
});
