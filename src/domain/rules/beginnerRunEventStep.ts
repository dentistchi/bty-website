/**
 * Beginner Arena run 이벤트 단계(2–5) — 순수 검증. XP·주간 랭킹·시즌과 무관.
 */

export type BeginnerEventStep = 2 | 3 | 4 | 5;

/** emotion/risk/integrity/decision 단계만 허용. */
export function isValidBeginnerEventStep(step: unknown): step is BeginnerEventStep {
  const n = Number(step);
  return n === 2 || n === 3 || n === 4 || n === 5;
}
