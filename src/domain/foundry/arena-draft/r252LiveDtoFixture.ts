/**
 * THE CAPTURED R2.52 LIVE PATCH (Slice 3.2I-R5B1A.1-R2.54 Part 4).
 *
 * R2.52 made the field-level patch the only reachable repair path, and the first live run under it
 * reached the provider twice and produced no verdict. This module carries the SECOND response
 * verbatim — the thirteen patch operations exactly as
 * `boundaryReviewEvidence[1].parsed.repairs` retained them — together with the counters the run
 * recorded. Nothing here is reconstructed, and nothing is corrected.
 *
 * WHAT THE RUN MEASURED
 *
 *   repairMode                      field_patch
 *   fullRowReviewCallCount          1
 *   fieldRepairCallCount            1
 *   legacyWholeRowRepairCallCount   0        (the R2.51 defect stayed closed)
 *   fieldRepairOperationCount       13       (9 candidate-only + one 4-field prerequisite group)
 *   fieldRepairMissingOperationCount 0
 *   fieldRepairDuplicateOperationCount 0
 *   fieldRepairUntargetedOperationCount 0
 *   fieldRepairFrozenMutationCount  0
 *   fieldRepairMergedRowInvalidCount 1
 *   fieldRepairCodes                ["field_repair_merged_row_invalid"]
 *   boundaryReviewOutcome           boundary_reviewer_terminal_failure
 *
 * Every patch-layer counter is clean. The patch was well-formed, complete, untargeted-free and
 * frozen-mutation-free — and the run still had no verdict, because the merged matrix was refused by
 * the CANONICAL ROW VALIDATOR one step later.
 *
 * WHAT R2.53 FOUND UNDERNEATH
 *
 * The group on `branch[0].resulting_world_state` chose
 *
 *     present / not_established / not_applicable / none / none
 *       -> governed_action_prerequisite_not_established
 *
 * a CANONICALLY VALID state whose `reasonAuthority` is `model_required`. `reason` was frozen at `""`
 * from attempt 1 — correct there, where the state was `governed_action_prerequisite_missing` and the
 * authority was `server_derived` — and it was not a repairable field at all, so no plan could have
 * asked for the prose the new state demands. The row failed on `boundary_reason_required_missing`.
 *
 * Two defects, one root. The group was published as five independent scalar lists, so per-field
 * membership never proved the tuple; and the field whose authority the tuple MOVED was outside the
 * closure. R2.54 answers both, and this fixture is what its regressions run against.
 *
 * ATTEMPT 1 of this run is byte-identical to `R248_ATTEMPT_1` — same frozen subject, same reviewer
 * answer — so it is not duplicated here. Import it from `r248LiveDtoFixture`.
 *
 * Carried forward UNMODIFIED. The corrected authority is applied TO this evidence, never written
 * INTO it.
 *
 * Pure domain: no I/O.
 */

export const R252_LIVE_RUN_ID = "20260802T060305Z";
export const R252_LIVE_ARTIFACT_FILE =
  "practice-review.boundaryreplay.live.20260802T060305Z.pass2.c18-constrained-clinical.a2.316bbedf693f.json";
export const R252_LIVE_ARTIFACT_SHA256 = "43b60b3a31767173b66ee4f79bc9f78077bd5ffdc99b050eff3f13421691b586";
export const R252_BOUNDARY_REVIEW_SUBJECT_SHA256 = "316bbedf693f4266bc8f5e3c4a1f6d73a73edce35462e0fedeca594dce10e6de";
export const R252_REPAIR_PLAN_SHA256 = "f3aff657cb57aa8476531866e2a2fb986c9da9a5f49bd2f73ad458d88d1332ae";

export type CapturedRepairOperation = { surfaceRef: string; field: string; value: string };

/** The live patch, verbatim. THIRTEEN operations against what was then a thirteen-target plan. */
export const R252_CAPTURED_PATCH: readonly CapturedRepairOperation[] = [
  { surfaceRef: "primary[1]", field: "governedActionCandidateId", value: "2-a1" },
  { surfaceRef: "branch[0].resulting_world_state", field: "prerequisiteStatus", value: "not_established" },
  { surfaceRef: "branch[0].resulting_world_state", field: "temporalRelation", value: "not_applicable" },
  { surfaceRef: "branch[0].resulting_world_state", field: "prerequisiteSatisfactionCandidateId", value: "none" },
  { surfaceRef: "branch[0].resulting_world_state", field: "prerequisiteFailureCandidateId", value: "none" },
  { surfaceRef: "branch[0].tradeoff[0]", field: "governedActionCandidateId", value: "4-a1" },
  { surfaceRef: "branch[0].tradeoff[1]", field: "governedActionCandidateId", value: "5-a1" },
  { surfaceRef: "branch[0].action[0]", field: "governedActionCandidateId", value: "6-a1" },
  { surfaceRef: "branch[0].action[1]", field: "governedActionCandidateId", value: "7-a1" },
  { surfaceRef: "branch[1].tradeoff[0]", field: "governedActionCandidateId", value: "9-a1" },
  { surfaceRef: "branch[1].tradeoff[1]", field: "governedActionCandidateId", value: "10-a1" },
  { surfaceRef: "branch[1].action[0]", field: "governedActionCandidateId", value: "11-a1" },
  { surfaceRef: "branch[1].action[1]", field: "governedActionCandidateId", value: "12-a1" },
] as const;

/** The one surface whose group carried the defect. */
export const R252_DEFECTIVE_GROUP_SURFACE_REF = "branch[0].resulting_world_state";

/**
 * The group selection the live model made, isolated.
 *
 * `reason` is not a member: in R2.52 it was not a repairable field, which is precisely why the
 * selection could move the row into a state demanding prose that no operation could supply.
 */
export const R252_CAPTURED_GROUP_SELECTION = {
  prerequisiteStatus: "not_established",
  temporalRelation: "not_applicable",
  prerequisiteSatisfactionCandidateId: "none",
  prerequisiteFailureCandidateId: "none",
} as const;

/** The state that selection resolves to, and the authority that refused it. */
export const R252_SELECTED_STATE_ID = "governed_action_prerequisite_not_established";
export const R252_SELECTED_STATE_REASON_AUTHORITY = "model_required";

/** The frozen attempt-1 value of `reason` on that row. Correct in its old state, illegal in the new. */
export const R252_FROZEN_REASON = "";

export const R252_MEASURED = {
  repairMode: "field_patch",
  fullRowReviewCallCount: 1,
  fieldRepairCallCount: 1,
  legacyWholeRowRepairCallCount: 0,
  boundaryReviewOutcome: "boundary_reviewer_terminal_failure",
  outputContractFailure: true,
  authorityCodes: ["boundary_output_contract_failure"],
  artifactVersion: "practice-narrow-boundary-replay/5",
  /** The patch-layer counters, all clean. The refusal came from BELOW the repair layer. */
  fieldRepairMetrics: {
    fieldRepairSurfaceCount: 10,
    fieldRepairOperationCount: 13,
    fieldRepairDependencyGroupCount: 10,
    fieldRepairMissingOperationCount: 0,
    fieldRepairDuplicateOperationCount: 0,
    fieldRepairUntargetedOperationCount: 0,
    fieldRepairFrozenMutationCount: 0,
    fieldRepairMergedRowInvalidCount: 1,
  },
  fieldRepairCodes: ["field_repair_merged_row_invalid"],
  /** The merged-row code R2.53 traced the refusal to. */
  mergedRowRefusalCode: "boundary_reason_required_missing",
  /** The patch reached the merge. That is the fact R2.54 exists to change. */
  reachedMergeBoundary: true,
  operationsSent: 13,
} as const;
