/**
 * Integrity(역지사지) 도메인 — 타입·검증 함수.
 * 순수 함수만. DB/fetch 금지.
 */

export type IntegrityScenario = {
  id: string;
  situationKo: string;
  situationEn: string;
  choices: { id: string; labelKo: string; labelEn: string }[];
};

export type IntegritySubmission = {
  userId: string;
  scenarioId: string;
  text?: string | null;
  choiceId?: string | null;
  createdAt: string;
};

/** Payload for validateIntegritySubmit / validateIntegrityResponse (text or choiceId). */
export type IntegritySubmitPayload = {
  text?: string | null;
  choiceId?: string | null;
};

const MAX_TEXT_LENGTH = 5_000;

/**
 * Validate integrity response: at least one of text or choiceId required.
 * Text must be non-empty after trim and <= 5000 chars.
 */
export function validateIntegrityResponse(
  text?: string | null,
  choiceId?: string | null,
): { ok: boolean; error?: string } {
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasChoice = typeof choiceId === "string" && choiceId.length > 0;

  if (!hasText && !hasChoice) {
    return { ok: false, error: "missing_input" };
  }

  if (hasText && text!.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: "text_too_long" };
  }

  return { ok: true };
}
