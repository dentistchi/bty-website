/**
 * Leadership Lab 일일 시도 허용 여부 — 순수 규칙. DB/시간 API 호출 없음.
 * `usageDateKey` ≠ `nowDateKey` 이면 **당일 사용량 0**으로 간주(일일 리셋). 같으면 **`attemptsUsedOnUsageDate`** 사용.
 *
 * @see docs/spec/ARENA_LAB_XP_SPEC.md §4·§7 (`daily_lab_usage` · UTC 일)
 */

/** 일일 Lab 시도 상한 — `lib/bty/arena/arenaLabXp` `LAB_DAILY_ATTEMPT_LIMIT` 과 동일 값. */
export const ARENA_LAB_DAILY_ATTEMPT_LIMIT = 3;

function nonNegativeInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export type IsArenaLabAttemptAllowedInput = {
  /** 저장된 사용 행의 달력일 **YYYY-MM-DD** (UTC 등 호출자 합의). */
  usageDateKey: string;
  /** 비교 기준 “오늘” **YYYY-MM-DD**. */
  nowDateKey: string;
  /** `usageDateKey` 당일에 이미 소진한 시도 수 (제출 성공 기준). */
  attemptsUsedOnUsageDate: number;
};

/**
 * @returns 남은 시도가 있으면 **true** (`used < limit`). 한도 도달·초과는 **false**.
 */
export function isArenaLabAttemptAllowed(
  input: IsArenaLabAttemptAllowedInput,
): boolean {
  const limit = ARENA_LAB_DAILY_ATTEMPT_LIMIT;
  if (limit <= 0) return false;

  const used =
    input.usageDateKey === input.nowDateKey
      ? nonNegativeInt(input.attemptsUsedOnUsageDate)
      : 0;

  return used < limit;
}
