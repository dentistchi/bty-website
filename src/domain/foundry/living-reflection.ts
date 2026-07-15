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
const QUESTION_MAX = 200; // how much of the host's completion question we ground with

/** The deterministic meaning distilled from reality — the input the expression uses. */
export type ReflectionContext = {
  completionState: CompletionState;
  hasResponse: boolean;
  /** The participant's own words, sanitized + trimmed. Grounding, never invented. */
  responseExcerpt: string;
  /** Whether the host attached a completion question worth grounding against. */
  hasQuestion: boolean;
  /**
   * The host's completion question, sanitized + trimmed. Grounding evidence only:
   * the reflection may connect the participant's words to what was asked, but must
   * never ANSWER it. Empty when the event has no usable question.
   */
  questionExcerpt: string;
  locale: ReflectionLocale;
};

export function normalizeReflectionLocale(locale: unknown): ReflectionLocale {
  return locale === "ko" ? "ko" : "en";
}

/** Collapse whitespace to one line and cap length. Never invents; only trims. */
function sanitizeText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  // Collapse whitespace/newlines to a single line for grounding; strip nothing
  // meaningful. The text was already control-char-stripped at capture.
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max).trimEnd() + "…";
}

/**
 * RULE ENGINE + CONTEXT BUILDER. Deterministically decide the meaning from real
 * evidence. This is the ONLY place "what today meant" is judged.
 *
 * Grounding evidence is exactly three things — what was watched (completionState),
 * what the host asked (questionText), and what the participant answered
 * (responseText). No metric, no invented fact.
 */
export function buildReflectionContext(input: {
  completionState: CompletionState;
  responseText?: unknown;
  questionText?: unknown;
  locale?: unknown;
}): ReflectionContext {
  const excerpt = sanitizeText(input.responseText, EXCERPT_MAX);
  const question = sanitizeText(input.questionText, QUESTION_MAX);
  return {
    completionState: input.completionState,
    hasResponse: excerpt.length > 0,
    responseExcerpt: excerpt,
    hasQuestion: question.length > 0,
    questionExcerpt: question,
    locale: normalizeReflectionLocale(input.locale),
  };
}

// ---------------------------------------------------------------------------
// Reflection Validator — the gate every expression (LLM or template) must pass.
// ---------------------------------------------------------------------------

export type ReflectionValidation =
  | { ok: true; value: LivingReflection }
  | { ok: false; reason: string };

/** Optional grounding context so cross-section rules (question repetition) can run. */
export type ReflectionValidationContext = {
  questionExcerpt?: string;
  responseExcerpt?: string;
};

/** A living sentence / quoted line shorter than this many words is a bare fragment. */
const MIN_SENTENCE_WORDS = 4;
/** Two sections sharing more than this fraction of significant words are duplicates. */
const MAX_SECTION_SIMILARITY = 0.6;

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
 * Quality guard (V1). A Living Reflection is a mirror held up to the person — it
 * speaks to "you", grounds only in their own words + the host's frame, and never
 * turns watch-state into a verdict about who they are. These reject the exact
 * failure modes seen live: third-person reporting ("the participant noted…"),
 * watch-behavior interpreted as intent ("a conscious choice to limit engagement"),
 * generic coaching, praise, character claims, and answer-grading.
 */
const QUALITY_FORBIDDEN_PATTERNS: RegExp[] = [
  // Third-person references to the employee — a mirror always speaks to "you".
  /\bthe (participant|participants|user|users|employee|employees|learner|viewer)\b/i,
  /\bparticipant(?:'s|s)?\b/i,
  // Watch-behavior read as motivation / effort / attention / avoidance / engagement.
  /\bengag(?:e|es|ed|ing|ement)\b/i,
  /\bconscious(?:ly)?\b/i,
  /\bchose to\b/i,
  /\bchoice to\b/i,
  /\bavoid(?:ed|ing|s)?\b/i,
  /\bskip(?:ped|ping|s)?\b/i,
  /\black(?:ed|ing|s)?\b/i,
  /\beffort\b/i,
  /\bpay(?:ing)? attention\b/i,
  /\bnot (?:fully |really )?(?:engaged|present|watching|paying attention)\b/i,
  /\bwatched? (?:less|more|little|enough)\b/i,
  // Personality / character claims.
  /\byour personality\b/i,
  /\bthis shows (?:that )?you\b/i,
  /\byou are (?:a|an|the)\b/i,
  /\byou tend to\b/i,
  // Generic praise.
  /\b(?:great job|well done|good job|good work|excellent|amazing|fantastic|impressive|wonderful|brilliant)\b/i,
  /\bstrong leader\b/i,
  // "Correct answer" framing.
  /\b(?:correct|right|wrong|incorrect) answer\b/i,
  /\byou(?:'| a)?re (?:correct|right|wrong|incorrect)\b/i,
  // Generic coaching / commands that would fit anyone.
  /\bconsider how\b/i,
  /\bthink about how\b/i,
  /\byou should\b/i,
  /\bmake sure\b/i,
  /\bclear communication\b/i,
];

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Significant words (length ≥ 4) — the basis for near-duplicate detection. */
function significantTokens(s: string): Set<string> {
  return new Set(normalizeForMatch(s).split(/[^a-z0-9]+/i).filter((w) => w.length >= 4));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Validate a reflection against the mirror contract:
 *  - exactly the four string sections, each non-empty and within the cap,
 *  - no leaked raw metrics, no score/grade/homework framing,
 *  - no third-person reporting, watch-behavior judgment, praise, character claims,
 *    answer-grading, or generic coaching (the live-failure quality guard),
 *  - the living sentence is a real line, not a bare 1–3 word fragment,
 *  - the four sections do not restate one idea, and the host question is not
 *    repeated verbatim across sections.
 * On ANY failure the caller falls back to the deterministic template.
 */
export function validateLivingReflection(
  input: unknown,
  ctx?: ReflectionValidationContext,
): ReflectionValidation {
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
    for (const pattern of QUALITY_FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmed)) return { ok: false, reason: `quality_${key}` };
    }
    out[key] = trimmed;
  }

  // The living sentence / quoted line must be a real line, never a bare fragment.
  if (wordCount(out.livingSentence) < MIN_SENTENCE_WORDS) {
    return { ok: false, reason: "quote_fragment" };
  }

  // The four sections must each do their own job — reject near-duplicates.
  const tokenSets = REFLECTION_SECTION_KEYS.map((k) => significantTokens(out[k]));
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      if (jaccard(tokenSets[i], tokenSets[j]) > MAX_SECTION_SIMILARITY) {
        return { ok: false, reason: "sections_repeat" };
      }
    }
  }

  // The host question may frame one section, but must not be repeated verbatim.
  const q = ctx?.questionExcerpt ? normalizeForMatch(ctx.questionExcerpt).replace(/[?.!]+$/, "").trim() : "";
  if (q.length >= 12) {
    let hits = 0;
    for (const key of REFLECTION_SECTION_KEYS) {
      if (normalizeForMatch(out[key]).includes(q)) hits++;
    }
    if (hits >= 2) return { ok: false, reason: "question_repeated" };
  }

  return { ok: true, value: out };
}
