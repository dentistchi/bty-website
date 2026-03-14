/**
 * Center assessment 도메인 — 순수 타입·검증 함수.
 * DB/fetch 금지. 기존 scoreAnswers·detectPattern은 src/lib/assessment/score.ts에 유지.
 */

export type AssessmentSubmission = {
  userId: string;
  answersById: Record<number, number>;
  scores: Record<string, number>;
  pattern: string;
  recommendedTrack: string;
};

export type AssessmentHistory = {
  id: string;
  scores: Record<string, number>;
  pattern: string;
  track: string;
  createdAt: string;
};

/**
 * Validate assessment answers: every question must be answered with 1–5.
 * @param answers - { [questionId]: likertValue }
 * @param questionCount - expected total questions (e.g. 50)
 */
export function validateAssessmentAnswers(
  answers: Record<number, number>,
  questionCount: number
): { ok: boolean; error?: string } {
  if (!answers || typeof answers !== "object") {
    return { ok: false, error: "answers_empty" };
  }

  const keys = Object.keys(answers);
  if (keys.length === 0) {
    return { ok: false, error: "answers_empty" };
  }
  if (keys.length !== questionCount) {
    return {
      ok: false,
      error: `answers_count_mismatch: expected ${questionCount}, got ${keys.length}`,
    };
  }

  for (const key of keys) {
    const val = answers[Number(key)];
    if (typeof val !== "number" || val < 1 || val > 5 || !Number.isInteger(val)) {
      return { ok: false, error: `answer_out_of_range: q${key}=${val}` };
    }
  }

  return { ok: true };
}
