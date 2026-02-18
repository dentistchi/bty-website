type Progress = {
  startDateISO: string;          // YYYY-MM-DD
  lastCompletedDay: number;      // 0..28
  lastCompletedAt: string | null;// ISO
};

const UNLOCK_HOUR = 5; // 오전 5시

function parseISODateOnly(s: string): Date {
  // 로컬 날짜 기준(YYYY-MM-DD)을 로컬 Date로
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysLocal(dateOnly: Date, days: number) {
  const d = new Date(dateOnly);
  d.setDate(d.getDate() + days);
  return d;
}

function atUnlockTimeLocal(dateOnly: Date) {
  const d = new Date(dateOnly);
  d.setHours(UNLOCK_HOUR, 0, 0, 0);
  return d;
}

export function computeUnlockState(progress: Progress, now = new Date()) {
  const start = parseISODateOnly(progress.startDateISO);

  // "날짜 조건"으로 이론상 가능한 최대 Day (start + k일, 오전5시 기준)
  let maxByDate = 0;
  for (let day = 1; day <= 28; day++) {
    const dayDate = addDaysLocal(start, day - 1);
    const unlockAt = atUnlockTimeLocal(dayDate);
    if (now >= unlockAt) maxByDate = day;
    else break;
  }

  // "완료 조건": 순서대로 day=last+1까지만 후보
  let candidate = Math.min(progress.lastCompletedDay + 1, 28);

  // "내일 아침 전까지 다음 Day 잠금 유지":
  // 마지막 완료가 오늘 발생했고, 아직 다음날 5시 전이면 candidate를 last로 되돌림
  if (progress.lastCompletedAt) {
    const lastAt = new Date(progress.lastCompletedAt);
    const sameDate =
      lastAt.getFullYear() === now.getFullYear() &&
      lastAt.getMonth() === now.getMonth() &&
      lastAt.getDate() === now.getDate();

    if (sameDate) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(UNLOCK_HOUR, 0, 0, 0);

      if (now < tomorrow) {
        // 오늘 완료 → 내일 5시 전엔 다음 day 잠금
        candidate = progress.lastCompletedDay; // 오늘 day까지만
      }
    }
  }

  const unlockedDay = Math.min(candidate, maxByDate);
  return { maxByDate, unlockedDay };
}

export function dayStatus(day: number, progress: Progress, now = new Date()) {
  const { unlockedDay } = computeUnlockState(progress, now);
  if (day <= progress.lastCompletedDay) return "done" as const;
  if (day === unlockedDay) return "today" as const;
  if (day < unlockedDay) return "available" as const; // (거의 안 씀: 보통 순차라)
  return "locked" as const;
}
