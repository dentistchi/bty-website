/**
 * Center assessment 도메인 — 순수 타입·검증 함수.
 * DB/fetch 금지. 제출 후 네비게이션·CTA = `center/paths` (`getCenterCtaHref`, `CENTER_CTA_PATH`).
 * 진행 규칙 = `questionCount`·Likert 1–5 `validateAssessmentAnswers`.
 */

/** 리커트 응답 경계 (1–5). validateAssessmentAnswers 단일 소스. */
export const ASSESSMENT_LIKERT_MIN = 1 as const;
export const ASSESSMENT_LIKERT_MAX = 5 as const;

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
 * Validate assessment answers: every question must be answered with 1–5 (ASSESSMENT_LIKERT_MIN–MAX).
 * @param answers - { [questionId]: likertValue }
 * @param questionCount - expected total questions (e.g. 50)
 * @see paths — post-submit CTA uses getCenterCtaHref(locale).
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
    if (typeof val !== "number" || val < ASSESSMENT_LIKERT_MIN || val > ASSESSMENT_LIKERT_MAX || !Number.isInteger(val)) {
      return { ok: false, error: `answer_out_of_range: q${key}=${val}` };
    }
  }

  return { ok: true };
}
