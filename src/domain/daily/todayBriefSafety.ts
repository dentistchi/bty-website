/**
 * Today Brief safety — pure domain (Slice 3.1B-3J). Two conservative gates around the assistive AI:
 *   1. looksSensitive(text) — BEFORE any Reflection text is sent to the LLM. If likely patient /
 *      sensitive identifiers are present, that Reflection body is NOT sent (and never logged/hashed).
 *   2. isSafeBriefSentence(s) — AFTER generation. Rejects diagnostic / personality / health / loyalty
 *      language so no such output can ever reach Today.
 * Plus the deterministic neutral fallback copy (a safety fallback, NOT an interpretation).
 */

// ── Gate 1: sensitive-identifier detection (conservative) ────────────────────────────────
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// grouped digits with any separators (spaces/parens/dashes/dots) between them, 7+ digits total —
// letters break the run, so ordinary prose with a couple of numbers is not flagged.
const PHONE = /(?:\+?\d[\s().-]*){7,}/;
// account / chart / MRN-ish long digit runs
const LONG_ID = /\d{6,}/;
// DOB-ish full dates (YYYY-MM-DD or D/M/YYYY, common separators)
const DOB =
  /\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b|\b(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b/;

/** True when the text likely carries sensitive identifiers → must NOT be sent to the LLM. */
export function looksSensitive(text: string): boolean {
  if (!text) return false;
  return EMAIL.test(text) || PHONE.test(text) || LONG_ID.test(text) || DOB.test(text);
}

// ── Gate 2: diagnostic / personality / health / loyalty language (reject on output) ──────
const BANNED: RegExp[] = [
  // English
  /\bantisocial\b/i,
  /\bavoid(?:s|ing)?\s+(?:conflict|relationships|people)\b/i,
  /\bconflict[-\s]?avoidant\b/i,
  /\bnot\s+a\s+people\s+person\b/i,
  /\blow\s+emotional\s+intelligence\b/i,
  /\b(?:you\s+(?:are|seem|appear)|you're)\s+(?:depressed|anxious|narcissistic|lazy|incompetent|weak|toxic|introverted|extroverted)\b/i,
  /\bmental\s+health\b/i,
  /\bpersonality\b/i,
  /\bdiagnos(?:is|ed|e)\b/i,
  /\bdisloyal|loyalty\b/i,
  // Korean
  /반사회적|성격\s*장애|우울(?:증|해)|불안\s*장애|정신\s*건강|성격이|충동적|나르시시스트|무능|게으르/,
];

/** A generated brief sentence is safe only if non-empty, bounded, and free of banned language. */
export function isSafeBriefSentence(s: string): boolean {
  const t = (s ?? "").trim();
  if (t.length < 1 || t.length > 240) return false;
  return !BANNED.some((re) => re.test(t));
}

/** Both sentences must pass. */
export function isSafeBrief(observation: string, suggestion: string): boolean {
  return isSafeBriefSentence(observation) && isSafeBriefSentence(suggestion);
}

/** Deterministic neutral fallback (safety fallback, not interpretation). */
export const NEUTRAL_BRIEF: Record<"en" | "ko", { yesterdayObservation: string; todaySuggestion: string }> = {
  en: {
    yesterdayObservation: "Yesterday's reflection may still matter today.",
    todaySuggestion: "Choose one small next action you can take.",
  },
  ko: {
    yesterdayObservation: "어제의 성찰은 오늘과 이어질 수 있습니다.",
    todaySuggestion: "오늘 할 수 있는 작은 다음 행동 하나를 선택해 보세요.",
  },
};
