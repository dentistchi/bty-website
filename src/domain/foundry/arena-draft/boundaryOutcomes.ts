/**
 * CANONICAL BOUNDARY-REVIEW OUTCOME ENUMERATION (Slice 3.2I-R5B1A.1-R2.32 Part 9).
 *
 * THE MEASURED DEFECT
 *
 * The R2.30 live run terminated with `boundary_reviewer_terminal_failure`, and the runner printed an
 * "Allowed outcomes" list that did not contain it. The list was a hand-written `printf` block in the
 * generated shell script; the real enumeration lived in TypeScript and was never consulted. Two
 * enumerations, one of them wrong, and nothing to keep them together.
 *
 * This module is the ONE source. The runtime result type, the artifact schema, the terminal
 * rendering, the runner output and the tests all read it. A new outcome cannot be added in one place
 * and forgotten in another, because there is only one place.
 *
 * Pure domain: no I/O.
 */

/**
 * R2.34 Part 9 — ONE tracked source for the replay artifact version. R2.33 measured the writer
 * emitting `/1` while the runner bound `/3`: two constants, no relationship, and an artifact that
 * could not be attributed to the contract that produced it.
 */
export const NARROW_REPLAY_ARTIFACT_VERSION = "practice-narrow-boundary-replay/6";

/**
 * R2.54 — /6 adds `fieldRepairObservability`: the dependency group's identity and field set, how
 * many canonical alternatives it was offered and their digest, what it selected, which alternative
 * matched (or which code refused it), the reason authority in force, and — the question R2.53 could
 * not answer from an artifact — whether the MERGE BOUNDARY was crossed at all.
 *
 * The R2.52 live artifact recorded `fieldRepairCodes: ["field_repair_merged_row_invalid"]` and
 * `mergedRows: null`, from which a reader could tell that something downstream refused the patch but
 * not what the patch had chosen or why the choice was illegal. Every earlier version stays readable;
 * the field is additive.
 */
export const NARROW_REPLAY_ARTIFACT_VERSIONS = [
  "practice-narrow-boundary-replay/4",
  "practice-narrow-boundary-replay/5",
  "practice-narrow-boundary-replay/6",
] as const;

/** Outcomes the narrow boundary STAGE can return. */
export const BOUNDARY_STAGE_OUTCOMES = [
  "boundary_review_pass",
  "boundary_review_not_applicable",
  "boundary_review_reject",
  "boundary_review_inconclusive",
  "boundary_reviewer_terminal_failure",
  "boundary_review_authority_failure",
  /**
   * R2.34 — a PROVIDER failure is now a stage outcome in its own right. R2.33 measured a transport
   * failure reported as `boundary_reviewer_terminal_failure`, which asserts something false: that
   * the reviewer produced two unusable responses over an identical frozen subject. The reviewer
   * never saw the subject at all.
   */
  "provider_failure",
] as const;
export type BoundaryStageOutcome = (typeof BOUNDARY_STAGE_OUTCOMES)[number];

/**
 * A single-attempt result that is not yet a stage outcome. `boundary_review_malformed` is the
 * generic form; `boundary_output_contract_failure` is the R2.32 subcode for the specific case where
 * the response satisfied the PROVIDER contract entirely — parsed, schema-valid, fully covered — and
 * failed only the SERVER's state contract. The remedy is different, so the name must be too.
 */
export const BOUNDARY_ATTEMPT_OUTCOMES = ["boundary_review_malformed", "boundary_output_contract_failure"] as const;
export type BoundaryAttemptOutcome = (typeof BOUNDARY_ATTEMPT_OUTCOMES)[number];

/** Terminal subcodes preserved alongside `boundary_reviewer_terminal_failure`. */
export const BOUNDARY_TERMINAL_SUBCODES = [
  "boundary_output_contract_failure",
  "boundary_review_transport_failed",
  "boundary_review_attempt_budget_violated",
  "boundary_provider_invocation_budget_exhausted",
] as const;

/**
 * R2.34 Part 5 — TWO independent caps over one frozen subject, and BOTH apply.
 *
 *   invocations — every provider call, whether or not it produced a semantic response. This is the
 *                 cost authority: a transport failure still spent a call.
 *   semantic    — only responses that reached schema/semantic validation. This is the rerun
 *                 authority: it exists to absorb reviewer self-inconsistency, and a call the
 *                 reviewer never saw must not consume it.
 */
export const MAX_BOUNDARY_PROVIDER_INVOCATIONS_PER_FROZEN_SUBJECT = 2;
export const MAX_BOUNDARY_SEMANTIC_RESPONSES_PER_FROZEN_SUBJECT = 2;

/** Runner-level results that are not review verdicts at all — transport and binding failures. */
export const BOUNDARY_RUNNER_OUTCOMES = [
  "subject_digest_mismatch",
  "provenance_digest_mismatch",
  "surface_map_mismatch",
  "surface_authority_failure",
] as const;

/**
 * EVERY outcome a live run may legitimately end on. This is the list the runner prints, and it is
 * asserted to contain every stage outcome — the exact omission R2.31 recorded.
 */
export const BOUNDARY_REPORTABLE_OUTCOMES = [
  ...BOUNDARY_STAGE_OUTCOMES,
  ...BOUNDARY_ATTEMPT_OUTCOMES,
  ...BOUNDARY_RUNNER_OUTCOMES,
] as const;
export type BoundaryReportableOutcome = (typeof BOUNDARY_REPORTABLE_OUTCOMES)[number];

export const isReportableOutcome = (v: string): v is BoundaryReportableOutcome =>
  (BOUNDARY_REPORTABLE_OUTCOMES as readonly string[]).includes(v);

/** Render the list for terminal output, wrapped. One source, one rendering. */
export function renderAllowedOutcomes(perLine = 3): string[] {
  const out: string[] = [];
  for (let i = 0; i < BOUNDARY_REPORTABLE_OUTCOMES.length; i += perLine) {
    out.push(BOUNDARY_REPORTABLE_OUTCOMES.slice(i, i + perLine).join(" | "));
  }
  return out;
}
