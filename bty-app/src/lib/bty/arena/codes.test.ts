import { describe, it, expect } from "vitest";
import {
  tierFromCoreXp,
  progressToNextTier,
  codeIndexFromTier,
  subTierGroupFromTier,
  computeCoreXpDisplay,
  CODE_NAMES,
  CODE_LORE,
  SUB_NAMES,
} from "./codes";

describe("tierFromCoreXp", () => {
  it("floor(coreXp/10)", () => {
    expect(tierFromCoreXp(0)).toBe(0);
    expect(tierFromCoreXp(9)).toBe(0);
    expect(tierFromCoreXp(10)).toBe(1);
    expect(tierFromCoreXp(99)).toBe(9);
    expect(tierFromCoreXp(100)).toBe(10);
    expect(tierFromCoreXp(249)).toBe(24);
    expect(tierFromCoreXp(250)).toBe(25);
    expect(tierFromCoreXp(499)).toBe(49);
    expect(tierFromCoreXp(500)).toBe(50);
    expect(tierFromCoreXp(749)).toBe(74);
    expect(tierFromCoreXp(750)).toBe(75);
  });
});

describe("progressToNextTier", () => {
  it("returns xpToNext and progressPct", () => {
    const p0 = progressToNextTier(0);
    expect(p0.xpToNext).toBe(10);
    expect(p0.progressPct).toBe(0);
    expect(p0.nextCodeName).toBeUndefined();

    const p5 = progressToNextTier(5);
    expect(p5.xpToNext).toBe(5);
    expect(p5.progressPct).toBe(0.5);

    const p99 = progressToNextTier(99);
    expect(p99.xpToNext).toBe(1);
    expect(p99.progressPct).toBeCloseTo(0.9, 10);
  });

  it("returns nextCodeName at 100-tier boundary", () => {
    const p995 = progressToNextTier(995);
    expect(p995.nextCodeName).toBe(CODE_NAMES[1]);
    const p999 = progressToNextTier(999);
    expect(p999.nextCodeName).toBe(CODE_NAMES[1]);
  });
});

describe("computeCoreXpDisplay", () => {
  it("zero core XP: stage 1, progress 0, first code lore", () => {
    const d = computeCoreXpDisplay(0);
    expect(d.stage).toBe(1);
    expect(d.progressPct).toBe(0);
    expect(d.nextCodeName).toBeNull();
    expect(d.xpToNext).toBe(10);
    expect(d.codeLore).toBe(CODE_LORE[0]);
    expect(d.milestoneToCelebrate).toBeNull();
    expect(d.previousSubName).toBeNull();
  });

  it("within first code: stage 1, no milestone", () => {
    const d = computeCoreXpDisplay(100);
    expect(d.stage).toBe(1);
    expect(d.codeLore).toBe(CODE_LORE[0]);
    expect(d.milestoneToCelebrate).toBeNull();
    expect(d.previousSubName).toBeNull();
  });

  it("tier 25: milestone 25, no previousSubName", () => {
    const d = computeCoreXpDisplay(250);
    expect(tierFromCoreXp(250)).toBe(25);
    expect(d.milestoneToCelebrate).toBe(25);
    expect(d.previousSubName).toBeNull();
  });

  it("tier 50: milestone 50, previousSubName from tier 49", () => {
    const d = computeCoreXpDisplay(500);
    expect(tierFromCoreXp(500)).toBe(50);
    expect(d.milestoneToCelebrate).toBe(50);
    const idx49 = codeIndexFromTier(49);
    const grp49 = subTierGroupFromTier(49);
    const expected = SUB_NAMES[idx49] ? SUB_NAMES[idx49]![grp49] : "—";
    expect(d.previousSubName).toBe(expected);
  });

  it("tier 75: milestone 75, previousSubName from tier 74", () => {
    const d = computeCoreXpDisplay(750);
    expect(tierFromCoreXp(750)).toBe(75);
    expect(d.milestoneToCelebrate).toBe(75);
    const idx74 = codeIndexFromTier(74);
    const grp74 = subTierGroupFromTier(74);
    const expected = SUB_NAMES[idx74] ? SUB_NAMES[idx74]![grp74] : "—";
    expect(d.previousSubName).toBe(expected);
  });

  it("stage advances every 100 tiers", () => {
    expect(computeCoreXpDisplay(0).stage).toBe(1);
    expect(computeCoreXpDisplay(999).stage).toBe(1);
    expect(computeCoreXpDisplay(1000).stage).toBe(2);
    expect(computeCoreXpDisplay(6990).stage).toBe(7);
  });

  it("progressPct and xpToNext match progressToNextTier", () => {
    const xp = 337;
    const d = computeCoreXpDisplay(xp);
    const p = progressToNextTier(xp);
    expect(d.progressPct).toBe(p.progressPct);
    expect(d.xpToNext).toBe(p.xpToNext);
    expect(d.nextCodeName).toBe(p.nextCodeName ?? null);
  });
});
