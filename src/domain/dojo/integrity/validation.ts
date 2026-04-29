/**
 * Integrity(역지사지) 도메인 — 검증 함수만.
 * 순수 함수. DB/fetch 금지.
 */

import { INTEGRITY_MAX_TEXT_LENGTH } from "./types";

export type ValidateIntegrityResult = { ok: boolean; error?: string };

/**
 * Validate integrity response: at least one of text or choiceId required.
 * Text must be non-empty after trim and <= INTEGRITY_MAX_TEXT_LENGTH.
 */
export function validateIntegrityResponse(
  text?: string | null,
  choiceId?: string | null,
): ValidateIntegrityResult {
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasChoice = typeof choiceId === "string" && choiceId.length > 0;

  if (!hasText && !hasChoice) {
    return { ok: false, error: "missing_input" };
  }

  if (hasText && text!.length > INTEGRITY_MAX_TEXT_LENGTH) {
    return { ok: false, error: "text_too_long" };
  }

  return { ok: true };
}
