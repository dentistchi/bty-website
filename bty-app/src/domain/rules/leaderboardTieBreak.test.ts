import { describe, it, expect } from "vitest";
import {
  compareWeeklyXpTieBreak,
  LEADERBOARD_TIE_BREAK_ORDER,
  type WeeklyXpRowForTieBreak,
} from "./leaderboardTieBreak";

describe("domain/rules/leaderboardTieBreak", () => {
  it("defines order rule as xp_total desc, updated_at asc, user_id asc", () => {
    expect(LEADERBOARD_TIE_BREAK_ORDER).toBe(
      "xp_total desc, updated_at asc, user_id asc"
    );
  });

  it("sorts by weeklyXp desc first", () => {
    const a: WeeklyXpRowForTieBreak = { weeklyXp: 100, updatedAt: null, userId: "u1" };
    const b: WeeklyXpRowForTieBreak = { weeklyXp: 200, updatedAt: null, userId: "u2" };
    expect(compareWeeklyXpTieBreak(a, b)).toBeGreaterThan(0);
    expect(compareWeeklyXpTieBreak(b, a)).toBeLessThan(0);
  });

  it("uses updatedAt asc as tie-breaker when weeklyXp equal", () => {
    const a: WeeklyXpRowForTieBreak = {
      weeklyXp: 100,
      updatedAt: "2025-03-02T00:00:00Z",
      userId: "u1",
    };
    const b: WeeklyXpRowForTieBreak = {
      weeklyXp: 100,
      updatedAt: "2025-03-01T00:00:00Z",
      userId: "u2",
    };
    expect(compareWeeklyXpTieBreak(a, b)).toBeGreaterThan(0);
    expect(compareWeeklyXpTieBreak(b, a)).toBeLessThan(0);
  });

  it("uses userId asc as third tie-breaker when weeklyXp and updatedAt equal", () => {
    const a: WeeklyXpRowForTieBreak = {
      weeklyXp: 100,
      updatedAt: "2025-03-01T00:00:00Z",
      userId: "b-user",
    };
    const b: WeeklyXpRowForTieBreak = {
      weeklyXp: 100,
      updatedAt: "2025-03-01T00:00:00Z",
      userId: "a-user",
    };
    expect(compareWeeklyXpTieBreak(a, b)).toBeGreaterThan(0);
    expect(compareWeeklyXpTieBreak(b, a)).toBeLessThan(0);
  });

  it("returns 0 when all fields equal", () => {
    const row: WeeklyXpRowForTieBreak = {
      weeklyXp: 50,
      updatedAt: "2025-03-01Z",
      userId: "same",
    };
    expect(compareWeeklyXpTieBreak(row, { ...row })).toBe(0);
  });

  it("sorts array deterministically", () => {
    const rows: WeeklyXpRowForTieBreak[] = [
      { weeklyXp: 50, updatedAt: null, userId: "u3" },
      { weeklyXp: 100, updatedAt: "2025-03-02T00:00:00Z", userId: "u1" },
      { weeklyXp: 100, updatedAt: "2025-03-01T00:00:00Z", userId: "u2" },
    ];
    const sorted = [...rows].sort(compareWeeklyXpTieBreak);
    expect(sorted[0].userId).toBe("u2");
    expect(sorted[1].userId).toBe("u1");
    expect(sorted[2].userId).toBe("u3");
  });

  it("handles null updatedAt (treats as empty string)", () => {
    const a: WeeklyXpRowForTieBreak = { weeklyXp: 100, updatedAt: null, userId: "a" };
    const b: WeeklyXpRowForTieBreak = { weeklyXp: 100, updatedAt: "2025-01-01Z", userId: "b" };
    expect(compareWeeklyXpTieBreak(a, b)).toBeLessThan(0);
    expect(compareWeeklyXpTieBreak(b, a)).toBeGreaterThan(0);
  });

  it("when weeklyXp is 0 for both, orders by updatedAt asc then userId asc", () => {
    const a: WeeklyXpRowForTieBreak = {
      weeklyXp: 0,
      updatedAt: "2025-03-02T00:00:00Z",
      userId: "u2",
    };
    const b: WeeklyXpRowForTieBreak = {
      weeklyXp: 0,
      updatedAt: "2025-03-01T00:00:00Z",
      userId: "u1",
    };
    expect(compareWeeklyXpTieBreak(a, b)).toBeGreaterThan(0);
    expect(compareWeeklyXpTieBreak(b, a)).toBeLessThan(0);
  });
});
