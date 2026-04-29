import { describe, it, expect } from "vitest";
import { getLeaderboardWeekBoundary } from "./leaderboardWeekBoundary";

describe("leaderboardWeekBoundary", () => {
  it("returns week_end as Sunday 23:59:59.999 UTC and reset_at as next Monday 00:00 UTC", () => {
    const wed = new Date("2025-03-05T12:00:00.000Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(wed);
    expect(week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(reset_at).toBe("2025-03-10T00:00:00.000Z");
  });

  it("on Monday 00:00 UTC, week_end is same week Sunday, reset_at is next Monday", () => {
    const mon = new Date("2025-03-03T00:00:00.000Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(mon);
    expect(week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(reset_at).toBe("2025-03-10T00:00:00.000Z");
  });

  it("on Sunday 23:59 UTC, week_end is that Sunday, reset_at is next day Monday", () => {
    const sun = new Date("2025-03-09T23:59:59.999Z");
    const { week_end, reset_at } = getLeaderboardWeekBoundary(sun);
    expect(week_end).toBe("2025-03-09T23:59:59.999Z");
    expect(reset_at).toBe("2025-03-10T00:00:00.000Z");
  });

  it("returns valid ISO strings", () => {
    const { week_end, reset_at } = getLeaderboardWeekBoundary();
    expect(() => new Date(week_end)).not.toThrow();
    expect(() => new Date(reset_at)).not.toThrow();
    expect(new Date(reset_at).getTime()).toBeGreaterThan(new Date(week_end).getTime());
  });
});
