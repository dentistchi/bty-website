/**
 * Center letter 도메인 — 순수 타입·검증 함수.
 * DB/fetch 금지. 본문: trim 후 1자 이상, 길이 ≤ `LETTER_BODY_MAX_LENGTH` (10000).
 * @see resilience — `LetterRow`·`aggregateLetterRowsToDailyEntries` for energy 트렉.
 */

export type LetterLocale = "ko" | "en";

export type LetterSubmission = {
  body: string;
  locale: LetterLocale;
  userId: string;
};

/** DECISION6 C2: one Q/A pair within a Day Reflection Set. */
export type DayReflectionQA = { q: string; a: string };

/**
 * DECISION6 C2: stored shape of a day_reflection's `responses` jsonb.
 * Strings are already locale-selected at save time (form picks ko/en before
 * submitting) — no locale resolution needed at read/render time.
 */
export type DayReflectionResponses = {
  title: string;
  questions: DayReflectionQA[];
  finalReflection: string;
};

export type LetterWithReply = {
  id: string;
  body: string;
  reply: string | null;
  locale: LetterLocale;
  createdAt: string;
  /** DECISION6 C2: 'day_reflection' carries `responses`; legacy letters = 'letter' (optional, non-breaking). */
  type?: "letter" | "reflection" | "day_reflection";
  /** DECISION6 C2: train Day number when type='day_reflection'. */
  day?: number | null;
  /** DECISION6 C2: structured Q/A set when type='day_reflection'; null otherwise. */
  responses?: DayReflectionResponses | null;
};

/** 편지 본문 최대 길이(자). API·검증 단일 소스. */
export const LETTER_BODY_MAX_LENGTH = 10_000;

export function validateLetterBody(body: string): { ok: boolean; error?: string } {
  if (typeof body !== "string" || body.trim().length === 0) {
    return { ok: false, error: "body_empty" };
  }
  if (body.length > LETTER_BODY_MAX_LENGTH) {
    return { ok: false, error: "body_too_long" };
  }
  return { ok: true };
}
