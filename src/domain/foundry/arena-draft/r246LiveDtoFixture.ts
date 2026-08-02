/**
 * THE CAPTURED R2.46 LIVE ATTEMPTS (Slice 3.2I-R5B1A.1-R2.48 Part 4).
 *
 * The R2.46 replay reached the provider twice and produced no verdict. Both DTOs are here verbatim,
 * exactly as `boundaryReviewEvidence[n].parsed` retained them. Sanitized by construction: enum values
 * and server-issued candidate ids only. Raw provider text was never stored.
 *
 * WHAT THEY MEASURED
 *
 * ATTEMPT 1 (12 rows) — nine failures under TWO codes, not one:
 *   8 x boundary_candidate_required_missing   governedActionCandidateId `none` on a NON-EMPTY pool.
 *   1 x boundary_candidate_wrong_role         branch[0].resulting_world_state asked for
 *                                             `explicitly_missing` on a failure pool R2.44 emptied,
 *                                             and reached into the satisfaction list for `3-s1`.
 *
 * ATTEMPT 2, the nine-surface repair — the eight required-missing failures were all FIXED, and three
 * new ones appeared:
 *   3 x boundary_candidate_forbidden_present  a failure candidate cited on a `non_governing` row.
 *
 * The pattern is the finding. Where the failure pool was EMPTY (every branch[0] row) the model wrote
 * `none`. Where it was NON-EMPTY (the three branch[1] rows) it selected. That is the prompt's own
 * sentence — "This is decided by the LIST, not by your status" — applied to the failure role, which
 * the truth-state table forbids. R2.48 removes that sentence's cross-role reading.
 *
 * Carried forward UNMODIFIED. Historical fixtures describe what the OLD authority produced; the
 * corrected authority is applied TO them, never written INTO them.
 *
 * Pure domain: no I/O.
 */

import type { BoundaryTruthAssessment } from "./narrowBoundaryReview";

export const R246_LIVE_RUN_ID = "20260802T013832Z";
export const R246_LIVE_ARTIFACT_SHA256 = "5add43719108361c0d3fe30f37ee24ddd7fd3c1624cd1593c459ce948333d5d3";
export const R246_BOUNDARY_REVIEW_SUBJECT_SHA256 = "472050a1e68d40ae8bf7ce3a5394196fa601a8596354c934375264974f63e3c1";

/** Attempt 1. Twelve rows, as returned. Do not edit — it is the measurement. */
export const R246_ATTEMPT_1: BoundaryTruthAssessment[] = [
  { boundaryId: "c1_verify", surfaceRef: "primary[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "primary[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].resulting_world_state", governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite", governedActionCandidateId: "3-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "3-s1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].tradeoff[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].tradeoff[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].action[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].action[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].resulting_world_state", governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite", governedActionCandidateId: "8-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "8-f1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].tradeoff[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].tradeoff[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].action[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].action[1]", governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite", governedActionCandidateId: "12-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "12-f1", reason: "" }
];

/** The nine-surface repair. Do not edit. */
export const R246_ATTEMPT_2_REPAIR: BoundaryTruthAssessment[] = [
  { boundaryId: "c1_verify", surfaceRef: "primary[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "2-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].resulting_world_state", governedActionStatus: "present", prerequisiteStatus: "satisfied", temporalRelation: "prerequisite_before_action", governedActionCandidateId: "3-a1", prerequisiteSatisfactionCandidateId: "3-s3", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].tradeoff[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "4-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].tradeoff[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "5-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].action[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "6-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].action[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "7-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].tradeoff[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "9-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "9-f1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].tradeoff[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "10-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "10-f1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].action[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "11-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "11-f1", reason: "" }
];

export const R246_ATTEMPT_1_VALID = ["primary[0]", "branch[1].resulting_world_state", "branch[1].action[1]"] as const;

export const R246_ATTEMPT_1_FAILED_REQUIRED_MISSING = [
  "primary[1]",
  "branch[0].tradeoff[0]",
  "branch[0].tradeoff[1]",
  "branch[0].action[0]",
  "branch[0].action[1]",
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
  "branch[1].action[0]",
] as const;

/** The one row whose failure was NOT the required-missing class. */
export const R246_ATTEMPT_1_FAILED_WRONG_ROLE = ["branch[0].resulting_world_state"] as const;

export const R246_REPAIR_SURFACE_REFS = [
  "primary[1]",
  "branch[0].resulting_world_state",
  "branch[0].tradeoff[0]",
  "branch[0].tradeoff[1]",
  "branch[0].action[0]",
  "branch[0].action[1]",
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
  "branch[1].action[0]",
] as const;

export const R246_REPAIR_FORBIDDEN_PRESENT = ["branch[1].tradeoff[0]", "branch[1].tradeoff[1]", "branch[1].action[0]"] as const;

export const R246_MEASURED = {
  providerInvocations: 2,
  providerResponses: 2,
  semanticAttempts: 2,
  repairAttempts: 1,
  transportFailures: 0,
  finalOutcome: "boundary_reviewer_terminal_failure",
  scenarioUnjudged: true,
  primaryOneStatus: "NOT JUDGED",
  /** An output-contract failure is not a semantic miss. The historical count does not move. */
  primaryOneHistoricalSemanticMisses: "7/7",
  /**
   * R2.47 Part 8 observation, ONE RUN ONLY. Nine governed-action candidates carry no clause term.
   * None was marked `present` in either attempt; eight were explicitly cited WITH `absent` in the
   * repair. Recorded as evidence. NOT a product rule, and no applicability logic derives from it.
   */
  nonClauseMatchingGovernedActionCandidates: 9,
  nonClauseMatchingMarkedPresent: 0,
  nonClauseMatchingCitedWithAbsent: 8,
} as const;
