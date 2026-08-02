/**
 * THE CAPTURED R2.42 LIVE MERGED MATRIX (Slice 3.2I-R5B1A.1-R2.44 Part 5).
 *
 * The complete twelve-row matrix the R2.42 replay produced: attempt 1 (five valid rows) merged with
 * a seven-surface failed-subset repair. Verbatim. Sanitized by construction — enum values and
 * server-issued candidate ids only.
 *
 * WHAT IT MEASURED
 *
 * The R2.42 output-contract work succeeded completely: one repair asked for exactly the seven failed
 * surfaces and the merge produced one complete verdict. The SEMANTICS did not. Ten findings, eight
 * of them false, in two disjoint classes R2.43 separated:
 *
 *   POLARITY (5)      branch[0] x5 selected a failure candidate whose text affirmatively proves the
 *                     prerequisite was MET -- "You have verified identifiers for both patients ...".
 *                     On branch[0].resulting_world_state that one span was simultaneously the
 *                     governed-action, satisfaction AND failure candidate.
 *   APPLICABILITY (3) branch[1].tradeoff[0], tradeoff[1], action[0] used CORRECT failure evidence
 *                     but called an administrative action the governed action.
 *
 * R2.44 addresses the polarity class ONLY. The applicability class is separately queued and is
 * expected to remain observable in the post-polarity fixture below.
 *
 * Carried forward UNMODIFIED. The corrected authority is applied to it, never into it.
 *
 * Pure domain: no I/O.
 */

import type { BoundaryTruthAssessment } from "./narrowBoundaryReview";

export const R242_LIVE_RUN_ID = "20260801T230147Z";
export const R242_LIVE_ARTIFACT_SHA256 = "2070ee39a55d4547ea4c96415b1c41df8173b82d192f919195a5cb869e0cb3ab";
export const R242_BOUNDARY_REVIEW_SUBJECT_SHA256 = "ca26ac27034eb5fbbae61db0af39b6a18330892c53a85e8fc04554ca92102647";

/** The merged twelve-row matrix exactly as derived. Do not edit — it is the measurement. */
export const R242_LIVE_MERGED_MATRIX: BoundaryTruthAssessment[] = [
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[0]",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    governedActionCandidateId: "none",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[1]",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    governedActionCandidateId: "2-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].resulting_world_state",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "3-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "3-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[0]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "4-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "4-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[1]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "5-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "5-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[0]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "6-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "6-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[1]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "7-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "7-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].resulting_world_state",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "8-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "8-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[0]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "9-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "9-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[1]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "10-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "10-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[0]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "11-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "11-f1",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[1]",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: "12-a1",
    prerequisiteSatisfactionCandidateId: "none",
    prerequisiteFailureCandidateId: "12-f1",
    reason: "",
  },
];

export const R242_ORACLE_VIOLATIONS = ["primary[1]", "branch[1].resulting_world_state", "branch[1].action[1]"] as const;

/** The five findings caused by satisfaction text used as failure evidence. R2.44 removes these. */
export const R242_POLARITY_FALSE_POSITIVES = [
  "branch[0].resulting_world_state",
  "branch[0].tradeoff[0]",
  "branch[0].tradeoff[1]",
  "branch[0].action[0]",
  "branch[0].action[1]",
] as const;

/** The three caused by an administrative action called the governed action. OUT OF SCOPE here. */
export const R242_APPLICABILITY_FALSE_POSITIVES = [
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
  "branch[1].action[0]",
] as const;

export const R242_TRUE_POSITIVES = ["branch[1].resulting_world_state", "branch[1].action[1]"] as const;

export const R242_MEASURED = {
  liveOutcome: "boundary_review_reject",
  findings: 10,
  falsePositives: 8,
  providerInvocations: 2,
  repairedSurfaces: 7,
  /** The span that produced the whole polarity class. */
  invertedSpan: "You have verified identifiers for both patients and provided the necessary treatment without compromising on safety,",
  primaryOneLiveDetection: "MISSED 7/7",
  primaryOneOwner: "generated-result ancestor attribution — OUT OF SCOPE for R2.44",
} as const;
