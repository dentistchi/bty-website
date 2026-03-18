/**
 * 주간 경쟁 표시 — ISO 파싱·경계 (SPRINT 48 TASK 8 / 254 C3).
 * Core XP·랭킹 정렬과 무관.
 */
import { describe, it, expect } from "vitest";
import {
  weeklyLeaderboardResetDaysRemaining,
  weeklyCompetitionDaysLeftInWindowDisplay,
} from "./weeklyCompetitionDisplay";

describe("weeklyCompetitionDisplay edges (254)", () => {
  it("weeklyLeaderboardResetDaysRemaining: invalid or past reset → 0", () => {
    const now = Date.parse("2025-03-10T12:00:00.000Z");
    expect(weeklyLeaderboardResetDaysRemaining(now, "")).toBe(0);
    expect(weeklyLeaderboardResetDaysRemaining(now, "not-a-date")).toBe(0);
    expect(weeklyLeaderboardResetDaysRemaining(now, "2025-03-09T00:00:00.000Z")).toBe(0);
  });

  it("weeklyCompetitionDaysLeftInWindowDisplay: invalid week_end → 0", () => {
    const now = Date.parse("2025-03-10T12:00:00.000Z");
    expect(weeklyCompetitionDaysLeftInWindowDisplay(now, "")).toBe(0);
    expect(weeklyCompetitionDaysLeftInWindowDisplay(now, "invalid")).toBe(0);
  });

  it("weeklyCompetitionDaysLeftInWindowDisplay: week already ended → 0", () => {
    const now = Date.parse("2025-03-20T12:00:00.000Z");
    expect(weeklyCompetitionDaysLeftInWindowDisplay(now, "2025-03-16T23:59:59.999Z")).toBe(0);
  });
});
