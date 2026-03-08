import { describe, it, expect } from "vitest";
import {
  compareLeaderboardRows,
  LEADERBOARD_ORDER_RULE,
  type LeaderboardRowForSort,
} from "./leaderboardTieBreak";

describe("leaderboardTieBreak", () => {
  it("defines order rule as xp_total desc, updated_at asc, user_id asc", () => {
    expect(LEADERBOARD_ORDER_RULE).toBe("xp_total desc, updated_at asc, user_id asc");
  });

  it("sorts by xp_total desc first", () => {
    const a: LeaderboardRowForSort = { user_id: "u1", xp_total: 100 };
    const b: LeaderboardRowForSort = { user_id: "u2", xp_total: 200 };
    expect(compareLeaderboardRows(a, b)).toBeGreaterThan(0);
    expect(compareLeaderboardRows(b, a)).toBeLessThan(0);
  });

  it("uses updated_at asc as tie-breaker when xp_total equal", () => {
    const a: LeaderboardRowForSort = {
      user_id: "u1",
      xp_total: 100,
      updated_at: "2025-03-02T00:00:00Z",
    };
    const b: LeaderboardRowForSort = {
      user_id: "u2",
      xp_total: 100,
      updated_at: "2025-03-01T00:00:00Z",
    };
    expect(compareLeaderboardRows(a, b)).toBeGreaterThan(0);
    expect(compareLeaderboardRows(b, a)).toBeLessThan(0);
  });

  it("uses user_id asc as third tie-breaker when xp and updated_at equal", () => {
    const a: LeaderboardRowForSort = {
      user_id: "b-user",
      xp_total: 100,
      updated_at: "2025-03-01T00:00:00Z",
    };
    const b: LeaderboardRowForSort = {
      user_id: "a-user",
      xp_total: 100,
      updated_at: "2025-03-01T00:00:00Z",
    };
    expect(compareLeaderboardRows(a, b)).toBeGreaterThan(0);
    expect(compareLeaderboardRows(b, a)).toBeLessThan(0);
  });

  it("sorts array deterministically", () => {
    const rows: LeaderboardRowForSort[] = [
      { user_id: "u3", xp_total: 50 },
      { user_id: "u1", xp_total: 100, updated_at: "2025-03-02T00:00:00Z" },
      { user_id: "u2", xp_total: 100, updated_at: "2025-03-01T00:00:00Z" },
    ];
    const sorted = [...rows].sort(compareLeaderboardRows);
    expect(sorted[0].user_id).toBe("u2");
    expect(sorted[1].user_id).toBe("u1");
    expect(sorted[2].user_id).toBe("u3");
  });
});
