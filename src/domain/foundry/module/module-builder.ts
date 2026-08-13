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
import { validateJourney, type RealityGroundedJourneyV1 } from "./journey";

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
/**
 * NINE STEPS SINCE 3.2P-R3.6-R1. "When does this usually happen?" was inserted at position 3,
 * so every later step moved once and Review became 9. See `LEGACY_STEP_GRAPH_MAX`.
 */
export const BUILDER_STEP_MAX = 9;
/**
 * The step count BEFORE the recurring-moment question existed. A `current_step` stored under
 * that graph is a bookmark against a different sequence: 8 meant Review, and now means the
 * follow-up screen. Kept as a named constant because the one-time reconciliation and its test
 * both refer to it, and a bare `8` in either place would read as an arbitrary number.
 */
export const LEGACY_STEP_GRAPH_MAX = 8;
/**
 * WHAT THE DATABASE ACCEPTS (Slice 3.2P-R3.6-R1, activated R3.6-R1A).
 *
 * `current_step` is bounded in TWO places — this module and a CHECK constraint on the row — and
 * R3.6-R1 moved only one of them. The Builder grew a ninth screen while the constraint from
 * `20260716174444` still ended at 8, so a host could reach Review and not save from it. Nothing
 * in the suite could catch that: every test that touches the value stops at the domain. A live
 * write found it.
 *
 * Migration `20260819000000` widened the bound and is APPLIED — measured, not assumed: 8 and 9
 * accepted, 10 refused by `foundry_module_drafts_current_step_check`. So this now equals
 * `BUILDER_STEP_MAX` and the clamp below is a no-op for every legal step.
 *
 * IT STAYS. Not because it is doing anything today, but because it is the thing that made the
 * mismatch survivable: while the two bounds disagreed, a host lost a click instead of an answer.
 * The next screen added to this Builder will need the same interval, and deleting the mechanism
 * would mean rediscovering the failure to rebuild it.
 */
export const LIVE_STEP_CEILING = 9;

/**
 * The step to PERSIST for a host sitting on `step`. Never above what the live row accepts, and
 * never below the first — a bookmark that the row would reject is worse than a stale one.
 */
export function persistableStep(step: number): number {
  return Math.min(Math.max(step, BUILDER_STEP_MIN), LIVE_STEP_CEILING);
}

// Field length bounds (generous — the builder is drafting, not publishing).
export const PROBLEM_MAX = 2000;
export const BEHAVIOR_MAX = 2000;
export const EVIDENCE_MAX = 2000;
export const MATERIAL_TEXT_MAX = 2000;
export const AUDIENCE_DETAIL_MAX = 120;
/**
 * "When does this usually happen?" — a phrase, not a paragraph (Slice 3.2P-R3.6-R1). Bounded
 * between `AUDIENCE_DETAIL_MAX` (120) and the 2000-character prose fields, because the answers
 * this expects are of the form "During morning huddles" / "Whenever a deadline changes", and a
 * moment long enough to need 2000 characters is not one moment.
 */
export const RECURRING_MOMENT_MAX = 200;
// The participant-facing completion question. Bounded to match the event content
// validator (FOUNDRY_COMPLETION_PROMPT_MAX = 300) so a saved value always publishes.
export const COMPLETION_PROMPT_MAX = 300;
// Direction Copilot (Slice 2.4A) capability candidate — an advisory draft field the
// Host reviews/edits/confirms. Bounded to the Copilot suggestion cap so a confirmed
// value always round-trips through this validator. Stored in the `answers` jsonb.
export const CAPABILITY_CANDIDATE_MAX = 80;
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
  /**
   * WHEN THE REAL SITUATION COMES ROUND AGAIN (Slice 3.2P-R3.6-R1).
   *
   * The Host's own words for the recurring workplace occasion — "During morning huddles". This
   * is first-class Host authority, not a hint: the server builds the program's one moment from
   * it, and the model no longer authors a trigger at all.
   *
   * NEVER inferred from `problem` prose and never AI-backfilled. W5 measured why: this pilot's
   * draft says "During morning huddles" in `problem` and "At the next huddle" in
   * `observableBehavior` — two different moments, one of them not a recurrence. A guess would
   * have had to pick, and would then have been indistinguishable from something the Host said.
   */
  recurringMoment?: string;
  observableBehavior?: string;
  successEvidence?: string;
  evidenceType?: EvidenceObservation;
  /** @deprecated single-value legacy field — read via normalizeLearningNeeds. */
  learningNeed?: LearningNeed;
  /** Canonical multi-select: a training may need several learning types. */
  learningNeeds?: LearningNeed[];
  materialIntent?: MaterialIntent;
  materialText?: string;
  /**
   * Direction Copilot (Slice 2.4A) — the capability the training builds. Advisory,
   * Host-reviewed/edited/confirmed; applied only after explicit confirmation. Has no
   * dedicated approval gate (optional). Lives in the `answers` jsonb; no migration.
   */
  capabilityCandidate?: string;
  /**
   * The participant-facing completion question shown after the material. Host-
   * authored (prefilled with a deterministic suggestion in the UI, fully editable).
   * Distinct from the future `actionDecisionPrompt`. Published into the event's
   * completion_prompt; a sensible localized default is used only when blank.
   */
  completionPrompt?: string;
  /**
   * Shared Understanding question (Slice 3.1B-3G). Module-specific; the learner is EXPLICITLY
   * told the answer is shared with the training Host (distinct from the private completion
   * Reflection). Host-authored, editable, and explicitly removable. Blank / absent = the module
   * has no shared question and completion behaves exactly as before. Published into the event's
   * `shared_question`. Its answer lands in `shared_understanding_response`, NEVER in the private
   * `response_text`.
   */
  sharedQuestion?: string;
  arenaRecommended?: boolean;
  followUpDays?: FollowUpDays;
  /**
   * Reality-Grounded Journey V1 (Slice 3.2C-B3A) — the Host-approved participant-facing
   * structured experience. One namespaced, versioned contract; persisted verbatim and
   * frozen into the module snapshot at publish (it IS a canonical published field).
   */
  realityGroundedJourneyV1?: RealityGroundedJourneyV1;
  /**
   * WHICH generated proposal this draft adopted (Slice 3.2L-R11.1).
   *
   * The adoption RECEIPT lives on the generation attempt (`applied_at`), in a different
   * table, written by a second statement with no transaction around it. Without this the
   * draft could carry an adopted program while the ledger said nothing was ever adopted,
   * and no one could tell WHICH attempt to stamp afterwards — the journey records no
   * attempt id. This is the durable fact that makes the receipt recoverable exactly.
   *
   * Deliberately NOT in the publish snapshot whitelist: it is an audit link, never
   * participant content.
   */
  programAdoptionV1?: { attemptId: string };
  /**
   * THE HOST LOOKED AT THE MATERIAL (Slice 3.2R-R3).
   *
   * BTY can verify that a PDF exists, that it belongs to this draft and how many pages it has.
   * It cannot read the document and cannot know whether it is about this training. The pilot's
   * first live learner proved what that gap costs: a training about naming owners in huddles
   * served a document about patient communication, and every automated check passed.
   *
   * So the one thing the server CAN require is that a human looked. This records that, and
   * only that — never that BTY verified the contents, never that the material is any good.
   *
   * BOUND TO THE EXACT BYTES. `contentHash` is the asset's SHA-256, so replacing the document
   * invalidates the confirmation by construction rather than by a cleanup rule someone has to
   * remember. A matching filename proves nothing and is deliberately not used.
   */
  materialReviewV1?: { contentHash: string; confirmedAt: string };
  /**
   * Adaptive Clarification (Slice 2.4C) — the resumable pre-draft Q&A state. Assistive
   * scratch, NOT a canonical published field: it is deliberately excluded from
   * `SNAPSHOT_ANSWER_KEYS`, never overwrites a canonical Builder field, and survives
   * refresh only because it rides the same `answers` jsonb. Structurally typed here to
   * avoid a domain import cycle; `clarification.ts` owns its shape + sanitization.
   */
  clarification?: {
    version: string;
    answers: { dimension: string; choiceKey: string | null; text: string }[];
  };
};

// Adaptive Clarification (Slice 2.4C) persistence bounds — mirrored in clarification.ts.
export const CLARIFICATION_ANSWERS_MAX = 6;
export const CLARIFICATION_TEXT_MAX = 300;
const CLARIFICATION_KEY_MAX = 40;

/**
 * The canonical learning-need set for a draft, tolerant of legacy shapes: a new
 * `learningNeeds` array wins; otherwise a legacy singular `learningNeed` restores
 * as `[learningNeed]`. Returns a de-duplicated array of valid needs.
 */
export function normalizeLearningNeeds(answers: BuilderAnswers | undefined): LearningNeed[] {
  const a = answers ?? {};
  const raw = Array.isArray(a.learningNeeds)
    ? a.learningNeeds
    : a.learningNeed
      ? [a.learningNeed]
      : [];
  const out: LearningNeed[] = [];
  for (const n of raw) {
    if ((LEARNING_NEEDS as readonly string[]).includes(n as string) && !out.includes(n as LearningNeed)) {
      out.push(n as LearningNeed);
    }
  }
  return out;
}

/**
 * A short, human-readable card title derived from the problem statement (first
 * meaningful line, bounded). Returns null when there is nothing usable yet.
 */
export function draftTitleFrom(answers: BuilderAnswers | undefined): string | null {
  const problem = answers?.problem;
  if (typeof problem !== "string") return null;
  const first = problem.split(/\r?\n/)[0].trim();
  if (first.length < 1) return null;
  return first.length > 60 ? `${first.slice(0, 60).trimEnd()}…` : first;
}

/**
 * The Host-authored statement that identifies WHICH training draft is open.
 *
 * Slice 3.2L-R1.2. Two drafts can both restore at Step 8 and present an identical
 * Review, and the global Learn header ("What do you want to get better at?") names the
 * tab, not the draft. That is how the first controlled Founder window ran against the
 * wrong training. The Host's own "what needs to change" statement is the only thing on
 * the screen that distinguishes one draft from another, so it becomes the visible
 * identity.
 *
 * Deliberately NOT `draftTitleFrom`: that truncates at 60 characters for a card, and two
 * long statements sharing a prefix would render identically — reintroducing the exact
 * confusion this exists to remove. The full first line is returned; the UI wraps it.
 *
 * Returns null when the Host has not written anything yet, so the caller shows a neutral
 * fallback rather than inventing a title.
 */
export function draftIdentityStatement(answers: BuilderAnswers | undefined): string | null {
  const problem = answers?.problem;
  if (typeof problem !== "string") return null;
  const first = problem.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  return first && first.length > 0 ? first : null;
}

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

/**
 * Array form: recommend Arena when ANY selected need involves judgment, practice,
 * or a shared way of working under pressure. Pure information alone ("Know") does
 * not. Deterministic; creates no Arena content.
 */
export function recommendArenaForNeeds(needs: readonly LearningNeed[] | undefined): boolean {
  return (needs ?? []).some((n) => recommendArenaForNeed(n));
}

/**
 * Shared Understanding default policy (Slice 3.1B-3G, Amendment F). Propose a shared question by
 * default when the learning need involves judgment, practice, or a shared standard — the same
 * decide/practice/shared_standard rule Arena keys on. Pure information ("Know") alone does NOT get
 * a default shared question (it stays optional). Pure + deterministic; the Host may always edit or
 * explicitly remove the proposed question, and may add one to a Know-only module.
 */
export function shouldProposeSharedQuestion(needs: readonly LearningNeed[] | undefined): boolean {
  return recommendArenaForNeeds(needs);
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
/** Exactly a UUID — the attempt id is a database key, never free text. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

      const recurringMoment = checkText(
        a.recurringMoment, RECURRING_MOMENT_MAX, "recurring_moment_too_long", "recurring_moment_invalid", errors,
      );
      if (recurringMoment !== undefined) clean.recurringMoment = recurringMoment;

      const behavior = checkText(a.observableBehavior, BEHAVIOR_MAX, "behavior_too_long", "behavior_invalid", errors);
      if (behavior !== undefined) clean.observableBehavior = behavior;

      const capabilityCandidate = checkText(
        a.capabilityCandidate, CAPABILITY_CANDIDATE_MAX, "capability_candidate_too_long", "capability_candidate_invalid", errors,
      );
      if (capabilityCandidate !== undefined) clean.capabilityCandidate = capabilityCandidate;

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
      if (a.learningNeeds !== undefined) {
        if (!Array.isArray(a.learningNeeds)) {
          errors.push("learning_needs_invalid");
        } else {
          const seen: LearningNeed[] = [];
          let bad = false;
          for (const n of a.learningNeeds) {
            if (!(LEARNING_NEEDS as readonly string[]).includes(n as string)) {
              bad = true;
              break;
            }
            if (!seen.includes(n as LearningNeed)) seen.push(n as LearningNeed);
          }
          if (bad) errors.push("learning_needs_invalid");
          else clean.learningNeeds = seen;
        }
      }

      if (a.materialIntent !== undefined) {
        if ((MATERIAL_INTENTS as readonly string[]).includes(a.materialIntent as string)) clean.materialIntent = a.materialIntent as MaterialIntent;
        else errors.push("material_intent_invalid");
      }
      const materialText = checkText(a.materialText, MATERIAL_TEXT_MAX, "material_text_too_long", "material_text_invalid", errors);
      if (materialText !== undefined) clean.materialText = materialText;

      const completionPrompt = checkText(a.completionPrompt, COMPLETION_PROMPT_MAX, "completion_prompt_too_long", "completion_prompt_invalid", errors);
      if (completionPrompt !== undefined) clean.completionPrompt = completionPrompt;

      // Shared Understanding question (Slice 3.1B-3G hotfix): whitelist it alongside completionPrompt
      // so the draft-save round-trip PERSISTS it. checkText preserves "" so an intentional Host clear
      // survives as empty (publish → null), and the Builder never silently re-proposes a removed
      // question (the prefill only fires when the key is `undefined`, not empty).
      const sharedQuestion = checkText(a.sharedQuestion, COMPLETION_PROMPT_MAX, "shared_question_too_long", "shared_question_invalid", errors);
      if (sharedQuestion !== undefined) clean.sharedQuestion = sharedQuestion;

      if (a.arenaRecommended !== undefined) {
        if (typeof a.arenaRecommended === "boolean") clean.arenaRecommended = a.arenaRecommended;
        else errors.push("arena_recommended_invalid");
      }

      if (a.followUpDays !== undefined) {
        if ((FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(a.followUpDays as number)) clean.followUpDays = a.followUpDays as FollowUpDays;
        else errors.push("follow_up_days_invalid");
      }

      // Adaptive Clarification (Slice 2.4C). Structural/bounds validation only — the
      // clarification domain re-sanitizes dimensions on read. Persisted verbatim so the
      // pre-draft Q&A survives refresh; never a canonical published field.
      if (a.clarification !== undefined) {
        const c = a.clarification;
        if (!isPlainObject(c) || !Array.isArray((c as { answers?: unknown }).answers)) {
          errors.push("clarification_invalid");
        } else {
          const list = (c as { answers: unknown[] }).answers;
          const cleaned: { dimension: string; choiceKey: string | null; text: string }[] = [];
          let bad = list.length > CLARIFICATION_ANSWERS_MAX;
          for (const it of list) {
            if (!isPlainObject(it)) { bad = true; break; }
            const dim = it.dimension;
            const ck = it.choiceKey;
            const tx = it.text;
            if (typeof dim !== "string" || dim.length === 0 || dim.length > CLARIFICATION_KEY_MAX) { bad = true; break; }
            if (!(ck === null || ck === undefined || (typeof ck === "string" && ck.length <= CLARIFICATION_KEY_MAX))) { bad = true; break; }
            if (typeof tx !== "string" || tx.length > CLARIFICATION_TEXT_MAX) { bad = true; break; }
            cleaned.push({ dimension: dim, choiceKey: (ck as string | null | undefined) ?? null, text: tx });
          }
          if (bad) errors.push("clarification_invalid");
          else {
            const version = typeof (c as { version?: unknown }).version === "string" ? (c as { version: string }).version : "clarification_v1";
            clean.clarification = { version, answers: cleaned };
          }
        }
      }

      // learningType (the Slice-1 approval enum) is accepted if a caller supplies a
      // valid value, but the builder itself does not set it — kept for forward-compat.
      if (a.learningType !== undefined && isLearningType(a.learningType)) clean.learningType = a.learningType;

      // Reality-Grounded Journey V1 (Slice 3.2C-B3A). One namespaced, versioned,
      // participant-facing contract. Structural validation only here; persisted
      // verbatim so the Host-approved Journey survives the draft round-trip and is
      // frozen into the module snapshot at publish. Content grounding/approval is
      // enforced in the domain + service, not re-derived here.
      /*
        Accepted through the SAME whitelist every other answer passes. A malformed or
        oversized value is dropped rather than stored, so a bad client can never make the
        server stamp something arbitrary.
      */
      if (a.programAdoptionV1 !== undefined) {
        const v = a.programAdoptionV1 as { attemptId?: unknown } | null;
        const id = isPlainObject(v) ? v.attemptId : undefined;
        if (typeof id === "string" && UUID_RE.test(id)) clean.programAdoptionV1 = { attemptId: id };
        else errors.push("program_adoption_invalid");
      }
      /*
        Same whitelist discipline as every other answer: a malformed value is DROPPED, never
        stored, so a bad client cannot make the server believe a Host reviewed anything.
      */
      if (a.materialReviewV1 !== undefined) {
        const v = a.materialReviewV1 as { contentHash?: unknown; confirmedAt?: unknown } | null;
        const hash = isPlainObject(v) ? v.contentHash : undefined;
        const at = isPlainObject(v) ? v.confirmedAt : undefined;
        if (typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash) && typeof at === "string" && at.length >= 20 && at.length <= 40) {
          clean.materialReviewV1 = { contentHash: hash, confirmedAt: at };
        } else {
          errors.push("material_review_invalid");
        }
      }
      if (a.realityGroundedJourneyV1 !== undefined) {
        if (validateJourney(a.realityGroundedJourneyV1).length === 0) {
          clean.realityGroundedJourneyV1 = a.realityGroundedJourneyV1 as BuilderAnswers["realityGroundedJourneyV1"];
        } else {
          errors.push("journey_invalid");
        }
      }

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
    /*
      THE MOMENT, BEFORE THE ACTION (Slice 3.2P-R3.6-R1). It sits here because step 4 already
      assumed one — its own placeholder reads "…at every handoff before signing off" — so asking
      when it happens first makes the next question easier rather than repeating it.

      PRESENCE ONLY. Whether the phrase expresses a repeatable occasion is a separate question,
      asked at the generation boundary (`programSourceBlocker`) and shown as inline guidance on
      this step. A Host may always SAVE what they wrote; the Builder never requires them to
      phrase a moment the way a parser prefers.
    */
    case 3:
      return meaningful(a.recurringMoment) ? null : "recurring_moment_required";
    case 4:
      return meaningful(a.observableBehavior) ? null : "behavior_required";
    case 5:
      return meaningful(a.successEvidence) ? null : "evidence_required";
    case 6:
      return normalizeLearningNeeds(a).length > 0 ? null : "learning_need_required";
    case 7:
      return a.materialIntent ? null : "material_intent_required";
    case 8:
      return (FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(a.followUpDays ?? -1) ? null : "follow_up_required";
    default:
      return null; // step 9 (review) and out-of-range never block.
  }
}

export function canAdvanceStep(step: number, answers: BuilderAnswers | undefined): boolean {
  return stepBlocker(step, answers) === null;
}
