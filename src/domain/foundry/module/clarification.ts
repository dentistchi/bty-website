/**
 * Adaptive Clarification — domain (pure, Slice 2.4C).
 *
 * After a Host has applied a direction (2.4A) and the minimum canonical context is
 * complete (problem, audience, observable behavior, success evidence), this layer
 * decides — DETERMINISTICALLY — whether the current information is sufficient to draft
 * the rest of the Module (2.4B), or whether the smallest possible clarification is
 * required first. It answers ONE structural question at a time and stops the moment the
 * information becomes sufficient.
 *
 * This is the SOLE authority for canonical progression: whether to ask, which dimension,
 * and when to stop are computed here from the canonical context + the answers already
 * given — never inferred by a model. The AI layer may only phrase a question and enrich
 * the downstream draft; it can never decide sufficiency.
 *
 * Design guarantees:
 *  - Most well-described directions require ZERO questions (detectors are conservative).
 *  - Never asks merely because a field is empty — only when a NAMED dimension is materially
 *    under-specified for a trustworthy draft.
 *  - Never asks more than MAX_CLARIFICATION_QUESTIONS (a safety ceiling, not a target).
 *  - An already-answered dimension is never re-asked (survives refresh / re-entry).
 *  - Produces NO display strings (the UI copy layer localizes by dimension + choice key).
 *
 * No DB, no I/O, no providers, no UI strings.
 */

import type { BuilderAnswers } from "./module-builder";
import type { ModuleDraftContext } from "./module-draft-copilot";
import { observableBehaviorWarning } from "./module-draft";

export const CLARIFICATION_VERSION = "clarification_v1";

/** Safety ceiling — never ask more than this many questions in one drafting journey. */
export const MAX_CLARIFICATION_QUESTIONS = 3;

/** Bounds for the persisted clarification answers (mirrored by the PATCH validator). */
export const CLARIFICATION_ANSWERS_MAX = 6;
export const CLARIFICATION_TEXT_MAX = 300;
const CLARIFICATION_KEY_MAX = 40;

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

/**
 * The dimensions a clarification may target. A clarification is warranted ONLY when the
 * answer would materially change the drafted module. The full set is modeled for a total
 * contract; v1 activates deterministic detectors for the two highest-impact material ones
 * (observable_behavior, success_evidence). The rest are recognized (extensible) but never
 * flagged by a v1 detector — the safe direction is to under-ask, not over-ask.
 */
export type ClarificationDimension =
  | "target"
  | "observable_behavior"
  | "success_evidence"
  | "role_authority"
  | "learning_context"
  | "field_application"
  | "follow_up";

export const CLARIFICATION_DIMENSIONS: readonly ClarificationDimension[] = [
  "target",
  "observable_behavior",
  "success_evidence",
  "role_authority",
  "learning_context",
  "field_application",
  "follow_up",
];

/**
 * Question priority — by DOWNSTREAM IMPACT, not field order. The behavior a training must
 * change shapes every later section, so it is asked first; the evidence of success next.
 * follow_up ranks last (it is always safely defaultable and editable in the 2.4B review —
 * it must never interrupt the Host on its own).
 */
const DIMENSION_PRIORITY: readonly ClarificationDimension[] = [
  "observable_behavior",
  "target",
  "success_evidence",
  "role_authority",
  "learning_context",
  "field_application",
  "follow_up",
];

function isClarificationDimension(v: unknown): v is ClarificationDimension {
  return typeof v === "string" && (CLARIFICATION_DIMENSIONS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Question + answer + state
// ---------------------------------------------------------------------------

/** A stable choice key the UI localizes to a suggested-answer label. */
export type ClarificationChoiceKey = string;

/** A structural question — no display strings. The UI localizes by dimension + choiceKeys. */
export type ClarificationQuestion = {
  dimension: ClarificationDimension;
  /** 0–4 suggested-answer keys (empty → free text only). The UI maps keys to labels. */
  choiceKeys: ClarificationChoiceKey[];
  /** A short custom answer is ALWAYS permitted. */
  allowCustom: boolean;
};

/** One Host answer. `text` is the effective (resolved) answer; `choiceKey` names a picked suggestion. */
export type ClarificationAnswer = {
  dimension: ClarificationDimension;
  choiceKey: ClarificationChoiceKey | null;
  text: string;
};

/** The persisted, resumable clarification state (lives under `answers.clarification`). */
export type ClarificationState = {
  version: string;
  answers: ClarificationAnswer[];
};

export type ClarificationAssessment = {
  sufficient: boolean;
  /** Deficient dimensions not yet answered, in priority order (nextQuestion targets the first). */
  missingDimensions: ClarificationDimension[];
  /** The single question to ask now, or null when sufficient. */
  nextQuestion: ClarificationQuestion | null;
  /** How many distinct dimensions have already been answered (drives the ceiling). */
  askedCount: number;
};

// Per-dimension suggested-answer keys. Where suggestions do not genuinely help (naming a
// specific observable behavior), the question is free-text only.
const DIMENSION_CHOICE_KEYS: Record<ClarificationDimension, ClarificationChoiceKey[]> = {
  observable_behavior: [],
  success_evidence: ["ev_seen", "ev_heard", "ev_recorded", "ev_confirmed"],
  target: [],
  role_authority: [],
  learning_context: [],
  field_application: [],
  follow_up: [],
};

function buildQuestion(dimension: ClarificationDimension): ClarificationQuestion {
  return { dimension, choiceKeys: DIMENSION_CHOICE_KEYS[dimension] ?? [], allowCustom: true };
}

// ---------------------------------------------------------------------------
// Deterministic deficiency detectors (conservative, fail-safe toward under-asking)
// ---------------------------------------------------------------------------

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** The observable behavior is too vague/thin to draft a trustworthy module from. */
function behaviorDeficient(ctx: ModuleDraftContext): boolean {
  return observableBehaviorWarning(ctx.observableBehavior) === "observable_behavior_vague";
}

/** The success evidence is too thin to draft a trustworthy completion question / follow-up. */
function evidenceDeficient(ctx: ModuleDraftContext): boolean {
  return wordCount(ctx.successEvidence) < 4;
}

/** All active detectors, each contributing at most its own dimension. */
function deficientDimensions(ctx: ModuleDraftContext): ClarificationDimension[] {
  const out: ClarificationDimension[] = [];
  if (behaviorDeficient(ctx)) out.push("observable_behavior");
  if (evidenceDeficient(ctx)) out.push("success_evidence");
  // Extension point: additional deterministic detectors push their dimension here.
  return out;
}

// ---------------------------------------------------------------------------
// Persistence read / sanitize (tolerant of legacy / malformed jsonb)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sanitizeAnswer(v: unknown): ClarificationAnswer | null {
  if (!isPlainObject(v)) return null;
  if (!isClarificationDimension(v.dimension)) return null;
  const choiceKey =
    v.choiceKey === null || v.choiceKey === undefined
      ? null
      : typeof v.choiceKey === "string" && v.choiceKey.length <= CLARIFICATION_KEY_MAX
        ? v.choiceKey
        : null;
  if (typeof v.text !== "string") return null;
  const text = v.text.replace(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > CLARIFICATION_TEXT_MAX) return null;
  return { dimension: v.dimension, choiceKey, text };
}

/**
 * Read the resumable clarification state from a draft's answers, keeping only the LAST
 * valid answer per dimension (a re-answer supersedes an earlier one). Always returns a
 * well-formed state, even for absent/legacy/malformed input.
 */
export function readClarificationState(answers: BuilderAnswers | undefined): ClarificationState {
  const raw = (answers ?? {}).clarification;
  const list = isPlainObject(raw) && Array.isArray(raw.answers) ? raw.answers : [];
  const byDimension = new Map<ClarificationDimension, ClarificationAnswer>();
  for (const item of list) {
    const clean = sanitizeAnswer(item);
    if (clean) byDimension.set(clean.dimension, clean); // last valid wins
  }
  return { version: CLARIFICATION_VERSION, answers: Array.from(byDimension.values()) };
}

/** Merge a new answer into a state, replacing any prior answer for the same dimension. */
export function withClarificationAnswer(
  state: ClarificationState,
  answer: ClarificationAnswer,
): ClarificationState {
  const kept = state.answers.filter((a) => a.dimension !== answer.dimension);
  return { version: CLARIFICATION_VERSION, answers: [...kept, answer] };
}

/**
 * The sanitized, answered clarifications a downstream draft may use as extra context.
 * (Text only — the model may enrich the draft with these, but never decides sufficiency.)
 */
export function clarificationsForContext(
  answers: BuilderAnswers | undefined,
): { dimension: ClarificationDimension; text: string }[] {
  return readClarificationState(answers).answers.map((a) => ({ dimension: a.dimension, text: a.text }));
}

// ---------------------------------------------------------------------------
// Assessment (the sole progression authority)
// ---------------------------------------------------------------------------

const SUFFICIENT = (askedCount: number): ClarificationAssessment => ({
  sufficient: true,
  missingDimensions: [],
  nextQuestion: null,
  askedCount,
});

/**
 * Decide whether clarification is required. Pure and deterministic.
 *
 * Sufficient when: the ceiling has been reached, OR no active detector flags an unanswered
 * dimension. Otherwise returns exactly ONE next question, targeting the highest-impact
 * unanswered deficient dimension. Answered dimensions are excluded regardless of the raw
 * canonical text (clarification never rewrites canonical fields, so a detector may still
 * fire on the unchanged text — an answered dimension must not be re-asked).
 */
export function assessClarification(
  ctx: ModuleDraftContext,
  state: ClarificationState,
): ClarificationAssessment {
  const answered = new Set(
    state.answers.filter((a) => a.text.trim().length > 0).map((a) => a.dimension),
  );
  const askedCount = answered.size;

  // Safety ceiling — never exceed MAX questions in one journey.
  if (askedCount >= MAX_CLARIFICATION_QUESTIONS) return SUFFICIENT(askedCount);

  const deficient = deficientDimensions(ctx);
  const missing = DIMENSION_PRIORITY.filter((d) => deficient.includes(d) && !answered.has(d));

  if (missing.length === 0) return SUFFICIENT(askedCount);

  return {
    sufficient: false,
    missingDimensions: missing,
    nextQuestion: buildQuestion(missing[0]),
    askedCount,
  };
}
