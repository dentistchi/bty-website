import { TRAIN_START_DATE, clampDay } from "./train28";

function startOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getUnlockedDayCount(now = new Date()) {
  // 시작일을 로컬 자정 기준으로 계산
  const start = new Date(TRAIN_START_DATE + "T00:00:00");
  const diffMs = startOfDayLocal(now).getTime() - startOfDayLocal(start).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Day 1이 시작일에 열림 → diffDays=0 => 1
  return clampDay(diffDays + 1);
}

const OPEN_HOUR = 5;

function startOfUnlockDayLocal(completedAtISO: string) {
  // completedAt 기준 "다음날 05:00 (로컬)"을 만들어서 그 이전엔 잠금
  const completed = new Date(completedAtISO);
  const unlock = new Date(completed);
  unlock.setDate(unlock.getDate() + 1);
  unlock.setHours(OPEN_HOUR, 0, 0, 0);
  return unlock;
}

function daysSinceStartLocal(startDateISO: string) {
  // startDateISO(YYYY-MM-DD)를 로컬 날짜로 해석
  const [y, m, d] = startDateISO.split("-").map(Number);
  const start = new Date(y, m - 1, d, OPEN_HOUR, 0, 0, 0); // 시작도 05:00 기준이면 UX가 자연스러움
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function getDayLockState(params: {
  day: number;
  startDateISO: string;
  completionsByDay: Record<string, string>;
}) {
  const { day, startDateISO, completionsByDay } = params;

  const passed = daysSinceStartLocal(startDateISO);
  const calendarAllowed = passed >= day - 1;

  if (day === 1) {
    // Day1은 날짜만 만족하면 오픈
    return { unlocked: calendarAllowed, reason: calendarAllowed ? "today" : "too-early" };
  }

  const prev = String(day - 1);
  const prevCompletedAt = completionsByDay[prev];
  if (!prevCompletedAt) return { unlocked: false, reason: "need-prev-complete" };

  const unlockTime = startOfUnlockDayLocal(prevCompletedAt);
  const now = new Date();

  const morningGateAllowed = now >= unlockTime;

  const unlocked = calendarAllowed && morningGateAllowed;
  return {
    unlocked,
    reason: !calendarAllowed ? "too-early" : !morningGateAllowed ? "wait-next-morning" : "ok",
    unlockAt: unlockTime.toISOString(),
  };
}
