import { describe, it, expect } from "vitest";
import {
  isLeaderboardWeekIdKey,
  weekIdForResetDisplayLabel,
  utcWeekIdToSundayEndIso,
} from "./leaderboardWeekId";

describe("leaderboardWeekId", () => {
  it("isLeaderboardWeekIdKey: Monday UTC OK, Sunday/other invalid", () => {
    expect(isLeaderboardWeekIdKey("2025-03-10")).toBe(true);
    expect(isLeaderboardWeekIdKey("2025-03-09")).toBe(false);
    expect(isLeaderboardWeekIdKey("2025-03-11")).toBe(false);
    expect(isLeaderboardWeekIdKey("25-03-10")).toBe(false);
    expect(isLeaderboardWeekIdKey("2025-13-01")).toBe(false);
  });

  it("weekIdForResetDisplayLabel mirrors validity", () => {
    expect(weekIdForResetDisplayLabel("2025-03-10")).toBe("2025-03-10");
    expect(weekIdForResetDisplayLabel(" 2025-03-10 ")).toBe("2025-03-10");
    expect(weekIdForResetDisplayLabel("2025-03-09")).toBeNull();
  });

  /** 243: week_id 주간 창 끝 = 리더보드 week_end 라벨과 동일(UTC). */
  it("utcWeekIdToSundayEndIso aligns with leaderboard boundary week_end", () => {
    expect(utcWeekIdToSundayEndIso("2025-03-10")).toBe("2025-03-16T23:59:59.999Z");
    expect(utcWeekIdToSundayEndIso("2025-03-03")).toBe("2025-03-09T23:59:59.999Z");
    expect(utcWeekIdToSundayEndIso("2025-03-09")).toBeNull();
  });
});
