/**
 * Leaderboard tie-break 도메인 경계 테스트.
 * leaderboardTieBreak.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  compareWeeklyXpTieBreak,
  LEADERBOARD_TIE_BREAK_ORDER,
  type WeeklyXpRowForTieBreak,
} from "./leaderboardTieBreak";

describe("domain/rules/leaderboardTieBreak (edges)", () => {
  it("LEADERBOARD_TIE_BREAK_ORDER is stable for re-export", () => {
    expect(LEADERBOARD_TIE_BREAK_ORDER).toContain("xp_total");
    expect(LEADERBOARD_TIE_BREAK_ORDER).toContain("user_id asc");
  });

  it("compareWeeklyXpTieBreak when userId is empty string", () => {
    const a: WeeklyXpRowForTieBreak = { weeklyXp: 100, updatedAt: "2025-01-01Z", userId: "" };
    const b: WeeklyXpRowForTieBreak = { weeklyXp: 100, updatedAt: "2025-01-01Z", userId: "u1" };
    expect(compareWeeklyXpTieBreak(a, b)).not.toBe(0);
  });

  it("compareWeeklyXpTieBreak symmetric: compare(a,b) === -compare(b,a) when not equal", () => {
    const a: WeeklyXpRowForTieBreak = { weeklyXp: 10, updatedAt: null, userId: "a" };
    const b: WeeklyXpRowForTieBreak = { weeklyXp: 20, updatedAt: null, userId: "b" };
    expect(compareWeeklyXpTieBreak(a, b)).toBe(-compareWeeklyXpTieBreak(b, a));
  });

  it("WeeklyXpRowForTieBreak type with all fields present", () => {
    const row: WeeklyXpRowForTieBreak = {
      weeklyXp: 0,
      updatedAt: "2026-03-10T00:00:00Z",
      userId: "user-1",
    };
    expect(compareWeeklyXpTieBreak(row, row)).toBe(0);
  });

  it("compareWeeklyXpTieBreak breaks tie by userId when weeklyXp and updatedAt equal", () => {
    const a: WeeklyXpRowForTieBreak = { weeklyXp: 50, updatedAt: "2026-01-01T00:00:00Z", userId: "a" };
    const b: WeeklyXpRowForTieBreak = { weeklyXp: 50, updatedAt: "2026-01-01T00:00:00Z", userId: "b" };
    expect(compareWeeklyXpTieBreak(a, b)).toBeLessThan(0);
    expect(compareWeeklyXpTieBreak(b, a)).toBeGreaterThan(0);
  });

  it("compareWeeklyXpTieBreak breaks tie by updatedAt when weeklyXp equal (null before string)", () => {
    const a: WeeklyXpRowForTieBreak = { weeklyXp: 50, updatedAt: null, userId: "u" };
    const b: WeeklyXpRowForTieBreak = { weeklyXp: 50, updatedAt: "2026-01-01Z", userId: "u" };
    expect(compareWeeklyXpTieBreak(a, b)).not.toBe(0);
  });

  it("compareWeeklyXpTieBreak when weeklyXp differs, higher XP ranks first", () => {
    const high: WeeklyXpRowForTieBreak = { weeklyXp: 100, updatedAt: "2026-01-01Z", userId: "a" };
    const low: WeeklyXpRowForTieBreak = { weeklyXp: 50, updatedAt: "2026-01-01Z", userId: "b" };
    expect(compareWeeklyXpTieBreak(high, low)).toBeLessThan(0);
    expect(compareWeeklyXpTieBreak(low, high)).toBeGreaterThan(0);
  });
});
