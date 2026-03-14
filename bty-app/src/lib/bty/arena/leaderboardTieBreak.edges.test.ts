/**
 * Edge-case tests for leaderboardTieBreak (Arena 7차 — 미커버 1모듈).
 * 선택 필드 누락 시 동작만 검증. 기존 동작만 검증, 비즈니스/XP 로직 변경 금지.
 */
import { describe, it, expect } from "vitest";
import {
  compareLeaderboardRows,
  LEADERBOARD_ORDER_RULE,
  type LeaderboardRowForSort,
} from "./leaderboardTieBreak";

describe("leaderboardTieBreak (edges)", () => {
  it("LEADERBOARD_ORDER_RULE is non-empty string", () => {
    expect(typeof LEADERBOARD_ORDER_RULE).toBe("string");
    expect(LEADERBOARD_ORDER_RULE.length).toBeGreaterThan(0);
    expect(LEADERBOARD_ORDER_RULE).toContain("xp_total");
    expect(LEADERBOARD_ORDER_RULE).toContain("user_id");
  });

  it("treats missing xp_total as 0", () => {
    const a: LeaderboardRowForSort = { user_id: "u1" };
    const b: LeaderboardRowForSort = { user_id: "u2", xp_total: 10 };
    expect(compareLeaderboardRows(a, b)).toBeGreaterThan(0);
    expect(compareLeaderboardRows(b, a)).toBeLessThan(0);
  });

  it("returns 0 when both rows have same xp, updated_at, user_id", () => {
    const row: LeaderboardRowForSort = {
      user_id: "same",
      xp_total: 50,
      updated_at: "2025-03-01T00:00:00Z",
    };
    expect(compareLeaderboardRows(row, { ...row })).toBe(0);
  });

  it("breaks tie by user_id when xp_total equal and both updated_at missing", () => {
    const a: LeaderboardRowForSort = { user_id: "a", xp_total: 20 };
    const b: LeaderboardRowForSort = { user_id: "b", xp_total: 20 };
    expect(compareLeaderboardRows(a, b)).toBeLessThan(0);
    expect(compareLeaderboardRows(b, a)).toBeGreaterThan(0);
  });
});
