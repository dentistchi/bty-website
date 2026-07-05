import { userDayKey } from "@/domain/daily/userDayKey";
import { dayKeyToStartInstant } from "@/domain/daily/userDayStartInstant";
import { TRAIN_START_DATE, clampDay } from "./train28";

const OPEN_HOUR = 5;

/** Whole calendar days from key `a` to key `b` (both "YYYY-MM-DD"): b − a. */
function dayKeyDiff(a: string, b: string): number {
  const [ay, amo, ad] = a.split("-").map(Number);
  const [by, bmo, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bmo - 1, bd) - Date.UTC(ay, amo - 1, ad)) / 86_400_000);
}

/** Next calendar day of a "YYYY-MM-DD" key. */
function nextDayKey(dayKey: string): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const nx = new Date(Date.UTC(y, mo - 1, d) + 86_400_000);
  return `${nx.getUTCFullYear()}-${String(nx.getUTCMonth() + 1).padStart(2, "0")}-${String(
    nx.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Unlocked day count since the program start, on the canonical 05:00-local day boundary
 * (D1 STEP 1). `userTz` = profile timezone when available, else UTC (train routes do not carry
 * device tz — accepted Commander trade-off; see dispatch A2).
 */
export function getUnlockedDayCount(now = new Date(), userTz = "UTC") {
  const diffDays = dayKeyDiff(TRAIN_START_DATE, userDayKey(now, userTz, OPEN_HOUR));
  // Day 1 opens on the start date → diffDays=0 => 1
  return clampDay(diffDays + 1);
}

/**
 * 완료 체인 기반 unlock (옵션 A): 마지막 완료 Day +1 을 오픈.
 * 달력/morning-gate 무시 — 전날 완료 시 다음 Day 즉시 개방. lcd=0 → 1.
 */
export function getUnlockedDayFromCompletions(lastCompletedDay: number): number {
  const lcd = Number.isFinite(lastCompletedDay) ? Math.floor(lastCompletedDay) : 0;
  return clampDay(lcd + 1);
}

export function getDayLockState(params: {
  day: number;
  startDateISO: string;
  completionsByDay: Record<string, string>;
  userTz?: string;
  now?: Date;
}) {
  const { day, startDateISO, completionsByDay, userTz = "UTC", now = new Date() } = params;
  const todayKey = userDayKey(now, userTz, OPEN_HOUR);

  const passed = dayKeyDiff(startDateISO, todayKey);
  const calendarAllowed = passed >= day - 1;

  if (day === 1) {
    // Day1은 날짜만 만족하면 오픈
    return { unlocked: calendarAllowed, reason: calendarAllowed ? "today" : "too-early" };
  }

  const prev = String(day - 1);
  const prevCompletedAt = completionsByDay[prev];
  if (!prevCompletedAt) return { unlocked: false, reason: "need-prev-complete" };

  // 전날 완료 → 다음 user-day의 05:00(로컬) 시작에 해금.
  const unlockDayKey = nextDayKey(userDayKey(new Date(prevCompletedAt), userTz, OPEN_HOUR));
  const unlockAt = dayKeyToStartInstant(unlockDayKey, userTz, OPEN_HOUR);
  const morningGateAllowed = now.getTime() >= unlockAt.getTime();

  const unlocked = calendarAllowed && morningGateAllowed;
  return {
    unlocked,
    reason: !calendarAllowed ? "too-early" : !morningGateAllowed ? "wait-next-morning" : "ok",
    unlockAt: unlockAt.toISOString(),
  };
}
