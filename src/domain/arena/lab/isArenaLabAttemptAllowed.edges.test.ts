/**
 * isArenaLabAttemptAllowed — 경계 (한도·리셋). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_LAB_DAILY_ATTEMPT_LIMIT,
  isArenaLabAttemptAllowed,
} from "./isArenaLabAttemptAllowed";

const D = "2026-03-22";
const NEXT = "2026-03-23";

describe("isArenaLabAttemptAllowed (edges)", () => {
  it("allows when same day and attempts are strictly below limit", () => {
    expect(
      isArenaLabAttemptAllowed({
        usageDateKey: D,
        nowDateKey: D,
        attemptsUsedOnUsageDate: 0,
      }),
    ).toBe(true);
    expect(
      isArenaLabAttemptAllowed({
        usageDateKey: D,
        nowDateKey: D,
        attemptsUsedOnUsageDate: ARENA_LAB_DAILY_ATTEMPT_LIMIT - 1,
      }),
    ).toBe(true);
  });

  it("disallows when same day and attempts exactly at or above limit", () => {
    expect(
      isArenaLabAttemptAllowed({
        usageDateKey: D,
        nowDateKey: D,
        attemptsUsedOnUsageDate: ARENA_LAB_DAILY_ATTEMPT_LIMIT,
      }),
    ).toBe(false);
    expect(
      isArenaLabAttemptAllowed({
        usageDateKey: D,
        nowDateKey: D,
        attemptsUsedOnUsageDate: ARENA_LAB_DAILY_ATTEMPT_LIMIT + 1,
      }),
    ).toBe(false);
  });

  it("allows after daily reset when date key advances even if prior day was maxed", () => {
    expect(
      isArenaLabAttemptAllowed({
        usageDateKey: D,
        nowDateKey: NEXT,
        attemptsUsedOnUsageDate: ARENA_LAB_DAILY_ATTEMPT_LIMIT,
      }),
    ).toBe(true);
  });
});
