/**
 * `nearMe` 슬라이스: 전체 리더보드 **정렬 순**에서 **연속 rank 구간**이어야 함 (API 전제).
 */

export function leaderboardNearMeSliceBounds(
  myRank1Based: number,
  totalRows: number
): { startIndex: number; endExclusive: number } {
  const n = Math.max(0, Math.floor(totalRows));
  const r = Math.max(0, Math.floor(myRank1Based));
  const start = Math.max(0, r - 6);
  const end = Math.min(n, r + 6);
  return { startIndex: start, endExclusive: end };
}

/** nearMe 행의 rank가 1씩 증가하는 연속 구간인지(클라 재배열 금지 단언). */
export function leaderboardNearMeRanksAreContiguous(
  nearMeRows: readonly { rank: number }[]
): boolean {
  if (nearMeRows.length <= 1) return true;
  for (let i = 1; i < nearMeRows.length; i++) {
    if (nearMeRows[i]!.rank !== nearMeRows[i - 1]!.rank + 1) return false;
  }
  return true;
}
