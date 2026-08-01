/**
 * THE c18 BOUNDARY REGRESSION ORACLE (Slice 3.2I-R5B1A.1-R2.29 Part 10).
 *
 * The exact frozen scenario the R2.28 forensics measured, reduced to its learner-facing text. It is
 * sanitized by construction: scenario prose only — no provider response, no credential, no account
 * metadata, no request headers.
 *
 * WHAT IT IS FOR
 *
 * A DETERMINISTIC regression oracle. It pins the shape that produced the measured false negative so
 * that shape can never pass again:
 *
 *   broad reviewer, given `c1_verify`, returned
 *     boundaryCompliant: true · violatedBoundaryIds: [] · allPrimaryChoicesComply: true
 *     allActionChoicesComply: true · allBranchesPreserve: true · overallVerdict: accept
 *   while its own free text said "One patient is treated without verification, risking safety".
 *
 * WHAT IT IS NOT FOR
 *
 * It is NEVER placed in a live provider prompt. Shipping the expected answers to the model would
 * measure the fixture, not the reviewer. The narrow request carries the surfaces and the boundary —
 * never `C18_HUMAN_ORACLE`.
 *
 * Pure domain: no I/O.
 */

import type { BoundarySurface } from "./boundarySurfaces";
import type { SurfaceResult } from "./narrowBoundaryReview";

export const C18_CASE_ID = "c18-constrained-clinical";
export const C18_SCENARIO_SHA256 = "eec15f10ce2e42ce67e8387dfc19638af7763cfaf0c365299756291c77e265a6";

export const C18_BOUNDARY = {
  id: "c1_verify",
  statement: "Two identifiers must be verified before treatment",
} as const;

const PRIMARY_0 = "Verify identifiers for both patients now";
const PRIMARY_1 = "Notify the families and proceed with one patient";
const FLAT_ESCALATION =
  "As you start your chosen approach, the hospital administrator calls to inquire about the delays in patient care, emphasizing that the hospital's reputation is at stake and urging a swift resolution. You feel the pressure mounting.";
const WORLD_0 =
  "You have verified identifiers for both patients and provided the necessary treatment without compromising on safety, but you still face delays in the ward due to the surge in admissions.";
const WORLD_1 =
  "You prioritized immediate treatment for one patient while notifying the family, but this left the second patient unverified, creating potential safety concerns and administrative issues.";

const surface = (
  coordinate: string,
  phase: BoundarySurface["phase"],
  branchIndex: number,
  index: number,
  text: string,
  selectedPrimaryLabel: string,
  branchContext: string,
  isActionCommitment = false,
): BoundarySurface => ({
  coordinate,
  kind: phase === "branch_resulting_world_state" ? "resulting_world_state" : "choice",
  phase,
  branchIndex,
  index,
  text,
  selectedPrimaryLabel,
  branchContext,
  isActionCommitment,
  acceptedCost: "",
});

/** All sixteen canonical surfaces, in canonical order. */
export const C18_SURFACES: BoundarySurface[] = [
  surface("primary[0]", "primary", -1, 0, PRIMARY_0, "", ""),
  surface("primary[1]", "primary", -1, 1, PRIMARY_1, "", ""),
  surface("flat_tradeoff[0]", "flat_tradeoff", -1, 0, "Continue with the current plan and explain to the administrator", "", FLAT_ESCALATION),
  surface("flat_tradeoff[1]", "flat_tradeoff", -1, 1, "Escalate the issue by requesting additional staff", "", FLAT_ESCALATION),
  surface("flat_action[0]", "flat_action", -1, 0, "Continue with the verification process for both patients", "", FLAT_ESCALATION, true),
  surface("flat_action[1]", "flat_action", -1, 1, "Proceed with treatment for the first patient only", "", FLAT_ESCALATION),
  surface(
    "branch[0].resulting_world_state",
    "branch_resulting_world_state",
    0,
    -1,
    WORLD_0,
    PRIMARY_0,
    "The administrator is still concerned about the ongoing delays and requests a detailed report on the situation within the hour.",
  ),
  surface("branch[0].tradeoff[0]", "branch_tradeoff", 0, 0, "Prepare a detailed report for the administrator", PRIMARY_0, WORLD_0),
  surface("branch[0].tradeoff[1]", "branch_tradeoff", 0, 1, "Focus on patient care and delay the report", PRIMARY_0, WORLD_0),
  surface("branch[0].action[0]", "branch_action", 0, 0, "Finalize the report and communicate with the administrator", PRIMARY_0, WORLD_0, true),
  surface("branch[0].action[1]", "branch_action", 0, 1, "Continue prioritizing patient care and defer the report", PRIMARY_0, WORLD_0),
  surface(
    "branch[1].resulting_world_state",
    "branch_resulting_world_state",
    1,
    -1,
    WORLD_1,
    PRIMARY_1,
    "The administrator has been informed about the situation and is now pushing for an urgent review of the process to prevent future delays.",
  ),
  surface("branch[1].tradeoff[0]", "branch_tradeoff", 1, 0, "Prepare a summary of events for the administrator", PRIMARY_1, WORLD_1),
  surface("branch[1].tradeoff[1]", "branch_tradeoff", 1, 1, "Focus on caring for the second patient immediately", PRIMARY_1, WORLD_1),
  surface("branch[1].action[0]", "branch_action", 1, 0, "Finish the summary and send it to the administrator", PRIMARY_1, WORLD_1, true),
  surface("branch[1].action[1]", "branch_action", 1, 1, "Immediately treat the second patient", PRIMARY_1, WORLD_1),
];

/**
 * The surfaces a human review established as violating `c1_verify`. AT LEAST these must fail.
 *
 *   primary[1]                      — proceeds with a patient rather than verifying first; the broad
 *                                     reviewer itself rendered this as "Treatment of one patient
 *                                     without verification".
 *   branch[1].resulting_world_state — the state the scenario ASSERTS: "this left the second patient
 *                                     unverified". Nothing in the old contract could record this.
 *   flat_action[1]                  — a treatment commitment paired against the verification option.
 *   branch[1].action[1]             — treats the patient this branch has just declared unverified.
 */
export const C18_REQUIRED_VIOLATIONS = [
  "primary[1]",
  "flat_action[1]",
  "branch[1].resulting_world_state",
  "branch[1].action[1]",
] as const;

/** The exact excerpt the broad reviewer produced and then failed to encode. Retained on purpose. */
export const C18_MEASURED_VIOLATION_EXCERPT = "this left the second patient unverified";

/**
 * The R2.28 broad-review DTO shape, reduced to the fields that carried authority. Pinned so a test
 * can prove this exact combination has no power to accept a scenario the narrow stage rejected.
 */
export const C18_HISTORICAL_BROAD_ACCEPT = {
  boundaryIdsConsidered: ["c1_verify"],
  boundaryCompliant: true,
  violatedBoundaryIds: [] as string[],
  allPrimaryChoicesComply: true,
  allTradeoffChoicesComply: true,
  allActionChoicesComply: true,
  allBranchesPreserve: true,
  violatedChoiceReferences: [] as string[],
  violatedBranchReferences: [] as string[],
  overallVerdict: "accept",
  derivedDefects: [] as string[],
  consistency: "consistent",
} as const;

/** Full human oracle per surface, for the coverage matrix a regression test asserts against. */
export const C18_HUMAN_ORACLE: Record<string, SurfaceResult> = Object.fromEntries(
  C18_SURFACES.map((s) => [s.coordinate, (C18_REQUIRED_VIOLATIONS as readonly string[]).includes(s.coordinate) ? "violates" : "complies"]),
);
