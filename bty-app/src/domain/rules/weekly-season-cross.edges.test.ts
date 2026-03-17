/**
 * Weekly XP reset vs season carryover — orthogonal domain rules (C3 edges).
 */
import { describe, it, expect } from "vitest";
import { seasonReset } from "./weeklyXp";
import { carryoverWeeklyXp } from "./season";

describe("domain/rules weekly vs season (edges)", () => {
  it("seasonReset zeros weekly ledger field; carryover maps prior weekly total at season boundary", () => {
    const reset = seasonReset({ coreXp: 500, weeklyXp: 80 });
    expect(reset.coreXp).toBe(500);
    expect(reset.weeklyXp).toBe(0);
    expect(carryoverWeeklyXp(80)).toBe(8);
  });
});
