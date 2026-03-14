/**
 * Edge-case tests for weeklyQuest (Arena 2차).
 * TASK 4(leaderboardWeekBoundary)와 다른 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import { getWeekStartUTC } from "./weeklyQuest";

describe("weeklyQuest (edges)", () => {
  it("Saturday and Friday same week return same Monday", () => {
    const sat = new Date("2025-03-08T12:00:00.000Z");
    const fri = new Date("2025-03-07T23:59:59.999Z");
    expect(getWeekStartUTC(sat)).toBe("2025-03-03");
    expect(getWeekStartUTC(fri)).toBe("2025-03-03");
  });

  it("Sunday 00:00 UTC returns previous Monday", () => {
    const sunStart = new Date("2025-03-09T00:00:00.000Z");
    expect(getWeekStartUTC(sunStart)).toBe("2025-03-03");
  });

  it("Tuesday returns same week Monday", () => {
    const tue = new Date("2025-03-04T00:00:00.000Z");
    expect(getWeekStartUTC(tue)).toBe("2025-03-03");
  });

  it("Monday 00:00 UTC returns same date", () => {
    const mon = new Date("2025-03-03T00:00:00.000Z");
    expect(getWeekStartUTC(mon)).toBe("2025-03-03");
  });
});
