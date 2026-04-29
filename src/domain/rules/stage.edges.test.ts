/**
 * Stage 도메인 경계 테스트.
 * stage.test.ts와 중복 없이 경계·엣지만.
 */
import { describe, it, expect } from "vitest";
import {
  stageNumberFromCoreXp,
  defaultSubName,
  stageStateFromCoreXp,
} from "./stage";

describe("domain/rules/stage (edges)", () => {
  it("stageNumberFromCoreXp returns integer", () => {
    expect(Number.isInteger(stageNumberFromCoreXp(0))).toBe(true);
    expect(Number.isInteger(stageNumberFromCoreXp(100))).toBe(true);
    expect(Number.isInteger(stageNumberFromCoreXp(500))).toBe(true);
  });

  it("stageNumberFromCoreXp returns 1 for 0 and 99 (boundary before stage 2)", () => {
    expect(stageNumberFromCoreXp(0)).toBe(1);
    expect(stageNumberFromCoreXp(99)).toBe(1);
  });

  it("stageNumberFromCoreXp with negative coreXp returns 1 (clamped to 0)", () => {
    expect(stageNumberFromCoreXp(-1)).toBe(1);
    expect(stageNumberFromCoreXp(-100)).toBe(1);
  });

  it("stageNumberFromCoreXp returns 2 for 100", () => {
    expect(stageNumberFromCoreXp(100)).toBe(2);
  });

  it("stageNumberFromCoreXp returns 2 for 199 and 3 for 200 (stage 2/3 boundary)", () => {
    expect(stageNumberFromCoreXp(199)).toBe(2);
    expect(stageNumberFromCoreXp(200)).toBe(3);
  });

  it("stageNumberFromCoreXp caps at 7 for 600+ core XP", () => {
    expect(stageNumberFromCoreXp(600)).toBe(7);
    expect(stageNumberFromCoreXp(699)).toBe(7);
    expect(stageNumberFromCoreXp(700)).toBe(7);
  });

  it("defaultSubName returns null for code 6 all subTierGroups", () => {
    expect(defaultSubName(6, 0)).toBeNull();
    expect(defaultSubName(6, 1)).toBeNull();
    expect(defaultSubName(6, 2)).toBeNull();
    expect(defaultSubName(6, 3)).toBeNull();
  });

  it("stageStateFromCoreXp uses default subName when customSubName is empty string", () => {
    const s = stageStateFromCoreXp(0, "");
    expect(s.subName).toBe("Spark");
  });

  it("stageStateFromCoreXp at boundary tier 250 returns consistent state", () => {
    const s = stageStateFromCoreXp(250, null);
    expect(s.tier).toBe(25);
    expect(s.stageNumber).toBe(3);
    expect(s.codeName).toBe("FORGE");
  });
});
