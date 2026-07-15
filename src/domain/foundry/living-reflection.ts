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
const EXCERPT_MAX = 160; // a short one-line snippet of the participant's own words
const RESPONSE_FULL_MAX = 1000; // full response for grounding + clause selection (no ellipsis)
const QUESTION_MAX = 200; // how much of the host's completion question we ground with

/** The deterministic meaning distilled from reality — the input the expression uses. */
export type ReflectionContext = {
  completionState: CompletionState;
  hasResponse: boolean;
  /** A short one-line snippet of the participant's words (may end with "…"). */
  responseExcerpt: string;
  /**
   * The participant's full words, sanitized + whitespace-collapsed, hard-capped
   * but NEVER ellipsis-truncated — the grounding source for the LLM and for
   * deterministic clause selection. Grounding, never invented.
   */
  responseFull: string;
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

/**
 * Collapse whitespace to one line and cap length. Never invents; only trims.
 * `ellipsis` appends "…" when truncated (for short snippets); pass false to cut
 * cleanly at the cap without a visible marker (for the grounding source).
 */
function sanitizeText(raw: unknown, max: number, ellipsis = true): string {
  if (typeof raw !== "string") return "";
  // Collapse whitespace/newlines to a single line for grounding; strip nothing
  // meaningful. The text was already control-char-stripped at capture.
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  const cut = oneLine.slice(0, max).trimEnd();
  return ellipsis ? cut + "…" : cut;
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
  const full = sanitizeText(input.responseText, RESPONSE_FULL_MAX, false);
  const question = sanitizeText(input.questionText, QUESTION_MAX);
  return {
    completionState: input.completionState,
    hasResponse: full.length > 0,
    responseExcerpt: excerpt,
    responseFull: full,
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

/** Optional grounding context so cross-section rules (question repetition, frame) can run. */
export type ReflectionValidationContext = {
  questionExcerpt?: string;
  responseExcerpt?: string;
  responseFull?: string;
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
 * Quality guard (V1.1 recovery). A Living Reflection is a mirror — it speaks to
 * "you", grounds only in the person's own words + the host's frame, and never
 * turns watch-state into a verdict. Each rule carries a deterministic CODE so the
 * service can record WHY an expression was rejected without ever logging text.
 *
 * RECOVERY NOTE: the first guard banned bare words (avoid/skip/engage/conscious/
 * effort/lack) to stop watch-behavior judgment. But those words collide with the
 * employee's OWN subject — a response about avoiding a hard conversation is real
 * evidence, not a viewing verdict — so grounded output was wrongly rejected and
 * fell back to generic copy. The watch-judgment guard is now precise: it rejects
 * references to the ACT OF WATCHING / the video, plus tight viewing composites,
 * while letting the person's real-world words through. All OTHER proven safety
 * bans (third person, praise, grading, character claims, generic coaching) stand.
 */
type QualityRule = { re: RegExp; code: string };

const QUALITY_RULES: QualityRule[] = [
  // Third-person references to the employee — a mirror always speaks to "you".
  { re: /\bthe (?:participant|participants|user|users|employee|employees|learner|viewer)\b/i, code: "third_person" },
  { re: /\bparticipant(?:'s|s)?\b/i, code: "third_person" },
  // The reflection is never ABOUT the act of watching / the video itself.
  { re: /\b(?:video|clip|footage)\b/i, code: "watch_judgment" },
  { re: /\bwatch(?:es|ed|ing)?\b/i, code: "watch_judgment" },
  { re: /\b(?:viewing|playback|rewind)\b/i, code: "watch_judgment" },
  { re: /\bfast[-\s]?forward/i, code: "watch_judgment" },
  // Viewing-behavior verdicts that carry no explicit "video" word.
  { re: /\bnot (?:fully |really )?engaged\b/i, code: "watch_judgment" },
  { re: /\bskip(?:ped|ping)? ahead\b/i, code: "watch_judgment" },
  { re: /\black(?:ed|ing|s)?\s+(?:of\s+)?attention\b/i, code: "watch_judgment" },
  { re: /\bpay(?:ing)? attention\b/i, code: "watch_judgment" },
  // Personality / character claims — nothing about who they ARE.
  { re: /\byour personality\b/i, code: "unsupported_claim" },
  { re: /\bthis shows (?:that )?you\b/i, code: "unsupported_claim" },
  { re: /\byou are (?:a|an|the)\b/i, code: "unsupported_claim" },
  { re: /\byou tend to\b/i, code: "unsupported_claim" },
  { re: /\bbased on your\b/i, code: "unsupported_claim" },
  // Generic praise.
  { re: /\b(?:great job|well done|good job|good work|excellent|amazing|fantastic|impressive|wonderful|brilliant)\b/i, code: "praise" },
  { re: /\bstrong leader\b/i, code: "praise" },
  // "Correct answer" framing.
  { re: /\b(?:correct|right|wrong|incorrect) answer\b/i, code: "answer_grading" },
  { re: /\byou(?:'| a)?re (?:correct|right|wrong|incorrect)\b/i, code: "answer_grading" },
  // Generic coaching / commands that would fit anyone — plus the exact generic
  // filler phrases the deterministic fallback must never emit.
  { re: /\bconsider how\b/i, code: "generic_coaching" },
  { re: /\bthink about how\b/i, code: "generic_coaching" },
  { re: /\byou should\b/i, code: "generic_coaching" },
  { re: /\bmake sure\b/i, code: "generic_coaching" },
  { re: /\bclear communication\b/i, code: "generic_coaching" },
  { re: /\bput language to\b/i, code: "generic_coaching" },
  { re: /\bisn't simple\b/i, code: "generic_coaching" },
  { re: /\byou explored\b/i, code: "generic_coaching" },
  { re: /\byou showed awareness\b/i, code: "generic_coaching" },
  { re: /\bwhere your leadership begins\b/i, code: "generic_coaching" },
  { re: /\bwhat the question asked of you\b/i, code: "generic_coaching" },
  { re: /\blet this stay with you\b/i, code: "generic_coaching" },
  { re: /\bcarry this forward\b/i, code: "generic_coaching" },
  // Unsupported recurrence — a single training response is never "repeated
  // evidence", so recurrence framing invents a pattern that is not there.
  { re: /\byou keep \w+ing\b/i, code: "unsupported_recurrence" },
  { re: /\byou repeatedly\b/i, code: "unsupported_recurrence" },
  { re: /\byou continue to (?:notice|name|return|circle|point)\b/i, code: "unsupported_recurrence" },
  { re: /\bthis keeps (?:appearing|coming back|returning|surfacing)\b/i, code: "unsupported_recurrence" },
  { re: /\byou often\b/i, code: "unsupported_recurrence" },
  { re: /\byou always\b/i, code: "unsupported_recurrence" },
  { re: /\b(?:time and again|again and again)\b/i, code: "unsupported_recurrence" },
];

/**
 * Signals that the grounded frame is about delay / accumulating cost / impact on
 * others — the exact case where a "take your time" invitation would contradict the
 * reflection by permitting the very postponement being examined.
 */
const DELAY_COST_FRAME =
  /\b(?:delay|delayed|postpon\w*|procrastinat\w*|urgen\w*|overdue|waiting|the wait|putting (?:it|this|them) off|cost|costing|unclear expectation|the team|other people|people around|the others|everyone else)\b/i;

/** Gentle-patience / private-retreat phrases that must not stand against a delay frame. */
const PATIENCE_RETREAT =
  /\b(?:in your own time|when you(?:'re| are) ready|no rush|take your time|there is no hurry|yours to carry|carry this forward)\b/i;

/**
 * One source of truth for the expression bans (metrics + quality: third-person,
 * watch-judgment, identity/character claims, praise, grading, generic coaching,
 * unsupported recurrence). Returns the violated rule code, or null if clean.
 * Shared so the Living Thread validator enforces the SAME bans as the reflection.
 */
export function scanForbiddenExpression(text: string): string | null {
  for (const p of FORBIDDEN_PATTERNS) if (p.test(text)) return "metric_leak";
  for (const rule of QUALITY_RULES) if (rule.re.test(text)) return rule.code;
  return null;
}

/** True when the text reads as a delay / accumulating-cost / impact-on-others frame. */
export function matchesDelayCostFrame(text: string): boolean {
  return DELAY_COST_FRAME.test(text);
}

/** True when the text uses gentle-patience / private-retreat language. */
export function matchesPatienceRetreat(text: string): boolean {
  return PATIENCE_RETREAT.test(text);
}

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
    if (typeof raw !== "string") return { ok: false, reason: "malformed_shape" };
    const trimmed = raw.trim();
    if (trimmed.length < 1) return { ok: false, reason: "malformed_shape" };
    if (trimmed.length > SECTION_MAX) return { ok: false, reason: "malformed_shape" };
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmed)) return { ok: false, reason: "metric_leak" };
    }
    for (const rule of QUALITY_RULES) {
      if (rule.re.test(trimmed)) return { ok: false, reason: rule.code };
    }
    out[key] = trimmed;
  }

  // The living sentence / quoted line must be a real line, never a bare fragment.
  if (wordCount(out.livingSentence) < MIN_SENTENCE_WORDS) {
    return { ok: false, reason: "fragment" };
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

  // When the grounded frame is about delay / cost / others, a "take your time"
  // invitation silently permits the very postponement being reflected. Reject
  // patience-retreat language ONLY in that frame — gentle language is not banned
  // broadly, only when it removes or contradicts the grounded tension.
  const frameText = `${ctx?.questionExcerpt ?? ""} ${ctx?.responseFull ?? ctx?.responseExcerpt ?? ""}`;
  if (DELAY_COST_FRAME.test(frameText)) {
    for (const key of REFLECTION_SECTION_KEYS) {
      if (PATIENCE_RETREAT.test(out[key])) return { ok: false, reason: "invitation_contradicts_frame" };
    }
  }

  return { ok: true, value: out };
}
