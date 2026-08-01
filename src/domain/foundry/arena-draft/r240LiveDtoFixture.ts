/**
 * THE CAPTURED R2.40 LIVE DTO (Slice 3.2I-R5B1A.1-R2.42 Part 4 F).
 *
 * Attempt 1 of the R2.40 replay over the frozen c18 subject, verbatim. Sanitized by construction —
 * enum values and server-issued candidate ids only. No provider envelope, no credential, no account
 * identifier, no request id.
 *
 * WHAT IT MEASURED
 *
 * The R2.40 role authority worked: primary[0] came back "absent" with the "none" sentinel on an
 * EMPTY governed-action pool and was accepted, so the safety-inverting false positive is gone.
 *
 * But six surfaces returned governedActionStatus "absent" with governedActionCandidateId "none" on
 * NON-EMPTY pools, and the contract requires a selection there. The whole review died an
 * output-contract death; the scenario was never judged.
 *
 * R2.41 proved the cause was prompt-internal, not semantic: one prompt line said "when the list is
 * empty … answer absent and use the sentinel" while the generated state rule for the same state said
 * "Select the governed-action candidate that shows what it DOES". The reviewer generalized the first.
 * One slice earlier, under a prompt without that line, the SAME model supplied a candidate on all
 * eight of its `absent` rows.
 *
 * Carried forward UNMODIFIED. The corrected contract is applied to it, never into it.
 *
 * Pure domain: no I/O.
 */

import type { BoundaryTruthAssessment } from "./narrowBoundaryReview";

export const R240_LIVE_RUN_ID = "20260801T222613Z";
export const R240_LIVE_ARTIFACT_SHA256 = "1cbc9296a81233dba79a4fe423b2ae5c67a98f86d9edcd967220ea261745e356";
export const R240_BOUNDARY_REVIEW_SUBJECT_SHA256 = "d5dea4be7dd274c7978c0544e8b9acea87990ec76b13432ec245b3bae88a11bb";

/** Attempt 1 exactly as received. Do not edit — it is the measurement. */
export const R240_LIVE_ATTEMPT_1: BoundaryTruthAssessment[] = [
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
    governedActionCandidateId: "none",
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
    surfaceRef: "branch[0].tradeoff[1]",
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
    surfaceRef: "branch[1].tradeoff[1]",
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

/** The six surfaces the contract refused, in canonical subject order. */
export const R240_FAILED_SURFACE_REFS = [
  "primary[1]",
  "branch[0].tradeoff[0]",
  "branch[0].tradeoff[1]",
  "branch[0].action[1]",
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
] as const;

/** The six the contract accepted and which a repair must never re-request or mutate. */
export const R240_PRESERVED_SURFACE_REFS = [
  "primary[0]",
  "branch[0].resulting_world_state",
  "branch[0].action[0]",
  "branch[1].resulting_world_state",
  "branch[1].action[0]",
  "branch[1].action[1]",
] as const;

export const R240_MEASURED = {
  liveOutcome: "boundary_reviewer_terminal_failure",
  authorityCode: "boundary_output_contract_failure",
  repeatedDefect: "boundary_candidate_required_missing",
  providerInvocations: 2,
  semanticAttempts: 2,
  transportFailures: 0,
  /** Every failure is the identical predicate: absent + non-empty pool + sentinel. */
  failurePredicate: "governedActionStatus=absent AND pool non-empty AND governedActionCandidateId=none",
  /** The one surface with an EMPTY pool — the R2.40 exemption, proven live. */
  emptyPoolSurface: "primary[0]",
  primaryOneLiveDetection: "MISSED 6/6",
  primaryOneR240Status: "NOT JUDGED — OUTPUT CONTRACT FAILURE",
} as const;
