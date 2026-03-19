/**
 * leaderboardWeekId — week_id 형식·경계 엣지 (SPRINT 64 TASK 8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  isLeaderboardWeekIdKey,
  weekIdForResetDisplayLabel,
  utcWeekIdToSundayEndIso,
} from "./leaderboardWeekId";

describe("leaderboardWeekId (edges)", () => {
  it("rejects empty and whitespace-only week_id", () => {
    expect(isLeaderboardWeekIdKey("")).toBe(false);
    expect(isLeaderboardWeekIdKey("   ")).toBe(false);
    expect(isLeaderboardWeekIdKey("\t\n")).toBe(false);
    expect(weekIdForResetDisplayLabel("")).toBeNull();
    expect(weekIdForResetDisplayLabel("  ")).toBeNull();
    expect(utcWeekIdToSundayEndIso("")).toBeNull();
    expect(utcWeekIdToSundayEndIso("  ")).toBeNull();
  });

  it("rejects non-YYYY-MM-DD formats", () => {
    expect(isLeaderboardWeekIdKey("2025/03/10")).toBe(false);
    expect(isLeaderboardWeekIdKey("03-10-2025")).toBe(false);
    expect(isLeaderboardWeekIdKey("20250310")).toBe(false);
    expect(isLeaderboardWeekIdKey("2025-3-10")).toBe(false);
    expect(utcWeekIdToSundayEndIso("2025/03/10")).toBeNull();
  });

  it("rejects invalid calendar dates", () => {
    expect(isLeaderboardWeekIdKey("2025-02-30")).toBe(false);
    expect(isLeaderboardWeekIdKey("2025-00-01")).toBe(false);
    expect(isLeaderboardWeekIdKey("2025-01-00")).toBe(false);
    expect(isLeaderboardWeekIdKey("2025-13-01")).toBe(false);
    expect(utcWeekIdToSundayEndIso("2025-02-30")).toBeNull();
  });

  it("accepts Monday UTC and trims for display", () => {
    expect(isLeaderboardWeekIdKey("  2025-03-10  ")).toBe(true);
    expect(weekIdForResetDisplayLabel("  2025-03-10  ")).toBe("2025-03-10");
    expect(utcWeekIdToSundayEndIso("  2025-03-10  ")).toBe("2025-03-16T23:59:59.999Z");
  });

  it("utcWeekIdToSundayEndIso returns null for invalid week_id", () => {
    expect(utcWeekIdToSundayEndIso("2025-03-09")).toBeNull();
    expect(utcWeekIdToSundayEndIso("not-a-date")).toBeNull();
  });
});
