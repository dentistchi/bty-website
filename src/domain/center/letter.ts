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

export type LetterWithReply = {
  id: string;
  body: string;
  reply: string | null;
  locale: LetterLocale;
  createdAt: string;
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
