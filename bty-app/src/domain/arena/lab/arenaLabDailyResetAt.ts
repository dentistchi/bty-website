/**
 * Leadership Lab **UTC** 일일 경계 — `usage_date` / `todayUtc()` 와 동일한 달력일 기준.
 * 주어진 시각이 속한 UTC 날짜의 **다음** UTC 자정(다음 날 00:00:00.000Z)을 반환한다.
 * 로컬 DST·타임존 오프셋과 무관(**UTC 컴포넌트만** 사용).
 *
 * @throws {RangeError} `Date` 가 Invalid 인 경우
 */

export function arenaLabDailyResetAt(now: Date): Date {
  const ms = now.getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError("Invalid Date");
  }
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  return new Date(Date.UTC(y, mo, d + 1, 0, 0, 0, 0));
}
