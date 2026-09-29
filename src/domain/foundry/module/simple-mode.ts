/**
 * FOUNDRY SIMPLE MODE — pure helpers for the compact Review (Slice 2). No I/O.
 *
 * Review shows four plain facts: the title, what they'll learn, what they'll do differently and
 * roughly how long it takes. Everything here is DERIVED from what was already generated and
 * adopted; nothing is invented and nothing internal (evidence, verification, generation metadata)
 * can reach the manager through these functions.
 */
import type { RealityGroundedJourneyV1 } from "./journey";
import type { BuilderAnswers } from "./module-builder";

/** First sentence of the adopted "why it matters" section — the plain answer to "what will they learn". */
export function learnSummary(journey: RealityGroundedJourneyV1 | undefined): string | null {
  const why = journey?.elements?.find((e) => e.kind === "why_it_matters")?.content?.trim();
  if (!why) return null;
  const first = why.split(/(?<=[.!?。])\s+/)[0]?.trim() ?? why;
  return first.length > 240 ? `${first.slice(0, 237).trimEnd()}…` : first;
}

/** Reading pace for the estimate. Deliberately modest so the number is not a promise. */
const WORDS_PER_MINUTE = 180;
/** Korean is counted by characters, which a word split would badly undercount. */
const KO_CHARS_PER_MINUTE = 500;
/** Each section that asks the learner to answer or decide takes about a minute of their own. */
const RESPONSE_KINDS = new Set(["reflection", "action_decision", "completion_check", "field_application"]);

function readingMinutes(text: string): number {
  const ko = (text.match(/[가-힣]/g) ?? []).length;
  if (ko > 0) return ko / KO_CHARS_PER_MINUTE;
  return (text.match(/\S+/g) ?? []).length / WORDS_PER_MINUTE;
}

/**
 * Approximate minutes for a learner: read the material and every section, plus about one minute for
 * each place they must respond. Rounded up, never below 2 — it is an estimate, stated as one.
 */
export function approximateMinutes(journey: RealityGroundedJourneyV1 | undefined, materialText: string | undefined): number {
  const elements = journey?.elements ?? [];
  const reading = readingMinutes(materialText ?? "") + elements.reduce((n, e) => n + readingMinutes(e.content ?? ""), 0);
  const responding = elements.filter((e) => RESPONSE_KINDS.has(e.kind)).length;
  return Math.max(2, Math.ceil(reading + responding));
}

/**
 * SIMPLE MODE REFUSAL HANDOFF — does the protection hold right now?
 *
 * Only for a draft Simple Mode handed over after its repair was refused, and only while the answers
 * still produce the refused fingerprint. `currentFingerprint` must be the canonical
 * `programContextFingerprint` — the same one the attempt ledger keys refusals by — so "unchanged"
 * means exactly what the ledger means by it. An empty fingerprint (incomplete answers) never holds.
 */
export function simpleHandoffHolds(answers: BuilderAnswers | undefined, currentFingerprint: string): boolean {
  const h = answers?.simpleRefusalHandoffV1;
  return !!h && h.active === true && currentFingerprint.length > 0 && h.fingerprint === currentFingerprint;
}
