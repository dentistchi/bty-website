import type { AssessmentAnswers, DimensionKey, DimensionScores, Likert, Question } from "./types";

export const DIMENSIONS: DimensionKey[] = [
  "core_self_esteem",
  "self_compassion",
  "self_esteem_stability",
  "growth_mindset",
  "social_self_esteem",
];

export function reverseScore(v: Likert): Likert {
  // 1<->5, 2<->4, 3 stays
  return (6 - v) as Likert;
}

/**
 * Convert sum(10..50) -> 0..100
 */
export function scaleTo100(sum: number): number {
  const raw = ((sum - 10) / 40) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped);
}

export function computeDimensionScores(questions: Question[], answers: AssessmentAnswers): DimensionScores {
  const bucket: Record<DimensionKey, number[]> = {
    core_self_esteem: [],
    self_compassion: [],
    self_esteem_stability: [],
    growth_mindset: [],
    social_self_esteem: [],
  };

  for (const q of questions) {
    const a = answers[q.id];
    if (!a) continue; // unanswered -> ignored (UI should prevent submit until complete)
    const scored = q.reverse ? reverseScore(a) : a;
    bucket[q.dimension].push(scored);
  }

  const out = {} as DimensionScores;
  for (const d of DIMENSIONS) {
    const arr = bucket[d];
    // Expect 10 items; if not, still compute safely
    const sum = arr.reduce((acc, n) => acc + n, 0);
    // If missing, approximate min floor by treating missing as neutral(3)
    const missing = Math.max(0, 10 - arr.length);
    const adjustedSum = sum + missing * 3;
    out[d] = scaleTo100(adjustedSum);
  }
  return out;
}
