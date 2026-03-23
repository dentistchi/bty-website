/**
 * Leadership Lab 점수 — 순수 계산. API/표시용; Core/Weekly XP 지급량과 별개일 수 있음.
 *
 * - **난이도 가중치** = `ARENA_LAB_XP_SPEC.md` §2 **base** (easy 10 · mid 20 · hard 35 · extreme 50).
 * - **시도 가중치** = `(일일 상한 + 1 − n번째 시도) / 일일 상한` — 첫 시도 **100%**, 세 번째 시도 **1/3**.
 *
 * @see docs/spec/ARENA_LAB_XP_SPEC.md §2 · §4 (일일 3회)
 */

import type { ArenaLabDifficultyKey } from "../scenarios/arenaLabDifficultyKeyFromUnknown";

/** 일일 Lab 시도 상한 (제출 성공 기준) — 스펙과 동일 값. */
export const ARENA_LAB_SCORE_ATTEMPT_LIMIT = 3;

/** 극한 난이도 + 첫 시도 기준 점수 상한 (`50 × 1`). */
export const ARENA_LAB_SCORE_MAX = 50;

const DIFFICULTY_WEIGHT: Record<ArenaLabDifficultyKey, number> = {
  easy: 10,
  mid: 20,
  hard: 35,
  extreme: 50,
};

export type CalculateArenaLabScoreInput = {
  difficulty: ArenaLabDifficultyKey;
  /** 1 = 당일 첫 제출 시도 … `ARENA_LAB_SCORE_ATTEMPT_LIMIT` = 상한 내 마지막 시도 */
  attemptCount: number;
};

/**
 * @returns 정수 점수 **≥ 0**. 비정상 `attemptCount`(1‥상한 밖·비정수) 또는 알 수 없는 난이도 → **0**.
 */
export function calculateArenaLabScore(input: CalculateArenaLabScoreInput): number {
  const { difficulty, attemptCount } = input;
  if (!Number.isFinite(attemptCount) || !Number.isInteger(attemptCount)) return 0;
  if (attemptCount < 1 || attemptCount > ARENA_LAB_SCORE_ATTEMPT_LIMIT) return 0;
  const w = DIFFICULTY_WEIGHT[difficulty];
  if (w === undefined) return 0;
  const mult =
    (ARENA_LAB_SCORE_ATTEMPT_LIMIT + 1 - attemptCount) / ARENA_LAB_SCORE_ATTEMPT_LIMIT;
  return Math.max(0, Math.round(w * mult));
}
