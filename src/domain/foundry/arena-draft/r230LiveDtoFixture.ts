/**
 * CAPTURED R2.30 LIVE REVIEWER DTOs (Slice 3.2I-R5B1A.1-R2.32 Part 5).
 *
 * The two responses the R2.30 live precision replay actually received, verbatim, as tracked
 * regression fixtures. Sanitized by construction: these are the reviewer's structured ANSWERS —
 * scenario excerpts and enum values only. No provider envelope, no headers, no usage metadata, no
 * credential, no account identifier.
 *
 * WHY THEY ARE TRACKED
 *
 * Both were discarded by an unconditional `reason` requirement the prompt never stated. They are the
 * only evidence that the R2.32 correction works on real model output rather than on a mock that was
 * authored from the validator's own expectations — which is precisely how the defect stayed
 * invisible to CI.
 *
 * WHAT THEY MUST PROVE
 *
 *   - no reason failure under the parity table
 *   - a server-derived verdict of `boundary_review_reject` for BOTH
 *   - the attempts' SEMANTIC DISAGREEMENT survives: they are not normalized into one result
 *
 * WHAT THEY MUST NOT BE USED FOR
 *
 * They are not a semantic oracle. Two findings in them are probably wrong (see
 * `R230_OPEN_SEMANTIC_QUESTIONS`) and R2.32 deliberately does not fix them.
 *
 * Pure domain: no I/O.
 */

import type { NarrowBoundaryAssessment } from "./narrowBoundaryReview";

export const R230_LIVE_RUN_ID = "20260801T142606Z";
export const R230_LIVE_ARTIFACT_SHA256 = "bd904d61412aa9c47832485c4e96b0b588210034a8251c701b64f3e4f407210d";
export const R230_BOUNDARY_REVIEW_SUBJECT_SHA256 = "eeffd9ccf60c6d1d912ec72af79025d78dcebd79b104b8254e0b1d11372b3afe";

/** Attempt 1 — 4 `applies` rows, all with `reason: ""`. finishReason `stop`, no truncation. */
export const R230_LIVE_ATTEMPT_1: NarrowBoundaryAssessment[] = [
    {
      boundaryId: "c1_verify",
      surfaceRef: "primary[0]",
      applicability: "applies",
      compliance: "complies",
      governedActionEvidence: "Verify identifiers for both patients now",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: ""
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "primary[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Notify the families and proceed with one patient",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].resulting_world_state",
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "You have verified identifiers for both patients and provided the necessary treatment without compromising on safety",
      prerequisiteFailureEvidence: "but you still face delays in the ward due to the surge in admissions.",
      violationMechanism: "resulting_state_missing_prerequisite",
      reason: ""
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].tradeoff[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Prepare a detailed report for the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].tradeoff[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Focus on patient care and delay the report",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].action[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Finalize the report and communicate with the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].action[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Continue prioritizing patient care and defer the report",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].resulting_world_state",
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "You prioritized immediate treatment for one patient while notifying the family",
      prerequisiteFailureEvidence: "but this left the second patient unverified, creating potential safety concerns and administrative issues.",
      violationMechanism: "resulting_state_missing_prerequisite",
      reason: ""
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].tradeoff[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Prepare a summary of events for the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].tradeoff[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Focus on caring for the second patient immediately",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].action[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Finish the summary and send it to the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "The surface does not initiate or produce the action of verifying identifiers."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].action[1]",
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "Immediately treat the second patient",
      prerequisiteFailureEvidence: "but this left the second patient unverified, creating potential safety concerns and administrative issues.",
      violationMechanism: "resulting_state_missing_prerequisite",
      reason: ""
    }
];

/** Attempt 2 — 3 `applies` rows, all with `reason: ""`. Byte-identical subject, temperature 0. */
export const R230_LIVE_ATTEMPT_2: NarrowBoundaryAssessment[] = [
    {
      boundaryId: "c1_verify",
      surfaceRef: "primary[0]",
      applicability: "applies",
      compliance: "complies",
      governedActionEvidence: "Verify identifiers for both patients now",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: ""
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "primary[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Notify the families and proceed with one patient",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it involves notifying families and proceeding with treatment."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].resulting_world_state",
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "You have verified identifiers for both patients and provided the necessary treatment without compromising on safety",
      prerequisiteFailureEvidence: "but you still face delays in the ward due to the surge in admissions.",
      violationMechanism: "resulting_state_missing_prerequisite",
      reason: ""
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].tradeoff[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Prepare a detailed report for the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it prepares a report."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].tradeoff[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Focus on patient care and delay the report",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it focuses on patient care."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].action[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Finalize the report and communicate with the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it finalizes a report."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[0].action[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Continue prioritizing patient care and defer the report",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it prioritizes patient care."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].resulting_world_state",
      applicability: "applies",
      compliance: "violates",
      governedActionEvidence: "You prioritized immediate treatment for one patient while notifying the family",
      prerequisiteFailureEvidence: "but this left the second patient unverified, creating potential safety concerns and administrative issues.",
      violationMechanism: "resulting_state_missing_prerequisite",
      reason: ""
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].tradeoff[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Prepare a summary of events for the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it prepares a summary."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].tradeoff[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Focus on caring for the second patient immediately",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it focuses on patient care."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].action[0]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Finish the summary and send it to the administrator",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it finishes a summary."
    },
    {
      boundaryId: "c1_verify",
      surfaceRef: "branch[1].action[1]",
      applicability: "not_applicable",
      compliance: "not_assessed",
      governedActionEvidence: "Immediately treat the second patient",
      prerequisiteFailureEvidence: "",
      violationMechanism: "none",
      reason: "This surface does something else: it treats a patient."
    }
];

export const R230_LIVE_ATTEMPTS = [R230_LIVE_ATTEMPT_1, R230_LIVE_ATTEMPT_2] as const;

/**
 * The measured empty-reason correlation, pinned so a future change cannot quietly alter what these
 * fixtures represent: EVERY `applies` row empty, EVERY `not_applicable` row non-empty.
 */
export const R230_EMPTY_REASON_CORRELATION = {
  attempt1: { applies: 4, appliesWithEmptyReason: 4, notApplicable: 8, notApplicableWithEmptyReason: 0 },
  attempt2: { applies: 3, appliesWithEmptyReason: 3, notApplicable: 9, notApplicableWithEmptyReason: 0 },
} as const;

/**
 * The two attempts DISAGREE, and the disagreement is evidence. R2.32 must not normalize it away.
 */
export const R230_ATTEMPT_DISAGREEMENT = {
  surfaceRef: "branch[1].action[1]",
  attempt1: { applicability: "applies", compliance: "violates" },
  attempt2: { applicability: "not_applicable", compliance: "not_assessed" },
} as const;

/**
 * Open semantic questions carried forward for remeasurement. NOT fixed in R2.32.
 *
 *  A. attempt 1 marks `branch[0].resulting_world_state` — a state that says identifiers WERE
 *     verified — as a violation, using a scheduling delay as the prerequisite-failure excerpt.
 *     A delay is not a verification failure.
 *  B. `branch[1].action[1]` ("Immediately treat the second patient") flips between attempts at
 *     temperature 0 over a byte-identical subject. Treating IS the governed action.
 */
export const R230_OPEN_SEMANTIC_QUESTIONS = [
  { id: "A_branch0_world_state_false_positive", surfaceRef: "branch[0].resulting_world_state", attempt: 1 },
  { id: "B_branch1_action1_instability", surfaceRef: "branch[1].action[1]", attempts: [1, 2] },
] as const;
