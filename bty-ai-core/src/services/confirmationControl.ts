/**
 * ConfirmationControl
 * Controls when to use soft confirmation phrases.
 *
 * RULE: Never stack confirmation + question in the same turn.
 * When using confirmation, omit the usual follow-up question.
 */

export type ConfirmationContext = {
  silenceMode: boolean;
  riskLevel: string;
  lastConfirmationWithin3Turns: boolean;
  confirmationCountInSession: number;
  interpretationConfidence: number;
  userMessage: string;
};

/** Soft confirmation phrases only - no stacking with questions */
const CONFIRMATION_PHRASES = [
  "맞아요?",
  "그런 의미인가요?",
  "제가 이해한 게 맞다면…",
] as const;

/** Patterns indicating user doubt or seeking validation */
const DOUBT_PATTERNS = [
  /그런가\??\s*$/,
  /그런가요\??\s*$/,
  /맞나\??\s*$/,
  /맞나요\??\s*$/,
  /그렇나\??\s*$/,
  /그렇죠\??\s*$/,
  /맞죠\??\s*$/,
  /그래\??\s*$/,
  /그런거야\??\s*$/,
];

/**
 * Returns true if user message suggests doubt or seeking validation.
 */
function userShowsDoubt(userMessage: string): boolean {
  const trimmed = (userMessage || "").trim();
  if (!trimmed) return false;

  // Explicit doubt phrases
  if (/그런가|맞나|그렇나/.test(trimmed)) return true;

  // Short questioning endings
  return DOUBT_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Decides whether to use a confirmation phrase this turn.
 * Rules (in order):
 * - If silenceMode == true → return false
 * - If riskLevel == "high" → return false
 * - If lastConfirmationWithin3Turns == true → return false
 * - If confirmationCountInSession >= 3 → return false
 * - If interpretationConfidence < 0.6 → return true
 * - If user asks "그런가?" or shows doubt → return true
 * - Else return false
 */
export function shouldUseConfirmation(context: ConfirmationContext): boolean {
  if (context.silenceMode) return false;
  if (context.riskLevel === "high") return false;
  if (context.lastConfirmationWithin3Turns) return false;
  if (context.confirmationCountInSession >= 3) return false;

  if (context.interpretationConfidence < 0.6) return true;
  if (userShowsDoubt(context.userMessage)) return true;

  return false;
}

/**
 * Returns a random soft confirmation phrase.
 * Only use when shouldUseConfirmation returned true.
 * Rule: Never stack confirmation + question in same turn.
 */
export function getConfirmationPhrase(): string {
  const idx = Math.floor(Math.random() * CONFIRMATION_PHRASES.length);
  return CONFIRMATION_PHRASES[idx];
}
