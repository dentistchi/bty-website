/**
 * 주간 리더보드 `week_id` 키 — 표시·저장소 정합용 순수 검증.
 * Monday 00:00 UTC 기준 주 시작과 동일 의미의 `YYYY-MM-DD`만 허용.
 */

function parseUtcYmd(s: string): Date | null {
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** 리셋·집계 키로 쓸 수 있는 week_id인지 (UTC 월요일 날짜). */
export function isLeaderboardWeekIdKey(weekId: string): boolean {
  const dt = parseUtcYmd(weekId);
  if (!dt) return false;
  return dt.getUTCDay() === 1;
}

/** 유효하면 그대로, 아니면 null — UI 라벨 바인딩 전 검증. */
export function weekIdForResetDisplayLabel(weekId: string): string | null {
  return isLeaderboardWeekIdKey(weekId) ? weekId.trim() : null;
}

const MS_PER_DAY = 86_400_000;

/**
 * `week_id`(UTC 월요이) → 해당 주 일요이 23:59:59.999Z ISO.
 * `leaderboardWeekBoundary`의 week_end와 동일 의미(정합 테스트용).
 */
export function utcWeekIdToSundayEndIso(weekId: string): string | null {
  if (!isLeaderboardWeekIdKey(weekId)) return null;
  const [y, mo, d] = weekId.trim().split("-").map(Number);
  const mon = new Date(Date.UTC(y, mo - 1, d));
  const sun = new Date(mon.getTime() + 6 * MS_PER_DAY);
  sun.setUTCHours(23, 59, 59, 999);
  return sun.toISOString();
}
