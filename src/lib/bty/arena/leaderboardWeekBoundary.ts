/**
 * 주간 경계(week_end, reset_at) — 도메인 계산만. 리더보드 API 응답용.
 * weekly_xp 리셋 시점: Monday 00:00 UTC (weeklyQuest·cron과 동일).
 * 기존 weekly_xp·랭킹 로직 변경 없음.
 */

/**
 * Current week = Monday 00:00 UTC through Sunday 23:59:59.999 UTC.
 * reset_at = next Monday 00:00:00.000 UTC (when weekly XP resets).
 * week_end = end of current week = Sunday 23:59:59.999 UTC (ISO string).
 */
export function getLeaderboardWeekBoundary(d: Date = new Date()): {
  week_end: string;
  reset_at: string;
} {
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const mondayThisWeek = new Date(d);
  mondayThisWeek.setUTCDate(d.getUTCDate() + mondayOffset);
  mondayThisWeek.setUTCHours(0, 0, 0, 0);

  const sundayEnd = new Date(mondayThisWeek);
  sundayEnd.setUTCDate(mondayThisWeek.getUTCDate() + 6);
  sundayEnd.setUTCHours(23, 59, 59, 999);
  const week_end = sundayEnd.toISOString();

  const nextMonday = new Date(mondayThisWeek);
  nextMonday.setUTCDate(mondayThisWeek.getUTCDate() + 7);
  const reset_at = nextMonday.toISOString();

  return { week_end, reset_at };
}
