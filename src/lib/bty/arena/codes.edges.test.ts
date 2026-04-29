/**
 * Arena codes — 경계 테스트.
 * codes.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import { progressToNextTier, CODE_LORE } from "./codes";

describe("codes (edges)", () => {
  it("progressToNextTier one XP before tier up yields xpToNext 1", () => {
    const p = progressToNextTier(9);
    expect(p.xpToNext).toBe(1);
    expect(p.progressPct).toBeCloseTo(0.9, 10);
  });

  it("CODE_LORE has entry for each code index 0..6", () => {
    expect(Object.keys(CODE_LORE).length).toBe(7);
    expect(CODE_LORE[0]).toBeTruthy();
    expect(CODE_LORE[6]).toBeTruthy();
  });
});
