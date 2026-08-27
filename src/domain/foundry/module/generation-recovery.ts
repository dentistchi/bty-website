/**
 * WHAT A HOST CAN DO ABOUT A GENERATION THAT DID NOT PRODUCE A TRAINING (Slice R4-R9A).
 *
 * THE MEASURED DEFECT. A fresh Korean draft was refused `non_observable_standard`, recorded
 * `structural_retryable: false`, and the Builder offered "다시 시도" anyway — because the client
 * decided retryability from the WORDING of the refusal copy rather than from what the server
 * had established. The Founder tapped it, a second provider call was made and paid for, the
 * model returned a genuinely different answer, and the same rule refused it again. The other
 * offered action, "직접 계속하기", led to a journey with four of the eight required sections and
 * a Create button that could never enable.
 *
 * Two false recoveries and no true one.
 *
 * THE DISTINCTION THIS MODULE OWNS, and the only one that matters to a Host:
 *
 *   RETRYABLE      — nothing was learned about the training. The provider was unreachable, or
 *                    slow, or returned something unreadable. Asking again may work.
 *   NON-RETRYABLE  — the provider ANSWERED and BTY refused what it said. The inputs have not
 *                    changed, so the next answer is judged by the same rule; the service has
 *                    already spent its one licensed repair internally. Asking again buys a
 *                    different sentence and the same verdict.
 *
 * A refusal CODE is the signal, because a refusal exists only when a program came back and was
 * read. Nothing here interprets the model's words, and nothing here is a second opinion about
 * retryability — `programAuthorshipService` writes `retryable: false` into the ledger for exactly
 * the same class of outcome, from the same validated result.
 *
 * WHAT THE HOST IS SENT BACK TO is their own answer, never a validator's vocabulary. The chain
 * reuses maps that already exist and adds no parallel one:
 *
 *   refusal kind (a journey kind)  →  JOURNEY_KIND_SOURCE  →  the Host's own answer field
 *   the Host's answer field        →  its existing blocking code
 *   the blocking code              →  sectionForBlockingCode  →  the Review section and step
 *
 * so the step a recovery CTA opens is the step the Review screen already sends a Host to for
 * that same answer, and the two cannot drift apart.
 */
import { JOURNEY_KIND_SOURCE } from "./journey";
import { sectionForBlockingCode, type ReviewMissingSection } from "./module-publish";
import type { BuilderAnswers } from "./module-builder";
import type { JourneyElementKind } from "./journey";

/** The Host-owned answer fields a refusal can honestly send someone back to. */
export type HostSourceField = Extract<
  keyof BuilderAnswers,
  "problem" | "observableBehavior" | "successEvidence" | "recurringMoment" | "audienceType" | "materialIntent"
>;

/**
 * THE ONE PLACE A HOST FIELD IS TIED TO ITS BLOCKING CODE.
 *
 * Deliberately the inverse of knowledge that already exists rather than a new opinion: every
 * one of these codes is emitted by `stepBlocker` for that exact field, and every one is already
 * registered in `CODE_TO_SECTION` with the Review section and Builder step it opens. An entry
 * whose code is not registered there resolves to `null` and falls back to the generic recovery,
 * so this table can never invent a destination.
 */
const SOURCE_FIELD_BLOCKING_CODE: Readonly<Record<HostSourceField, string>> = {
  problem: "problem_required",
  audienceType: "audience_required",
  recurringMoment: "recurring_moment_required",
  observableBehavior: "behavior_required",
  successEvidence: "evidence_required",
  materialIntent: "material_intent_required",
};

/**
 * Source-authority refusals name their own Host field: they are raised BEFORE any provider
 * call, about an answer that cannot support a generation. `programSourceBlocker` emits them, and
 * they arrive as the route's error code rather than as a refusal.
 */
const SOURCE_BLOCKER_FIELD: Readonly<Record<string, HostSourceField>> = {
  problem_required: "problem",
  audience_required: "audienceType",
  audience_detail_required: "audienceType",
  recurring_moment_required: "recurringMoment",
  trigger_not_recurring: "recurringMoment",
  behavior_required: "observableBehavior",
  behavior_is_a_question: "observableBehavior",
  evidence_required: "successEvidence",
  material_intent_required: "materialIntent",
};

/**
 * Codes that mean the attempt never reached a verdict about the training.
 *
 * EXHAUSTIVE OVER `ProgramGenerateErrorCode` and the route's own transport codes. Anything not
 * named here is treated as NON-retryable, which is the safe direction: the cost of wrongly
 * withholding a retry is one Host tap on a Builder field; the cost of wrongly offering one is a
 * paid provider call that cannot succeed, which is the defect this exists to end.
 */
const TRANSIENT_CODES: readonly string[] = [
  "provider_unavailable",
  "timeout",
  "provider_error",
  "invalid_output",
  "attempt_recording_failed",
  "source_identity_unavailable",
  "program_generation_state_unavailable",
  "program_generation_in_progress",
  "duplicate_intent",
  /*
    THE DRAFT MOVED WHILE THE PROVIDER WORKED. Nothing was decided about the training that now
    exists, and the automatic path generates once for the new context anyway — so a retry here is
    honest and, in practice, redundant rather than wasteful.
  */
  "stale_context",
  "context_mismatch",
];

/**
 * TWO QUESTIONS THAT ARE NOT THE SAME ONE (Slice R4-R9B).
 *
 * R9A collapsed them, and the Founder's own draft disproved the collapse: attempts #1 and #2 on
 * fingerprint `95fa0f83` were refused `non_observable_standard`, and attempt #3 — same draft,
 * same answers, same fingerprint — SUCCEEDED. So a semantic refusal is a fact about ONE provider
 * response, not about the context that produced it.
 *
 *   `structural_retryable` (the ledger's word)  — can THIS response be salvaged?
 *   generation retryability (this word)         — can a NEW generation for the SAME source
 *                                                 plausibly succeed?
 *
 * R9A used the first to answer the second and withheld a regeneration that would have worked.
 * The spend argument it was built on still holds — nothing may spend by itself, and reopening
 * must never spend — but the certainty argument was wrong and is corrected here.
 */
export type RecoveryMode =
  /**
   * The Host's own answer cannot support a generation, and no provider call can change that.
   * Decided BEFORE any spend, by `programSourceBlocker` and the Builder's own gates.
   */
  | "source_repair_required"
  /**
   * A program came back and BTY refused its meaning. The Host's source is valid; the model's
   * output was not. A different response may pass — measured, one did — so regenerating is a
   * truthful action, and it costs one call that the Host explicitly asks for.
   */
  | "regenerate_allowed"
  /** Nothing was decided about this training: unreachable, slow, or unreadable. */
  | "transient_retry";

export type GenerationRecovery = {
  /** What the Host may truthfully do. */
  readonly mode: RecoveryMode;
  /**
   * May another provider call, for these same answers, reach a different verdict?
   *
   * TRUE for both `regenerate_allowed` and `transient_retry` since R9B — the difference between
   * those two is what the Host is TOLD, not whether asking again is allowed. Only a source fault
   * forecloses it.
   */
  readonly retryable: boolean;
  /**
   * The Host's own answer to revisit, and where it lives. `null` when no answer of theirs is
   * implicated — the Host is sent to their entered details rather than to an invented field.
   */
  readonly target: { readonly field: HostSourceField; readonly section: ReviewMissingSection } | null;
};

/** The Host field a refused element traces back to, or null when none honestly does. */
export function sourceFieldForKind(kind: string | null | undefined): HostSourceField | null {
  if (!kind) return null;
  const field = JOURNEY_KIND_SOURCE[kind as JourneyElementKind];
  if (!field) return null;
  return field in SOURCE_FIELD_BLOCKING_CODE ? (field as HostSourceField) : null;
}

function targetFor(field: HostSourceField | null): GenerationRecovery["target"] {
  if (!field) return null;
  const section = sectionForBlockingCode(SOURCE_FIELD_BLOCKING_CODE[field]);
  return section ? { field, section } : null;
}

/**
 * What a Host may truthfully do about this failure.
 *
 * @param code    the route's error code
 * @param refusal BTY's own refusal code, present only when a program was read and rejected
 * @param kind    the journey kind the refusal was about, when the refusal named one
 */
export function generationRecovery(
  code: string | null | undefined,
  refusal?: string | null,
  kind?: string | null,
): GenerationRecovery {
  const c = (code ?? "").trim();
  /*
    THE SOURCE FAULT IS CHECKED FIRST, and it is the only thing that forecloses regeneration.
    These codes are raised before a provider is ever called, about an answer that cannot support
    a generation, so asking again with the same answer is asking the same impossible question.
  */
  const sourceField = SOURCE_BLOCKER_FIELD[c];
  if (sourceField) return { mode: "source_repair_required", retryable: false, target: targetFor(sourceField) };

  const named = (refusal ?? "").trim();
  if (named.length > 0) {
    /*
      A program came back and BTY refused its MEANING. The Host's source is valid — verified on
      the live draft, where their trigger and criterion validate cleanly against a well-formed
      action — so what failed is the model's output, and a different output may pass. The Host is
      told that plainly and may spend once, deliberately.
    */
    return { mode: "regenerate_allowed", retryable: true, target: targetFor(sourceFieldForKind(kind)) };
  }
  if (TRANSIENT_CODES.includes(c)) return { mode: "transient_retry", retryable: true, target: null };
  /*
    An unclassified code still spends nothing by itself and offers no promise it cannot keep.
    `regenerate_allowed` rather than a source fault: nothing here says the Host's answers are
    wrong, and telling them to go and change a correct answer is the accusation R9B removes.
  */
  return { mode: "regenerate_allowed", retryable: true, target: null };
}
