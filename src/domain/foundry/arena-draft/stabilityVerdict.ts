/**
 * STABILITY VERDICT AUTHORITY (Slice 3.2I-R5B1A.1-R2.24).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R4 live run was the first complete six-case measurement. It executed 6/6 cases, wrote
 * 6/6 immutable artifacts, suffered 0 infrastructure failures — and generated ONE valid scenario out
 * of six. The terminal nevertheless printed:
 *
 *     STRUCTURAL + SEMANTIC GATES PASS
 *
 * Because nothing in the pipeline distinguished "every case reached a terminal result" from "every
 * case produced an acceptable scenario". The collator's `complete` flag meant only that no artifact
 * was missing and no artifact disagreed with another; the runner's pass line was gated on the
 * orchestrator's exit status, and `EXIT_CODES.contentFailure` is deliberately 0 so that a quality
 * rejection keeps the remaining cases running. Both were correct about their own question and
 * neither was ever asked about generation quality.
 *
 * A completed run and a successful run are different claims. This module keeps them apart.
 *
 * Six INDEPENDENT dimensions, none of which implies another:
 *
 *   A executionComplete      every scheduled case reached a terminal result
 *   B evidenceComplete       every expected artifact exists and is internally consistent
 *   C infrastructureHealthy  no provider or runtime failure occurred
 *   D stabilityHardGatesPass the generation contract actually held, repeatedly
 *   E humanReviewRequired    a person must still read the scenarios
 *   F productQualityPass     never produced by a machine at all
 *
 * Pure: no I/O, no clock, no filesystem. The collator supplies measured counts and renders what it
 * returns.
 */

/** Counts measured from the immutable case artifacts. Never from terminal text. */
export type StabilityMetrics = {
  expectedCases: number;
  executedCases: number;
  generatedValid: number;
  generationRejected: number;
  infrastructureFailure: number;
  firstAttemptValid: number;
  /** Cases that failed once and then produced a valid scenario on the retry. */
  retryRecovered: number;
  /** Cases that used their retry and still terminated rejected. */
  retryExhausted: number;
  /** ATTEMPTS whose independent review was contradictory, incomplete or malformed. */
  reviewerMalformed: number;
  /** Attempts whose provider output was cut off before the schema was satisfied. */
  truncation: number;
  /** Cases served by the deterministic template instead of the model. */
  fallback: number;
  /** Total occurrences of every established semantic/safety defect code across all attempts. */
  semanticDefectTotal: number;

  // --- R2.25 — call accounting and reviewer health -------------------------
  /** Actual generation calls, counted from attempt records. Never inferred from log lines. */
  generationCallCount: number;
  /** Actual semantic-review calls, including reruns. */
  reviewCallCount: number;
  /** Second reviews issued over a frozen subject after a contradiction. NOT generation retries. */
  reviewRerunCount: number;
  /** Cases where a rerun turned a contradiction into an internally consistent verdict. */
  reviewerRecoveredCount: number;
  /** Cases that ended because the reviewer contradicted itself twice over an identical subject. */
  reviewerTerminalFailureCount: number;
  /** Cases the GENERATOR failed on content. Excludes reviewer terminal failures by construction. */
  generatorRejectedCount: number;
  deterministicRejectedCount: number;
  semanticRejectedCount: number;
  /** Second GENERATIONS. A reviewer rerun is never counted here. */
  generationRetryCount: number;
};

/** Evidence-integrity facts, measured by the collator against the files on disk. */
export type EvidenceIntegrity = {
  missingCases: string[];
  /** Digest, mode, HEAD or manifest disagreements between artifacts. */
  problems: string[];
};

export type HardGateFailure = { rule: string; expected: string; actual: string };

export type StabilityVerdict = {
  executionComplete: boolean;
  evidenceComplete: boolean;
  infrastructureHealthy: boolean;
  /**
   * R2.25 — independent of infrastructure health. The provider can be perfectly available while the
   * reviewer contradicts itself; that is a broken MEASUREMENT, and a run cannot be called stable
   * when the thing doing the judging failed.
   */
  reviewerHealthy: boolean;
  stabilityHardGatesPass: boolean;
  humanReviewRequired: boolean;
  /**
   * NEVER true from a machine. `null` means no human has ruled; `false` means a human ruled against
   * it. There is deliberately no code path that assigns `true` — see `PRODUCT_QUALITY_AUTHORITY`.
   */
  productQualityPass: null | false;
  productQualityAuthority: "human_only";
  hardGateFailures: HardGateFailure[];
};

/**
 * The single authority for product quality. A machine may reject a scenario; it may never certify
 * one. Automated `generated_valid` means only that no gate fired — the R2.23D-R4 evidence contains
 * a `generated_valid` scenario whose branch phases restate their own tradeoff options, which is the
 * defect family its own case exists to detect.
 */
export const PRODUCT_QUALITY_AUTHORITY = "human_only" as const;

const gate = (rule: string, ok: boolean, expected: string, actual: string): HardGateFailure | null =>
  ok ? null : { rule, expected, actual };

/**
 * Evaluate the hard gates. These are the conditions under which a run may be called stable — not a
 * scoring heuristic, and not tuned to make a measured run pass.
 *
 * `firstAttemptValid >= expected - 1` allows exactly one retry-recovered case in a full run: a
 * contract that only holds when the model is given a second chance is not a stable contract.
 */
export function evaluateHardGates(m: StabilityMetrics, evidence: EvidenceIntegrity): HardGateFailure[] {
  const n = m.expectedCases;
  return [
    gate("executedCases", m.executedCases === n, `${n}`, `${m.executedCases}`),
    gate("generatedValid", m.generatedValid === n, `${n}`, `${m.generatedValid}`),
    gate("firstAttemptValid", m.firstAttemptValid >= n - 1, `>= ${n - 1}`, `${m.firstAttemptValid}`),
    gate("retryRecovered", m.retryRecovered <= 1, "<= 1", `${m.retryRecovered}`),
    gate("retryExhausted", m.retryExhausted === 0, "0", `${m.retryExhausted}`),
    gate("infrastructureFailure", m.infrastructureFailure === 0, "0", `${m.infrastructureFailure}`),
    gate("reviewerMalformed", m.reviewerMalformed === 0, "0", `${m.reviewerMalformed}`),
    gate("truncation", m.truncation === 0, "0", `${m.truncation}`),
    gate("fallback", m.fallback === 0, "0", `${m.fallback}`),
    gate("semanticDefectTotal", m.semanticDefectTotal === 0, "0", `${m.semanticDefectTotal}`),
    // R2.25 — a reviewer that failed twice over an identical frozen subject never judged the
    // scenario at all. There is nothing to call stable.
    gate("reviewerTerminalFailure", m.reviewerTerminalFailureCount === 0, "0", `${m.reviewerTerminalFailureCount}`),
    gate("evidenceComplete", evidence.missingCases.length === 0 && evidence.problems.length === 0, "no missing cases, no problems", `${evidence.missingCases.length} missing, ${evidence.problems.length} problems`),
  ].filter((f): f is HardGateFailure => f !== null);
}

/**
 * The six dimensions.
 *
 * The load-bearing line is that `stabilityHardGatesPass` is computed from the hard gates alone. It
 * does not read `executionComplete`, so no amount of execution completeness can raise it.
 */
export function evaluateStabilityVerdict(m: StabilityMetrics, evidence: EvidenceIntegrity): StabilityVerdict {
  const hardGateFailures = evaluateHardGates(m, evidence);
  return {
    executionComplete: m.executedCases === m.expectedCases,
    evidenceComplete: evidence.missingCases.length === 0 && evidence.problems.length === 0,
    infrastructureHealthy: m.infrastructureFailure === 0,
    reviewerHealthy: m.reviewerTerminalFailureCount === 0,
    stabilityHardGatesPass: hardGateFailures.length === 0,
    // A person reads the scenarios in every outcome. Passing gates is what makes human review
    // MEANINGFUL, never what makes it unnecessary.
    humanReviewRequired: true,
    productQualityPass: null,
    productQualityAuthority: PRODUCT_QUALITY_AUTHORITY,
    hardGateFailures,
  };
}

// ---------------------------------------------------------------------------
// Deriving the metrics from artifact evidence
// ---------------------------------------------------------------------------

/**
 * The minimal structural shape of one attempt record. Deliberately narrower than the artifact type
 * in the service layer — domain code must not depend on it.
 */
export type AttemptEvidence = {
  outcome: string;
  code?: string | null;
  defectCodes?: string[] | null;
  /**
   * Present when a semantic review ran for this attempt. Both rejection paths log `gate_level_*`,
   * so this is the only thing that distinguishes a deterministic-gate rejection from one the
   * independent reviewer authored.
   */
  review?: unknown;
};

export type CaseEvidence = {
  passId: string;
  caseId: string;
  ok: boolean;
  classification: string;
  attempts: AttemptEvidence[];
};

/**
 * Outcomes that are LEDGER rows, not generation calls.
 *
 * R2.25 adds the review-lifecycle rows. A reviewer rerun is a REVIEW call over a frozen scenario;
 * counting it as a generation attempt would report the reviewer's instability as the generator's.
 */
const NON_GENERATION_OUTCOMES = new Set([
  "correction_packet",
  "review_subject_frozen",
  "review_rerun",
  "review_infrastructure_failure",
  "review_subject_drift",
]);

export const isGenerationAttempt = (a: AttemptEvidence): boolean => !NON_GENERATION_OUTCOMES.has(a.outcome);


/**
 * Count what the artifacts actually show.
 *
 * The two subtleties that produced wrong numbers before:
 *
 *   1. `correction_packet` entries are bookkeeping. Counting them as attempts doubles every defect
 *      and inflates the retry count.
 *   2. A malformed REVIEW is not a generation defect. It is counted on its own axis, because the
 *      scenario it discarded may have been perfectly serviceable — in the R2.23D-R4 evidence the
 *      reviewer's overall verdict in every such case was `accept`.
 */
export function deriveStabilityMetrics(cases: CaseEvidence[], expectedCases: number): StabilityMetrics {
  const generations = (c: CaseEvidence) => c.attempts.filter(isGenerationAttempt);
  const retried = cases.filter((c) => generations(c).length > 1);
  return {
    expectedCases,
    executedCases: cases.length,
    generatedValid: cases.filter((c) => c.ok).length,
    generationRejected: cases.filter((c) => !c.ok && c.classification === "content").length,
    infrastructureFailure: cases.filter((c) => c.classification === "infrastructure").length,
    // `<= 1` because a success with no recorded generation attempt also had no retry. Requiring
    // exactly 1 would mark an unobserved success as a retry recovery, which is a stricter-looking
    // rule that is simply wrong; `retryRecovered` still requires a genuine second generation.
    firstAttemptValid: cases.filter((c) => c.ok && generations(c).length <= 1).length,
    retryRecovered: retried.filter((c) => c.ok).length,
    retryExhausted: retried.filter((c) => !c.ok).length,
    reviewerMalformed: cases.reduce((n, c) => n + c.attempts.filter((a) => a.outcome === "review_malformed").length, 0),
    truncation: cases.reduce((n, c) => n + c.attempts.filter((a) => a.outcome === "provider_truncated" || a.code === "truncated_output").length, 0),
    fallback: cases.filter((c) => c.attempts.some((a) => a.outcome === "template_fallback")).length,
    semanticDefectTotal: cases.reduce(
      (n, c) => n + c.attempts.filter(isGenerationAttempt).reduce((k, a) => k + (a.defectCodes?.length ?? 0), 0),
      0,
    ),

    // --- R2.25 — counted from attempt records, never inferred from log lines ---
    generationCallCount: cases.reduce((n, c) => n + generations(c).length, 0),
    reviewCallCount: cases.reduce(
      (n, c) => n + c.attempts.filter((a) => a.outcome === "review_subject_frozen").length + c.attempts.filter((a) => a.outcome === "review_rerun").length,
      0,
    ),
    reviewRerunCount: cases.reduce((n, c) => n + c.attempts.filter((a) => a.outcome === "review_rerun").length, 0),
    // A rerun happened and the case did NOT end as a reviewer terminal failure: the reviewer recovered.
    reviewerRecoveredCount: cases.filter(
      (c) => c.attempts.some((a) => a.outcome === "review_rerun") && !c.attempts.some((a) => a.outcome === "reviewer_terminal_failure"),
    ).length,
    reviewerTerminalFailureCount: cases.filter((c) => c.attempts.some((a) => a.outcome === "reviewer_terminal_failure")).length,
    // Generator content rejections EXCLUDE reviewer terminal failures: when the reviewer failed
    // twice the scenario was never judged, so the generator was never found at fault.
    generatorRejectedCount: cases.filter(
      (c) => !c.ok && c.classification === "content" && !c.attempts.some((a) => a.outcome === "reviewer_terminal_failure"),
    ).length,
    // Both paths log `gate_level_*`; only the semantic one carries a review.
    deterministicRejectedCount: cases.reduce(
      (n, c) => n + c.attempts.filter((a) => a.outcome.startsWith("gate_level_") && a.review === undefined).length,
      0,
    ),
    semanticRejectedCount: cases.reduce(
      (n, c) => n + c.attempts.filter((a) => a.outcome.startsWith("gate_level_") && a.review !== undefined).length,
      0,
    ),
    generationRetryCount: cases.reduce((n, c) => n + Math.max(0, generations(c).length - 1), 0),
  };
}
