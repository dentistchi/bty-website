/**
 * THE CAPTURED R2.34 LIVE DTO (Slice 3.2I-R5B1A.1-R2.36 Part 11).
 *
 * One complete boundary review over the frozen c18 subject, returned by the provider on
 * 2026-08-01T16:02:05Z. Verbatim. Sanitized by construction — these are the reviewer's structured
 * ANSWERS: scenario excerpts and enum values only. No provider envelope, no headers, no usage
 * metadata, no credential, no account identifier, no request id.
 *
 * WHAT IT MEASURED
 *
 * Four claimed violations. Against the R2.35 human oracle — `primary[1]`,
 * `branch[1].resulting_world_state`, `branch[1].action[1]` — that is 2 true positives, 2 FALSE
 * POSITIVES and 1 false negative:
 *
 *   FP  branch[0].resulting_world_state   own text: "You have verified identifiers for both
 *                                         patients…" — the prerequisite SATISFIED — rejected using
 *                                         "but you still face delays in the ward".
 *   FP  branch[0].action[0]               "Finalize the report and communicate with the
 *                                         administrator" — an administrative action — rejected
 *                                         using its PARENT world state's same delay clause.
 *   TP  branch[1].resulting_world_state   "…left the second patient unverified". Correct.
 *   TP  branch[1].action[1]               "Immediately treat the second patient" while the parent
 *                                         state says the patient is unverified. Correct.
 *   FN  primary[1]                        not_applicable in 3 of 3 live runs.
 *
 * Every one of those verdicts passed the R2.34 validator. Grounding proved WHERE each excerpt lived
 * and never what it MEANT.
 *
 * THE UPGRADE, AND WHY IT IS EXPLICIT
 *
 * The capture cannot be replayed against the truth contract directly: it has no governed-action
 * status, no prerequisite status, no temporal relation and no segment references, because nothing
 * asked for them. `R234_UPGRADED_TO_TRUTH_CONTRACT` is the capture re-expressed under the new
 * contract, and it is deliberately CHARITABLE: every row is filled with the strongest truth claim
 * that is still consistent with the excerpts the model actually chose. A violation claim therefore
 * arrives as `governedActionStatus: present` + `prerequisiteStatus: explicitly_missing` — the model
 * gets the benefit of every doubt, and the gates must refuse it anyway, on the evidence alone.
 *
 * WHAT THIS FIXTURE PROVES, AND WHAT IT DOES NOT
 *
 * It proves the CONTRACT refuses both false positives while preserving both true positives, over
 * real provider output rather than a mock authored from the validator's own expectations — which is
 * exactly how the defect stayed invisible to CI. It does NOT prove the live reviewer now answers
 * differently: no provider call was made in this slice, and the false negative on `primary[1]` is
 * carried forward UNMEASURED.
 *
 * Pure domain: no I/O.
 */

import type { LegacyBoundaryAssessment } from "./legacyBoundaryDto";
import type { NarrowBoundaryAssessment } from "./narrowBoundaryReview";

export const R234_LIVE_RUN_ID = "20260801T160205Z";
export const R234_BOUNDARY_REVIEW_SUBJECT_SHA256 = "b15bfb8f703b17b2379ffe4222fb623149e74e0350f3e5e0516ab4a02a867280";
export const R234_LIVE_ARTIFACT =
  ".eval-artifacts/practice-review.boundaryreplay.live.20260801T160205Z.pass2.c18-constrained-clinical.a2.b15bfb8f703b.json";

/** The response exactly as received. Do not edit — it is the measurement. */
export const R234_LIVE_ASSESSMENTS: LegacyBoundaryAssessment[] = [
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[0]",
    applicability: "applies",
    compliance: "complies",
    governedActionEvidence: "Verify identifiers for both patients now",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[1]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Notify the families and proceed with one patient",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].resulting_world_state",
    applicability: "applies",
    compliance: "violates",
    governedActionEvidence:
      "You have verified identifiers for both patients and provided the necessary treatment without compromising on safety",
    prerequisiteFailureEvidence: "but you still face delays in the ward due to the surge in admissions.",
    violationMechanism: "resulting_state_missing_prerequisite",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[0]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Prepare a detailed report for the administrator",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[1]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Focus on patient care and delay the report",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[0]",
    applicability: "applies",
    compliance: "violates",
    governedActionEvidence: "Finalize the report and communicate with the administrator",
    prerequisiteFailureEvidence: "but you still face delays in the ward due to the surge in admissions.",
    violationMechanism: "resulting_state_missing_prerequisite",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[1]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Continue prioritizing patient care and defer the report",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].resulting_world_state",
    applicability: "applies",
    compliance: "violates",
    governedActionEvidence: "You prioritized immediate treatment for one patient while notifying the family",
    prerequisiteFailureEvidence:
      "but this left the second patient unverified, creating potential safety concerns and administrative issues.",
    violationMechanism: "resulting_state_missing_prerequisite",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[0]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Prepare a summary of events for the administrator",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[1]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Focus on caring for the second patient immediately",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[0]",
    applicability: "not_applicable",
    compliance: "not_assessed",
    governedActionEvidence: "Finish the summary and send it to the administrator",
    prerequisiteFailureEvidence: "",
    violationMechanism: "none",
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[1]",
    applicability: "applies",
    compliance: "violates",
    governedActionEvidence: "Immediately treat the second patient",
    prerequisiteFailureEvidence:
      "but this left the second patient unverified, creating potential safety concerns and administrative issues.",
    violationMechanism: "resulting_state_missing_prerequisite",
    reason: "",
  },
];

/** The R2.35 human oracle. Applied AFTER the artifact was written; never encoded into a prompt. */
export const R234_ORACLE_VIOLATIONS = ["primary[1]", "branch[1].resulting_world_state", "branch[1].action[1]"] as const;

/** What the capture claimed, split by the oracle. The numbers this slice has to move. */
export const R234_MEASURED = {
  claimedViolations: ["branch[0].resulting_world_state", "branch[0].action[0]", "branch[1].resulting_world_state", "branch[1].action[1]"],
  falsePositives: ["branch[0].resulting_world_state", "branch[0].action[0]"],
  truePositives: ["branch[1].resulting_world_state", "branch[1].action[1]"],
  falseNegatives: ["primary[1]"],
} as const;

/**
 * The capture re-expressed under the truth contract, charitably (see the header).
 *
 * Segment refs follow `buildContextSegments` over `C18_REACHABLE_SURFACES`: index 0 is the scenario
 * opening, and each reachable surface takes a 1-based index shared by all of its segments.
 */
export const R234_UPGRADED_TO_TRUTH_CONTRACT: NarrowBoundaryAssessment[] = [
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[0]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "satisfied",
    temporalRelation: "prerequisite_before_action",
    compliance: "complies",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "1:own", excerpt: "Verify identifiers for both patients now" },
    prerequisiteEvidence: { segmentRef: "1:own", excerpt: "Verify identifiers for both patients now" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[1]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "2:own", excerpt: "Notify the families and proceed with one patient" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  // FALSE POSITIVE 1. The prerequisite is SATISFIED in this surface's own text and the claimed
  // failure is a scheduling delay. Charitably upgraded to the strongest violation claim available.
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].resulting_world_state",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "resulting_state_missing_prerequisite",
    actionEvidence: {
      segmentRef: "3:own",
      excerpt: "You have verified identifiers for both patients and provided the necessary",
    },
    prerequisiteEvidence: { segmentRef: "3:own", excerpt: "but you still face delays in the ward due to the surge in admissions." },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[0]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "4:own", excerpt: "Prepare a detailed report for the administrator" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[1]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "5:own", excerpt: "Focus on patient care and delay the report" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  // FALSE POSITIVE 2. An administrative action rejected on its PARENT world state's delay clause —
  // the cross-surface leak. Cited honestly, the excerpt is a `parent_generated_state` segment.
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[0]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "resulting_state_missing_prerequisite",
    actionEvidence: { segmentRef: "6:own", excerpt: "Finalize the report and communicate with the administrator" },
    prerequisiteEvidence: { segmentRef: "6:par", excerpt: "but you still face delays in the ward due to the surge in admissions." },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[1]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "7:own", excerpt: "Continue prioritizing patient care and defer the report" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  // TRUE POSITIVE 1. Own text treats; own text says the second patient is unverified.
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].resulting_world_state",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "resulting_state_missing_prerequisite",
    actionEvidence: { segmentRef: "8:own", excerpt: "You prioritized immediate treatment for one patient while notifying the family" },
    prerequisiteEvidence: {
      segmentRef: "8:own",
      excerpt: "but this left the second patient unverified, creating potential safety",
    },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[0]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "9:own", excerpt: "Prepare a summary of events for the administrator" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[1]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "10:own", excerpt: "Focus on caring for the second patient immediately" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[0]",
    applicability: "not_applicable",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "11:own", excerpt: "Finish the summary and send it to the administrator" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  // TRUE POSITIVE 2. Treating IS the governed action, so the inherited state is legitimately
  // citable here — the same segment kind that is refused on `branch[0].action[0]` above.
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[1]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    // The capture's own mechanism, kept verbatim. The upgrade fills the truth fields; it never
    // rewrites the model's answer.
    violationMechanism: "resulting_state_missing_prerequisite",
    actionEvidence: { segmentRef: "12:own", excerpt: "Immediately treat the second patient" },
    prerequisiteEvidence: {
      segmentRef: "12:par",
      excerpt: "but this left the second patient unverified, creating potential safety",
    },
    reason: "",
  },
];
