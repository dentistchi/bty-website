/**
 * THE CAPTURED R2.48 LIVE ATTEMPTS (Slice 3.2I-R5B1A.1-R2.50 Part 8).
 *
 * The R2.48 replay reached the provider twice and produced no verdict. Both DTOs verbatim, exactly
 * as `boundaryReviewEvidence[n].parsed` retained them.
 *
 * WHAT THEY MEASURED — and why this slice is not another prompt fix
 *
 * R2.48 rewrote the reviewer contract: it removed the cross-role generalization, separated the two
 * candidate authorities and generated every per-state clause from the requirement table. The repair
 * response came back BYTE-IDENTICAL to R2.46's on all nine shared surfaces. The prompt was not the
 * operative variable.
 *
 * ATTEMPT 1 (12 rows) — 2 valid, 10 failed, 11 findings:
 *   9 x boundary_candidate_required_missing            governedActionCandidateId `none` on a
 *                                                      non-empty pool.
 *   branch[0].resulting_world_state carried TWO codes and no required_missing at all:
 *     boundary_prerequisite_failure_candidate_unavailable  (R2.48's guard, firing live)
 *     boundary_candidate_wrong_role                        (it cited `3-s1`, a satisfaction span)
 *
 * ATTEMPT 2, the ten-surface WHOLE-ROW repair — 6 valid, 4 failed:
 *   4 x boundary_candidate_forbidden_present
 *
 * THE CAUSE THIS SLICE ADDRESSES. On those four rows attempt 1 had already answered
 * `prerequisiteFailureCandidateId: "none"` — CORRECTLY. Only `governedActionCandidateId` was wrong.
 * Re-asking the whole row re-opened a field that was already right, and the model filled it with
 * `9-f1`/`10-f1`/`11-f1`/`12-f1` — all `parent_generated_state` spans carrying a TRUE inherited fact
 * ("but this left the second patient unverified"). It was not guessing: on the same rows it declined
 * the satisfaction candidates, which are `scenario_opening` restatements of the rule.
 *
 * Whole-row re-ask is the defect. Attempt 1 needed 13 of 72 fields changed; nine of the ten failed
 * rows needed exactly ONE.
 *
 * Carried forward UNMODIFIED. The corrected authority is applied TO this evidence, never written
 * INTO it.
 *
 * Pure domain: no I/O.
 */

import type { BoundaryTruthAssessment } from "./narrowBoundaryReview";

export const R248_LIVE_RUN_ID = "20260802T021157Z";
export const R248_LIVE_ARTIFACT_SHA256 = "483bdbbdceeb4256ad173277334a995ee14b518ae1fb72b9771ab665014f902f";
export const R248_BOUNDARY_REVIEW_SUBJECT_SHA256 = "316bbedf693f4266bc8f5e3c4a1f6d73a73edce35462e0fedeca594dce10e6de";

/** Attempt 1 — the IMMUTABLE BASE for field repair. Do not edit; it is the measurement. */
export const R248_ATTEMPT_1: BoundaryTruthAssessment[] = [
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
  { boundaryId: "c1_verify", surfaceRef: "branch[1].action[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "none", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" }
];

/** The historical WHOLE-ROW repair. Retained to prove it still fails the same way. */
export const R248_WHOLE_ROW_REPAIR: BoundaryTruthAssessment[] = [
  { boundaryId: "c1_verify", surfaceRef: "primary[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "2-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].resulting_world_state", governedActionStatus: "present", prerequisiteStatus: "satisfied", temporalRelation: "prerequisite_before_action", governedActionCandidateId: "3-a1", prerequisiteSatisfactionCandidateId: "3-s3", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].tradeoff[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "4-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].tradeoff[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "5-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].action[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "6-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[0].action[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "7-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "none", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].tradeoff[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "9-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "9-f1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].tradeoff[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "10-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "10-f1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].action[0]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "11-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "11-f1", reason: "" },
  { boundaryId: "c1_verify", surfaceRef: "branch[1].action[1]", governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable", governedActionCandidateId: "12-a1", prerequisiteSatisfactionCandidateId: "none", prerequisiteFailureCandidateId: "12-f1", reason: "" }
];

export const R248_ATTEMPT_1_VALID = ["primary[0]", "branch[1].resulting_world_state"] as const;

export const R248_ATTEMPT_1_REQUIRED_MISSING = [
  "primary[1]",
  "branch[0].tradeoff[0]",
  "branch[0].tradeoff[1]",
  "branch[0].action[0]",
  "branch[0].action[1]",
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
  "branch[1].action[0]",
  "branch[1].action[1]",
] as const;

/** The one row that needs a prerequisite DEPENDENCY GROUP, not a candidate swap. */
export const R248_ATTEMPT_1_PREREQUISITE_GROUP = ["branch[0].resulting_world_state"] as const;

export const R248_WHOLE_ROW_FORBIDDEN_PRESENT = [
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
  "branch[1].action[0]",
  "branch[1].action[1]",
] as const;

export const R248_MEASURED = {
  providerInvocations: 2,
  providerResponses: 2,
  semanticAttempts: 2,
  repairAttempts: 1,
  transportFailures: 0,
  finalOutcome: "boundary_reviewer_terminal_failure",
  scenarioUnjudged: true,
  attempt1Valid: 2,
  attempt1Failed: 10,
  wholeRowRepairValid: 6,
  wholeRowRepairFailed: 4,
  /** Nine of nine shared repair surfaces came back identical to R2.46 under a rewritten prompt. */
  sharedRepairSurfacesIdenticalToR246: 9,
  attempt1UnchangedFromR246: 11,
  primaryOneStatus: "NOT JUDGED",
  primaryOneHistoricalSemanticMisses: "7/7",
  /**
   * R2.49 measured this on the INTENDED corrected matrix. The canonical dependency graph derives its
   * own count from the retained validation, which is the authority — see the plan test.
   */
  r249IntendedChangedFields: 13,
} as const;
