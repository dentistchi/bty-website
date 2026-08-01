/**
 * REVIEWER RERUN AUTHORITY (Slice 3.2I-R5B1A.1-R2.25).
 *
 * THE MEASURED DEFECT
 *
 * `review_verdict_contradicts_details` fires at exactly one condition:
 *
 *     overallVerdict === "accept" && derivedDefects.length > 0
 *
 * and its inverse, `review_reject_without_defect`, at:
 *
 *     overallVerdict === "reject" && derivedDefects.length === 0
 *
 * Both mean the REVIEWER is inconsistent with itself. Neither says anything about the scenario. In
 * the R2.23D-R4 run the first fired four times, and each time the pipeline threw the scenario away
 * and asked the generator for a new one — spending a generation attempt to recover from a reviewer
 * defect, and destroying the evidence needed to tell the two apart.
 *
 * This module is the decision authority, as a pure function over (attempt number, review outcome).
 * It is separate from the service so every transition is provable without a provider.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT DO
 *
 *  - It never resolves a contradiction by trusting the reviewer's top-level verdict. The c18 pass2
 *    evidence is why: the reviewer voted `accept` on a scenario whose own branch text says a patient
 *    was left unverified against a confirmed two-identifier boundary. The consistency gate was the
 *    only thing that stopped it. Accepting the verdict would have shipped a boundary violation.
 *  - It never grants a third review call, and never converts a rerun into a generation attempt.
 */

/** Structural kinds the review layer can report. */
export type ReviewOutcomeKind = "ok" | "reject" | "no_safe_space" | "contradiction" | "malformed" | "transport_failed";

/**
 * The codes that mean "parsed fine, disagrees with itself". ONLY these authorize a rerun — a
 * truncated or unparseable response is an infrastructure problem, and rerunning it is guesswork.
 */
export const CONTRADICTION_CODES = [
  // overallVerdict disagrees with the derived defect list, in either direction.
  "review_verdict_contradicts_details",
  "review_reject_without_defect",
  // The reviewer's per-choice contract disagrees with its per-phase contract about the same choice.
  "review_contradictory",
  // A no-safe claim that the reviewer's own fields do not support. Also a verdict/detail
  // disagreement, and also recoverable by asking again about the SAME scenario — which is strictly
  // better than the pre-R2.25 behaviour of regenerating the scenario and hoping.
  "review_contradictory_no_safe_with_remaining_judgment",
  "review_contradictory_no_safe_reason",
  "review_contradictory_reason_without_no_safe",
  // A no-safe claim the reviewer's own assessments do not support. Same shape: the top-level
  // verdict disagrees with the detail. NOT a schema failure — the response was complete.
  "review_no_safe_unsupported",
  "review_no_safe_unsupported_by_boundary",
] as const;

/**
 * Codes that are NOT contradictions, listed so the distinction is explicit rather than implied by
 * absence: a truncated, unparseable or structurally incomplete response tells us nothing about what
 * a second identical request would return, so it is infrastructure and never a rerun.
 */
export const NON_RERUNNABLE_EXAMPLES = [
  "review_truncated",
  "review_not_json",
  "review_not_an_object",
  "review_verdict_invalid",
  "review_choices_missing",
  "review_branches_missing",
  "review_boundary_assessments_missing",
  "review_urgency_missing",
  "review_phase_choices_missing",
  "review_cross_branch_missing",
] as const;

export type ContradictionCode = (typeof CONTRADICTION_CODES)[number];

export const isContradictionCode = (code: string): code is ContradictionCode =>
  (CONTRADICTION_CODES as readonly string[]).includes(code);

/** A malformed review is a contradiction only when EVERY reported error is a contradiction code. */
export const isContradiction = (errors: string[]): boolean =>
  errors.length > 0 && errors.every(isContradictionCode);

export type ReviewDecision =
  /** Canonical acceptance. */
  | { action: "accept" }
  /** A valid, internally consistent rejection: the existing server-authored correction path runs. */
  | { action: "reject_scenario" }
  /** Supported refusal. */
  | { action: "no_safe_space" }
  /** Freeze the scenario and call the reviewer once more over the identical subject. */
  | { action: "rerun_review"; because: string }
  /** Second contradiction. The scenario was never judged. */
  | { action: "reviewer_terminal_failure"; because: string }
  /** Provider/schema/runtime problem, classified by the existing reviewer infrastructure policy. */
  | { action: "reviewer_infrastructure_failure"; code: string };

export const MAX_REVIEW_CALLS_PER_SUBJECT = 2;

/**
 * Decide what happens after a review attempt.
 *
 * `attempt` is 1-based and must never exceed `MAX_REVIEW_CALLS_PER_SUBJECT`; a contradiction on the
 * final permitted attempt terminates rather than asking again.
 */
export function decideAfterReview(
  attempt: number,
  outcome: { kind: ReviewOutcomeKind; errors?: string[] },
): ReviewDecision {
  if (attempt < 1 || attempt > MAX_REVIEW_CALLS_PER_SUBJECT) {
    // Defensive: a caller that lost count must fail loudly, never silently buy another call.
    return { action: "reviewer_infrastructure_failure", code: "review_attempt_budget_violated" };
  }

  switch (outcome.kind) {
    case "ok":
      return { action: "accept" };
    case "reject":
      return { action: "reject_scenario" };
    case "no_safe_space":
      return { action: "no_safe_space" };
    case "transport_failed":
      return { action: "reviewer_infrastructure_failure", code: "review_transport_failed" };
    case "malformed":
      // Truncation, unparseable JSON, schema/coverage failure. Not rerunnable on evidence.
      return { action: "reviewer_infrastructure_failure", code: outcome.errors?.[0] ?? "review_malformed" };
    case "contradiction": {
      const code = outcome.errors?.[0] ?? "review_verdict_contradicts_details";
      if (attempt < MAX_REVIEW_CALLS_PER_SUBJECT) {
        return {
          action: "rerun_review",
          because: `${code} — the reviewer disagreed with its own detail fields; the scenario is unjudged and is NOT regenerated`,
        };
      }
      return {
        action: "reviewer_terminal_failure",
        because: `${code} on review attempt ${attempt} of ${MAX_REVIEW_CALLS_PER_SUBJECT} over an identical frozen subject`,
      };
    }
  }
}

/** The terminal reason. Distinct from every generation outcome, by design and by test. */
export const REVIEWER_TERMINAL_FAILURE = "reviewer_terminal_failure" as const;

/**
 * Terminal reasons that mean the GENERATOR produced unacceptable content. `reviewer_terminal_failure`
 * is deliberately absent: when it fires, the scenario was never successfully judged at all.
 */
export const GENERATOR_CONTENT_REASONS = [
  "generation_rejected",
  "fixed_answer_knowledge",
  "safety_boundary_unresolved",
  "no_safe_judgment_space",
] as const;

export const isGeneratorContentRejection = (reason: string): boolean =>
  (GENERATOR_CONTENT_REASONS as readonly string[]).includes(reason);

/** A reviewer rerun is a review call. It is never a generation attempt. */
export const countsAsGenerationRetry = (decision: ReviewDecision): boolean => decision.action === "reject_scenario";
