/**
 * Foundry Living Reflection — pure domain (AI Reflection V1).
 *
 * THE MIRROR, NOT THE JUDGE. A reflection is never evaluation, never a score,
 * never homework. It always has exactly four sections:
 *   1. What Emerged        — the thinking that showed up
 *   2. Where You Stretched  — how today differed
 *   3. Living Sentence     — one memorable BTY sentence
 *   4. Next Invitation     — one invitation for tomorrow
 *
 * This module owns the DECISION half of the pipeline (pure, no display strings):
 *   Reality → Rule Engine (meaning) → Context Builder → [LLM/template EXPRESS] → Validator
 *
 * The RULE ENGINE distills meaning deterministically from real evidence (the
 * participant's own words + the watch CompletionState). The EXPRESSION half — the
 * localized template prose and prompts — lives in the service layer
 * (`reflectionExpression.ts`), because "AI expresses" is an expression concern,
 * not a domain rule. The VALIDATOR here is the gate every expression (LLM or
 * template) must pass: it rejects anything that leaks raw metrics, empties a
 * section, or slips into scoring/homework.
 *
 * No DB, no network, no framework, NO display strings.
 */

import type { CompletionState } from "./watch-integrity";

export const REFLECTION_VERSION = "v1";

/** The two product locales. Kept here (a pure type) so domain never imports copy. */
export type ReflectionLocale = "en" | "ko";

/** The four-section mirror. Order is meaningful and fixed. */
export type LivingReflection = {
  whatEmerged: string;
  whereYouStretched: string;
  livingSentence: string;
  nextInvitation: string;
};

export const REFLECTION_SECTION_KEYS: (keyof LivingReflection)[] = [
  "whatEmerged",
  "whereYouStretched",
  "livingSentence",
  "nextInvitation",
];

const SECTION_MAX = 600; // per-section hard cap (keeps the mirror brief)
const EXCERPT_MAX = 160; // how much of the participant's own words we ground with

/** The deterministic meaning distilled from reality — the input the expression uses. */
export type ReflectionContext = {
  completionState: CompletionState;
  hasResponse: boolean;
  /** The participant's own words, sanitized + trimmed. Grounding, never invented. */
  responseExcerpt: string;
  locale: ReflectionLocale;
};

export function normalizeReflectionLocale(locale: unknown): ReflectionLocale {
  return locale === "ko" ? "ko" : "en";
}

function sanitizeExcerpt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Collapse whitespace/newlines to a single line for grounding; strip nothing
  // meaningful. The response was already control-char-stripped at capture.
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= EXCERPT_MAX) return oneLine;
  return oneLine.slice(0, EXCERPT_MAX).trimEnd() + "…";
}

/**
 * RULE ENGINE + CONTEXT BUILDER. Deterministically decide the meaning from real
 * evidence. This is the ONLY place "what today meant" is judged.
 */
export function buildReflectionContext(input: {
  completionState: CompletionState;
  responseText?: unknown;
  locale?: unknown;
}): ReflectionContext {
  const excerpt = sanitizeExcerpt(input.responseText);
  return {
    completionState: input.completionState,
    hasResponse: excerpt.length > 0,
    responseExcerpt: excerpt,
    locale: normalizeReflectionLocale(input.locale),
  };
}

// ---------------------------------------------------------------------------
// Reflection Validator — the gate every expression (LLM or template) must pass.
// ---------------------------------------------------------------------------

export type ReflectionValidation =
  | { ok: true; value: LivingReflection }
  | { ok: false; reason: string };

/**
 * Raw watch metrics MUST NEVER reach the user, and a reflection must never turn
 * into a score/grade/homework. These patterns reject an expression that leaks
 * telemetry or slips into evaluation.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\d+\s*%/, // any percentage — would leak coverage
  /\bcoverage\b/i,
  /\bforward[-\s]?seek/i,
  /\bseek(?:s|ed|ing)?\b/i,
  /\bmetric/i,
  /\bscore\b/i,
  /\bgrade\b/i,
  /\bhomework\b/i,
  /\bas an ai\b/i,
  /\blanguage model\b/i,
];

/**
 * Validate a reflection against the four rules:
 *  - exactly the four string sections, each non-empty and within the cap,
 *  - no leaked raw metrics, no score/grade/homework framing.
 * On any failure the caller falls back to the deterministic template.
 */
export function validateLivingReflection(input: unknown): ReflectionValidation {
  if (!input || typeof input !== "object") return { ok: false, reason: "not_object" };
  const obj = input as Record<string, unknown>;

  const out = {} as LivingReflection;
  for (const key of REFLECTION_SECTION_KEYS) {
    const raw = obj[key];
    if (typeof raw !== "string") return { ok: false, reason: `missing_${key}` };
    const trimmed = raw.trim();
    if (trimmed.length < 1) return { ok: false, reason: `empty_${key}` };
    if (trimmed.length > SECTION_MAX) return { ok: false, reason: `too_long_${key}` };
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmed)) return { ok: false, reason: `forbidden_${key}` };
    }
    out[key] = trimmed;
  }
  return { ok: true, value: out };
}
