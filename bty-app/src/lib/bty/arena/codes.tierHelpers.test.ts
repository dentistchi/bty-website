/**
 * Unit tests for codeIndexFromTier and subTierGroupFromTier (Arena codes).
 * Verifies existing behavior only; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { codeIndexFromTier, subTierGroupFromTier } from "./codes";

describe("codeIndexFromTier (Arena codes)", () => {
  it("returns 0 for tier 0–99", () => {
    expect(codeIndexFromTier(0)).toBe(0);
    expect(codeIndexFromTier(50)).toBe(0);
    expect(codeIndexFromTier(99)).toBe(0);
  });

  it("returns floor(tier/100) capped to 0–6", () => {
    expect(codeIndexFromTier(100)).toBe(1);
    expect(codeIndexFromTier(199)).toBe(1);
    expect(codeIndexFromTier(200)).toBe(2);
    expect(codeIndexFromTier(599)).toBe(5);
    expect(codeIndexFromTier(600)).toBe(6);
    expect(codeIndexFromTier(699)).toBe(6);
    expect(codeIndexFromTier(700)).toBe(6);
  });

  it("clamps negative tier to 0", () => {
    expect(codeIndexFromTier(-1)).toBe(0);
    expect(codeIndexFromTier(-100)).toBe(0);
  });
});

describe("subTierGroupFromTier (Arena codes)", () => {
  it("returns 0–3 by floor((tier % 100) / 25)", () => {
    expect(subTierGroupFromTier(0)).toBe(0);
    expect(subTierGroupFromTier(24)).toBe(0);
    expect(subTierGroupFromTier(25)).toBe(1);
    expect(subTierGroupFromTier(49)).toBe(1);
    expect(subTierGroupFromTier(50)).toBe(2);
    expect(subTierGroupFromTier(74)).toBe(2);
    expect(subTierGroupFromTier(75)).toBe(3);
    expect(subTierGroupFromTier(99)).toBe(3);
  });

  it("repeats per 100-tier block", () => {
    expect(subTierGroupFromTier(100)).toBe(0);
    expect(subTierGroupFromTier(125)).toBe(1);
    expect(subTierGroupFromTier(250)).toBe(2);
  });

  it("clamps out-of-range to 0–3", () => {
    expect(subTierGroupFromTier(-1)).toBe(0);
  });
});
