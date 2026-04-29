/**
 * Integrity(역지사지) 도메인 — 타입 정의만.
 * 순수 타입·상수. 검증 로직은 validation.ts.
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

/** Payload for integrity (역지사지) submit: at least one of text or choiceId required. */
export type IntegritySubmitPayload = {
  text?: string | null;
  choiceId?: string | null;
};

/** Max length for free-text response (chars). */
export const INTEGRITY_MAX_TEXT_LENGTH = 5_000;
