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

/** Outcomes the narrow boundary STAGE can return. */
export const BOUNDARY_STAGE_OUTCOMES = [
  "boundary_review_pass",
  "boundary_review_not_applicable",
  "boundary_review_reject",
  "boundary_review_inconclusive",
  "boundary_reviewer_terminal_failure",
  "boundary_review_authority_failure",
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
export const BOUNDARY_TERMINAL_SUBCODES = ["boundary_output_contract_failure", "boundary_review_transport_failed", "boundary_review_attempt_budget_violated"] as const;

/** Runner-level results that are not review verdicts at all — transport and binding failures. */
export const BOUNDARY_RUNNER_OUTCOMES = [
  "provider_failure",
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
