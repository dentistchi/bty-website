/**
 * Center letter 도메인 — 순수 타입·검증 함수.
 * DB/fetch 금지. UI/API는 이 모듈의 타입과 검증만 사용.
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

const MAX_BODY_LENGTH = 10_000;

export function validateLetterBody(body: string): { ok: boolean; error?: string } {
  if (typeof body !== "string" || body.trim().length === 0) {
    return { ok: false, error: "body_empty" };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { ok: false, error: "body_too_long" };
  }
  return { ok: true };
}
