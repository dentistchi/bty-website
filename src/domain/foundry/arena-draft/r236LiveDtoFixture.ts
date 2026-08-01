/**
 * THE CAPTURED R2.36 LIVE DTOs (Slice 3.2I-R5B1A.1-R2.38 Part 12).
 *
 * Two complete boundary reviews over the frozen c18 subject, returned by the provider on
 * 2026-08-01T19:31:05Z. Verbatim. Sanitized by construction — reviewer ANSWERS only: scenario
 * excerpts and enum values. No provider envelope, no headers, no usage metadata, no credential, no
 * account identifier, no request id.
 *
 * WHAT THEY MEASURED
 *
 * Both satisfied the provider strict schema. Both were discarded by local output-contract
 * validation, and R2.37 proved neither failure was the model's fault:
 *
 *   ATTEMPT 1  every row said `applicability: applies`; five of them alongside
 *              `governedActionStatus: absent` + `compliance: not_assessed` — a coherent reading of
 *              two questions that asked the same thing, and a state the parity table lacked.
 *              Semantically: 2 true positives, 2 FALSE positives.
 *
 *   ATTEMPT 2  the best live semantic result measured anywhere in the arc — 2 true positives, ZERO
 *              false positives — discarded because `branch[1].action[1]` cited `8:own` for its
 *              prerequisite failure instead of the byte-identical `12:par`. Only `12:par` was legal
 *              for that surface; the server had made the two indistinguishable by content.
 *
 * Both are carried forward UNMODIFIED. `r236LegacyUpgrade` translates them into the R2.38 candidate
 * contract as an explicit, refusable step — it never edits the capture.
 *
 * Pure domain: no I/O.
 */

import type { R236BoundaryAssessment } from "./legacyBoundaryDto";

export const R236_LIVE_RUN_ID = "20260801T193105Z";
export const R236_LIVE_ARTIFACT_SHA256 = "04fc6f48e03f5ecad961d65565cd0b4473a866eb28ea2f255540b9569c4f38d2";
export const R236_BOUNDARY_REVIEW_SUBJECT_SHA256 = "4a638eeca815a55fb95d9478fee3cac8128e79bf391579836fe3e611d2e4bf06";

/** The R2.35 human oracle. Applied AFTER the artifact was written; never encoded into a prompt. */
export const R236_ORACLE_VIOLATIONS = ["primary[1]", "branch[1].resulting_world_state", "branch[1].action[1]"] as const;

/** Attempt 1, exactly as received. Do not edit — it is the measurement. */
export const R236_LIVE_ATTEMPT_1: R236BoundaryAssessment[] = [
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[0]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "not_established",
    temporalRelation: "unrelated",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "1:own", excerpt: "Verify identifiers for both patients now" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[1]",
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "2:own", excerpt: "Notify the families and proceed with one patient" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].resulting_world_state",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "satisfied",
    temporalRelation: "prerequisite_before_action",
    compliance: "complies",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "3:own", excerpt: "You have verified identifiers for both patients and provided the necessary treatment without compens" },
    prerequisiteEvidence: { segmentRef: "3:anc", excerpt: "Verify identifiers for both patients now" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[0]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "satisfied",
    temporalRelation: "prerequisite_before_action",
    compliance: "complies",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "4:own", excerpt: "Prepare a detailed report for the administrator" },
    prerequisiteEvidence: { segmentRef: "4:anc", excerpt: "Verify identifiers for both patients now" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[1]",
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "5:own", excerpt: "Focus on patient care and delay the report" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[0]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "satisfied",
    temporalRelation: "prerequisite_before_action",
    compliance: "complies",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "6:own", excerpt: "Finalize the report and communicate with the administrator" },
    prerequisiteEvidence: { segmentRef: "6:anc", excerpt: "Verify identifiers for both patients now" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[1]",
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "7:own", excerpt: "Continue prioritizing patient care and defer the report" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].resulting_world_state",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: "8:own", excerpt: "You prioritized immediate treatment for one patient while notifying the family, but this left the" },
    prerequisiteEvidence: { segmentRef: "8:anc", excerpt: "Notify the families and proceed with one patient" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[0]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: "9:own", excerpt: "Prepare a summary of events for the administrator" },
    prerequisiteEvidence: { segmentRef: "9:anc", excerpt: "Notify the families and proceed with one patient" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[1]",
    applicability: "applies",
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
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: "11:own", excerpt: "Finish the summary and send it to the administrator" },
    prerequisiteEvidence: { segmentRef: "11:anc", excerpt: "Notify the families and proceed with one patient" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[1]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: "12:own", excerpt: "Immediately treat the second patient" },
    prerequisiteEvidence: { segmentRef: "12:anc", excerpt: "Notify the families and proceed with one patient" },
    reason: "",
  },
];

/** Attempt 2, exactly as received. Do not edit — it is the measurement. */
export const R236_LIVE_ATTEMPT_2: R236BoundaryAssessment[] = [
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
    prerequisiteEvidence: { segmentRef: "0:opn", excerpt: "you must first verify two identifiers for each before proceeding." },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "primary[1]",
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "2:own", excerpt: "Notify the families and proceed with one patient" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].resulting_world_state",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "satisfied",
    temporalRelation: "prerequisite_before_action",
    compliance: "complies",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "3:own", excerpt: "You have verified identifiers for both patients and provided the necessary treatment without..." },
    prerequisiteEvidence: { segmentRef: "0:opn", excerpt: "you must first verify two identifiers for each before proceeding." },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].tradeoff[0]",
    applicability: "applies",
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
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "5:own", excerpt: "Focus on patient care and delay the report" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[0]",
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "6:own", excerpt: "Finalize the report and communicate with the administrator" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[0].action[1]",
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "7:own", excerpt: "Continue prioritizing patient care and defer the report" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].resulting_world_state",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: "8:own", excerpt: "You prioritized immediate treatment for one patient while notifying the family, but this left the..." },
    prerequisiteEvidence: { segmentRef: "8:own", excerpt: "this left the second patient unverified, creating potential safety concerns and administrative..." },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].tradeoff[0]",
    applicability: "applies",
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
    applicability: "applies",
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
    applicability: "applies",
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    compliance: "not_assessed",
    violationMechanism: "none",
    actionEvidence: { segmentRef: "11:own", excerpt: "Finish the summary and send it to the administrator" },
    prerequisiteEvidence: { segmentRef: "", excerpt: "" },
    reason: "",
  },
  {
    boundaryId: "c1_verify",
    surfaceRef: "branch[1].action[1]",
    applicability: "applies",
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    compliance: "violates",
    violationMechanism: "governed_action_without_prerequisite",
    actionEvidence: { segmentRef: "12:own", excerpt: "Immediately treat the second patient" },
    prerequisiteEvidence: { segmentRef: "8:own", excerpt: "this left the second patient unverified, creating potential safety concerns and administrative..." },
    reason: "",
  },
];

export const R236_LIVE_ATTEMPTS = [R236_LIVE_ATTEMPT_1, R236_LIVE_ATTEMPT_2] as const;

/** What each attempt claimed, split by the oracle. The numbers this slice has to preserve. */
export const R236_MEASURED = {
  attempt1: {
    firstFailingCode: "boundary_assessment_state_invalid",
    redundantAxisRows: ["primary[1]", "branch[0].tradeoff[1]", "branch[0].action[1]", "branch[1].tradeoff[1]"],
    claimedViolations: ["branch[1].resulting_world_state", "branch[1].tradeoff[0]", "branch[1].action[0]", "branch[1].action[1]"],
    truePositives: ["branch[1].resulting_world_state", "branch[1].action[1]"],
    falsePositives: ["branch[1].tradeoff[0]", "branch[1].action[0]"],
  },
  attempt2: {
    firstFailingCode: "boundary_evidence_wrong_segment_kind",
    claimedViolations: ["branch[1].resulting_world_state", "branch[1].action[1]"],
    truePositives: ["branch[1].resulting_world_state", "branch[1].action[1]"],
    falsePositives: [] as string[],
    /** The alias that destroyed a correct answer: `8:own` and `12:par` are byte-identical. */
    aliasMisselection: { surfaceRef: "branch[1].action[1]", chose: "8:own", legal: "12:par" },
  },
  /** Missed by BOTH attempts. Carried forward, still unmeasured live. */
  falseNegative: "primary[1]",
} as const;
