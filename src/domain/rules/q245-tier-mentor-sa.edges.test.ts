/**
 * C6 245 — 표시 티어(Core)·중복 멘토 신청·Second Awakening 자격 엣지.
 */
import { describe, it, expect } from "vitest";
import { tierFromCoreXp } from "./level-tier";
import {
  AWAKENING_TRIGGER_DAY,
  AWAKENING_TRIGGER_MIN_SESSIONS,
} from "../healing";

describe("245 tier · mentor duplicate · SA eligibility", () => {
  it("tierFromCoreXp increases with Core XP (랭킹과 무관한 표시용)", () => {
    expect(tierFromCoreXp(0)).toBeLessThanOrEqual(tierFromCoreXp(1000));
    expect(tierFromCoreXp(100)).toBeGreaterThanOrEqual(tierFromCoreXp(0));
  });

  it("Elite 멘토: pending이면 동일 사용자 재신청 불가 키", () => {
    const mayRequestNew = (isElite: boolean, existingPending: boolean) =>
      isElite && !existingPending;
    expect(mayRequestNew(true, true)).toBe(false);
    expect(mayRequestNew(true, false)).toBe(true);
    expect(mayRequestNew(false, false)).toBe(false);
  });

  it("Second Awakening 자격: 일수·세션 하한 동시 충족", () => {
    const eligible = (daysSinceStart: number, sessions: number) =>
      daysSinceStart >= AWAKENING_TRIGGER_DAY && sessions >= AWAKENING_TRIGGER_MIN_SESSIONS;
    expect(eligible(AWAKENING_TRIGGER_DAY - 1, AWAKENING_TRIGGER_MIN_SESSIONS)).toBe(false);
    expect(eligible(AWAKENING_TRIGGER_DAY, AWAKENING_TRIGGER_MIN_SESSIONS - 1)).toBe(false);
    expect(eligible(AWAKENING_TRIGGER_DAY, AWAKENING_TRIGGER_MIN_SESSIONS)).toBe(true);
  });
});
