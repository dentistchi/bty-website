/**
 * Edge-case tests for activityXp (Arena) — pure cap boundary only.
 * activityXp.test.ts와 중복 없이 capArenaDailyDelta 경계만.
 */
import { describe, it, expect } from "vitest";
import { capArenaDailyDelta, ARENA_DAILY_XP_CAP } from "./activityXp";

describe("activityXp (edges)", () => {
  it("capArenaDailyDelta returns 0 when todayTotalTowardCap >= ARENA_DAILY_XP_CAP", () => {
    expect(capArenaDailyDelta(100, ARENA_DAILY_XP_CAP)).toBe(0);
    expect(capArenaDailyDelta(500, ARENA_DAILY_XP_CAP + 1)).toBe(0);
  });
});
