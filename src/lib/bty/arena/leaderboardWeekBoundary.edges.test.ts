/**
 * Edge-case tests for getLeaderboardWeekBoundary (Arena).
 * Verifies existing behavior only; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { getLeaderboardWeekBoundary } from "./leaderboardWeekBoundary";

describe("leaderboardWeekBoundary (edges)", () => {
  it("Tuesday and Saturday same week_end and reset_at", () => {
    const tue = new Date("2025-03-04T12:00:00.000Z");
    const sat = new Date("2025-03-08T18:00:00.000Z");
    const a = getLeaderboardWeekBoundary(tue);
    const b = getLeaderboardWeekBoundary(sat);
    expect(a.week_end).toBe(b.week_end);
    expect(a.reset_at).toBe(b.reset_at);
    expect(a.week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(a.reset_at).toBe("2025-03-10T00:00:00.000Z");
  });

  it("Sunday 00:00 UTC still in current week", () => {
    const sunStart = new Date("2025-03-09T00:00:00.000Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(sunStart);
    expect(week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(reset_at).toBe("2025-03-10T00:00:00.000Z");
  });

  it("reset_at is exactly 7 days after Monday 00:00 of current week", () => {
    const thur = new Date("2025-03-06T15:30:00.000Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(thur);
    const weekEndDate = new Date(week_end);
    const resetDate = new Date(reset_at);
    const diffMs = resetDate.getTime() - weekEndDate.getTime();
    expect(diffMs).toBe(1); // Sunday 23:59:59.999 -> Monday 00:00:00.000 = 1ms
  });

  it("Monday 00:00 UTC yields week_end same week Sunday 23:59:59.999", () => {
    const mon = new Date("2025-03-03T00:00:00.000Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(mon);
    expect(week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(reset_at).toBe("2025-03-10T00:00:00.000Z");
  });

  it("Sunday 23:59:59.999 UTC yields week_end equal to that moment", () => {
    const sunEnd = new Date("2025-03-09T23:59:59.999Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(sunEnd);
    expect(week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(reset_at).toBe("2025-03-10T00:00:00.000Z");
  });
});
