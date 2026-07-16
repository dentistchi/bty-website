/**
 * Foundry Guided Module Builder — Slice 2 domain (pure).
 *
 * FIELD-LEVEL, partial-save-friendly rules for the manual builder. This is NOT
 * approval completeness (that is `validateModuleDraft` in ./module-draft, reserved
 * for the later approval slice). Here a draft may be saved half-finished: PATCH
 * validation only rejects MALFORMED or OUT-OF-BOUNDS values, never "missing".
 *
 * `canAdvanceStep` is the client Next-guard (immediate guidance only). The server
 * never hard-gates progression on it — it only field-validates what was sent.
 *
 * The builder's answer object is a structural SUPERSET of ModuleDraftAnswers, so
 * it is assignable to the Slice-1 service without touching the Slice-1 schema or
 * types; the extra keys live transparently in the `answers` jsonb column.
 *
 * No DB, no I/O, no providers.
 */

import type { ModuleDraftAnswers } from "./module-draft";
import { isLearningType, observableBehaviorWarning } from "./module-draft";

// ---------------------------------------------------------------------------
// Builder value domains (plain, operational — never surfaced as jargon)
// ---------------------------------------------------------------------------

/** STEP 2 — who needs to do something differently. */
export type AudienceType = "everyone" | "leaders" | "job_group" | "specific_role";
export const AUDIENCE_TYPES: readonly AudienceType[] = ["everyone", "leaders", "job_group", "specific_role"];
/** These two audience kinds require a free-text detail (which group / which role). */
export const AUDIENCE_TYPES_NEEDING_DETAIL: readonly AudienceType[] = ["job_group", "specific_role"];

/** STEP 4 — how success would be recognized (observation kind; never "verified"). */
export type EvidenceObservation = "seen" | "heard" | "recorded" | "confirmed";
export const EVIDENCE_OBSERVATIONS: readonly EvidenceObservation[] = ["seen", "heard", "recorded", "confirmed"];

/** STEP 5 — what will help people change (plain need levels, not content jargon). */
export type LearningNeed = "know" | "decide" | "practice" | "shared_standard";
export const LEARNING_NEEDS: readonly LearningNeed[] = ["know", "decide", "practice", "shared_standard"];

/** STEP 6 — what people will learn from (draft INTENT only in this slice). */
export type MaterialIntent = "youtube" | "pdf" | "written" | "live_discussion";
export const MATERIAL_INTENTS: readonly MaterialIntent[] = ["youtube", "pdf", "written", "live_discussion"];

/** STEP 7 — when to check what happened (0 = none). */
export const FOLLOW_UP_DAY_OPTIONS = [0, 7, 30] as const;
export type FollowUpDays = (typeof FOLLOW_UP_DAY_OPTIONS)[number];

export const BUILDER_STEP_MIN = 1;
export const BUILDER_STEP_MAX = 8;

// Field length bounds (generous — the builder is drafting, not publishing).
export const PROBLEM_MAX = 2000;
export const BEHAVIOR_MAX = 2000;
export const EVIDENCE_MAX = 2000;
export const MATERIAL_TEXT_MAX = 2000;
export const AUDIENCE_DETAIL_MAX = 120;
// A "meaningful" free-text answer for the client Next-guard (guidance only).
const MEANINGFUL_MIN = 3;

/**
 * The builder's answer shape. A structural superset of ModuleDraftAnswers (shared
 * keys keep identical types), so it is assignable to the Slice-1 service.
 */
export type BuilderAnswers = ModuleDraftAnswers & {
  problem?: string;
  audienceType?: AudienceType;
  audienceDetail?: string;
  observableBehavior?: string;
  successEvidence?: string;
  evidenceType?: EvidenceObservation;
  learningNeed?: LearningNeed;
  materialIntent?: MaterialIntent;
  materialText?: string;
  arenaRecommended?: boolean;
  followUpDays?: FollowUpDays;
};

// ---------------------------------------------------------------------------
// Deterministic Arena practice recommendation (builder-level)
// ---------------------------------------------------------------------------

/**
 * Recommend Arena practice when the learning need involves judgment, repeated
 * practice, or a shared way of working under pressure. Pure information ("Know")
 * does NOT get an Arena recommendation. Deterministic; creates no Arena content.
 * (The Slice-1 `recommendArena` keys on a finer content taxonomy reserved for the
 * approval slice; the builder's 4-option need model maps to this honest rule.)
 */
export function recommendArenaForNeed(need: unknown): boolean {
  return need === "decide" || need === "practice" || need === "shared_standard";
}

/** Re-exported so the UI never re-implements the Slice-1 behavior heuristic. */
export { observableBehaviorWarning };

// ---------------------------------------------------------------------------
// Field-level PATCH validation (partial-save friendly)
// ---------------------------------------------------------------------------

export type DraftPatchInput = {
  answers?: unknown;
  currentStep?: unknown;
};

export type DraftPatchResult =
  | { ok: true; value: { answers?: BuilderAnswers; currentStep?: number } }
  | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Trimmed-length bound check; the RAW string is preserved for restore fidelity. */
function checkText(raw: unknown, max: number, tooLong: string, notString: string, errors: string[]): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    errors.push(notString);
    return undefined;
  }
  if (raw.trim().length > max) {
    errors.push(tooLong);
    return undefined;
  }
  return raw; // store raw (no trim) — a mid-edit trailing space must survive a save.
}

/**
 * Validate a builder PATCH. Only fields PRESENT in the payload are validated; a
 * partial draft is always saveable. Unknown answer keys are dropped (never
 * persisted). Returns the sanitized subset to shallow-merge into the draft, or a
 * list of stable field error codes.
 */
export function validateDraftPatch(input: DraftPatchInput): DraftPatchResult {
  const errors: string[] = [];
  const out: { answers?: BuilderAnswers; currentStep?: number } = {};

  if (input.currentStep !== undefined) {
    const n = input.currentStep;
    if (typeof n !== "number" || !Number.isInteger(n) || n < BUILDER_STEP_MIN || n > BUILDER_STEP_MAX) {
      errors.push("current_step_invalid");
    } else {
      out.currentStep = n;
    }
  }

  if (input.answers !== undefined) {
    if (!isPlainObject(input.answers)) {
      errors.push("answers_invalid");
    } else {
      const a = input.answers;
      const clean: BuilderAnswers = {};

      const problem = checkText(a.problem, PROBLEM_MAX, "problem_too_long", "problem_invalid", errors);
      if (problem !== undefined) clean.problem = problem;

      if (a.audienceType !== undefined) {
        if ((AUDIENCE_TYPES as readonly string[]).includes(a.audienceType as string)) clean.audienceType = a.audienceType as AudienceType;
        else errors.push("audience_type_invalid");
      }
      const audienceDetail = checkText(a.audienceDetail, AUDIENCE_DETAIL_MAX, "audience_detail_too_long", "audience_detail_invalid", errors);
      if (audienceDetail !== undefined) clean.audienceDetail = audienceDetail;

      const behavior = checkText(a.observableBehavior, BEHAVIOR_MAX, "behavior_too_long", "behavior_invalid", errors);
      if (behavior !== undefined) clean.observableBehavior = behavior;

      const evidence = checkText(a.successEvidence, EVIDENCE_MAX, "evidence_too_long", "evidence_invalid", errors);
      if (evidence !== undefined) clean.successEvidence = evidence;

      if (a.evidenceType !== undefined) {
        if ((EVIDENCE_OBSERVATIONS as readonly string[]).includes(a.evidenceType as string)) clean.evidenceType = a.evidenceType as EvidenceObservation;
        else errors.push("evidence_type_invalid");
      }

      if (a.learningNeed !== undefined) {
        if ((LEARNING_NEEDS as readonly string[]).includes(a.learningNeed as string)) clean.learningNeed = a.learningNeed as LearningNeed;
        else errors.push("learning_need_invalid");
      }

      if (a.materialIntent !== undefined) {
        if ((MATERIAL_INTENTS as readonly string[]).includes(a.materialIntent as string)) clean.materialIntent = a.materialIntent as MaterialIntent;
        else errors.push("material_intent_invalid");
      }
      const materialText = checkText(a.materialText, MATERIAL_TEXT_MAX, "material_text_too_long", "material_text_invalid", errors);
      if (materialText !== undefined) clean.materialText = materialText;

      if (a.arenaRecommended !== undefined) {
        if (typeof a.arenaRecommended === "boolean") clean.arenaRecommended = a.arenaRecommended;
        else errors.push("arena_recommended_invalid");
      }

      if (a.followUpDays !== undefined) {
        if ((FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(a.followUpDays as number)) clean.followUpDays = a.followUpDays as FollowUpDays;
        else errors.push("follow_up_days_invalid");
      }

      // learningType (the Slice-1 approval enum) is accepted if a caller supplies a
      // valid value, but the builder itself does not set it — kept for forward-compat.
      if (a.learningType !== undefined && isLearningType(a.learningType)) clean.learningType = a.learningType;

      if (errors.length === 0) out.answers = clean;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------
// Client Next-guard (progression) — guidance only, never a server gate
// ---------------------------------------------------------------------------

function meaningful(v: unknown): boolean {
  return typeof v === "string" && v.trim().length >= MEANINGFUL_MIN;
}

/**
 * Whether the host may advance FROM `step` given `answers`. Returns a blocker code
 * (client shows calm inline guidance) or null. This never blocks SAVING — only the
 * forward move. The server does not enforce it.
 */
export function stepBlocker(step: number, answers: BuilderAnswers | undefined): string | null {
  const a = answers ?? {};
  switch (step) {
    case 1:
      return meaningful(a.problem) ? null : "problem_required";
    case 2:
      if (!a.audienceType) return "audience_required";
      if ((AUDIENCE_TYPES_NEEDING_DETAIL as readonly string[]).includes(a.audienceType) && !meaningful(a.audienceDetail)) {
        return "audience_detail_required";
      }
      return null;
    case 3:
      return meaningful(a.observableBehavior) ? null : "behavior_required";
    case 4:
      return meaningful(a.successEvidence) ? null : "evidence_required";
    case 5:
      return a.learningNeed ? null : "learning_need_required";
    case 6:
      return a.materialIntent ? null : "material_intent_required";
    case 7:
      return (FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(a.followUpDays ?? -1) ? null : "follow_up_required";
    default:
      return null; // step 8 (review) and out-of-range never block.
  }
}

export function canAdvanceStep(step: number, answers: BuilderAnswers | undefined): boolean {
  return stepBlocker(step, answers) === null;
}
