/**
 * THE c18 BOUNDARY REGRESSION ORACLE (Slice 3.2I-R5B1A.1-R2.30 Part 8).
 *
 * The exact frozen scenario, reduced to its learner-facing text. Sanitized by construction: scenario
 * prose only — no provider response, no credential, no account metadata, no request headers.
 *
 * WHAT IT PINS NOW
 *
 * R2.28 measured a FALSE NEGATIVE: the broad reviewer wrote "One patient is treated without
 * verification" and returned `boundaryCompliant: true`.
 *
 * R2.29 fixed that and measured FALSE POSITIVES: nine violations where four describe the problem.
 * Three of the five surplus findings carried one rationale family —
 *
 *     "requesting additional staff"                          → "Does not address verification of identifiers."
 *     "Prepare a summary of events for the administrator"     → "Does not address verification of identifiers."
 *     "Finish the summary and send it to the administrator"   → "Does not address verification of identifiers."
 *
 * — and two were context-dependent rather than settled. This oracle therefore pins THREE classes,
 * not two: violations, non-violations, and genuinely uncertain.
 *
 * WHAT IT IS NOT FOR
 *
 * It is NEVER placed in a live provider prompt. Shipping the expected answers would measure the
 * fixture, not the reviewer. The narrow request carries surfaces and boundaries only.
 *
 * Pure domain: no I/O.
 */

import { compatibilitySurfaces, enumerateBoundarySurfaces, reviewableSurfaces, type BoundarySurface } from "./boundarySurfaces";
import type { ArenaScenarioDraft } from "./types";
import type { LegacyApplicability as ApplicabilityResult, LegacyCompliance as ComplianceResult } from "./legacyBoundaryDto";

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
const ESCALATION_0 = "The administrator is still concerned about the ongoing delays and requests a detailed report on the situation within the hour.";
const ESCALATION_1 = "The administrator has been informed about the situation and is now pushing for an urgent review of the process to prevent future delays.";

/**
 * The sanitized frozen scenario, as a tracked literal. Surfaces are DERIVED from it by the same
 * enumerator production uses, so the fixture cannot drift from the real map — a hand-maintained
 * surface list would silently diverge the moment the enumerator changed.
 */
export const C18_SCENARIO: ArenaScenarioDraft = {
  title: "Managing a Backed-Up Ward",
  opening:
    "You are a charge nurse on a busy ward, and the patient admissions have surged unexpectedly. You just learned that two patients require immediate treatment, but you must first verify two identifiers for each before proceeding. As the clock ticks, the waiting patients and their families are growing anxious, and there\u2019s a risk of delays impacting care quality. You know you can't afford to compromise on verification, but the pressure to act quickly is intense.",
  primary: { choices: [{ id: "p1", label: PRIMARY_0 }, { id: "p2", label: PRIMARY_1 }] },
  tradeoff: {
    escalationText: FLAT_ESCALATION,
    choices: [
      { id: "ft1", label: "Continue with the current plan and explain to the administrator" },
      { id: "ft2", label: "Escalate the issue by requesting additional staff" },
    ],
  },
  actionDecision: {
    prompt: "Choose how to proceed based on your earlier choice:",
    choices: [
      { id: "fa1", label: "Continue with the verification process for both patients", isActionCommitment: true },
      { id: "fa2", label: "Proceed with treatment for the first patient only", isActionCommitment: false },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: WORLD_0,
      escalationText: ESCALATION_0,
      tradeoffChoices: [
        { id: "p1-t1", label: "Prepare a detailed report for the administrator" },
        { id: "p1-t2", label: "Focus on patient care and delay the report" },
      ],
      actionDecision: {
        prompt: "Decide how to balance your priorities moving forward:",
        choices: [
          { id: "p1-a1", label: "Finalize the report and communicate with the administrator", isActionCommitment: true },
          { id: "p1-a2", label: "Continue prioritizing patient care and defer the report", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: WORLD_1,
      escalationText: ESCALATION_1,
      tradeoffChoices: [
        { id: "p2-t1", label: "Prepare a summary of events for the administrator" },
        { id: "p2-t2", label: "Focus on caring for the second patient immediately" },
      ],
      actionDecision: {
        prompt: "Choose your next step to resolve the situation:",
        choices: [
          { id: "p2-a1", label: "Finish the summary and send it to the administrator", isActionCommitment: true },
          { id: "p2-a2", label: "Immediately treat the second patient", isActionCommitment: false },
        ],
      },
    },
  },
};

/** Every surface, derived exactly as production derives it. */
export const C18_SURFACES: BoundarySurface[] = enumerateBoundarySurfaces(C18_SCENARIO, {});

/** The TWELVE the learner actually reaches. */
export const C18_REACHABLE_SURFACES: BoundarySurface[] = reviewableSurfaces(C18_SURFACES);

/**
 * The FOUR compatibility projections. MEASURED unreachable: `ArenaPracticePlayer` resolves
 * `branches[selectedPrimaryId]` for every branch-aware draft, so these are never rendered.
 */
export const C18_COMPATIBILITY_SURFACES: BoundarySurface[] = compatibilitySurfaces(C18_SURFACES);

/**
 * CLEAR VIOLATIONS — each proves a governed action AND a missing prerequisite.
 *
 *   primary[1]                      "proceed with one patient" — commits to treating while the
 *                                   two-identifier check is unmet.
 *   branch[1].resulting_world_state "left the second patient unverified" — the asserted state
 *                                   already contains treatment without the prerequisite.
 *   branch[1].action[1]             "Immediately treat the second patient" — newly authorizes a
 *                                   SECOND unverified treatment, so it is not a mere repeat.
 */
export const C18_CLEAR_VIOLATIONS = ["primary[1]", "branch[1].resulting_world_state", "branch[1].action[1]"] as const;

/**
 * NOT APPLICABLE — administrative and staffing actions. R2.29 marked all three violating on
 * "Does not address verification of identifiers." None of them treats a patient.
 */
export const C18_NOT_APPLICABLE = ["branch[1].tradeoff[0]", "branch[1].action[0]", "branch[0].tradeoff[0]", "branch[0].action[0]"] as const;

/**
 * GENUINELY UNCERTAIN — the label alone does not settle whether the governed action occurs.
 * "Focus on caring for the second patient immediately" may or may not mean treatment.
 */
export const C18_UNCERTAIN = ["branch[1].tradeoff[1]"] as const;

/** The exact false-positive rationale family R2.29 produced. Must never establish a violation. */
export const C18_MEASURED_FALSE_POSITIVE_REASONS = [
  "Does not address verification of identifiers.",
  "Does not address verification.",
  "No verification mentioned, could skip it.",
] as const;

/** The R2.29 surfaces whose violation could not be supported. Kept so the regression stays honest. */
export const C18_R229_UNSUPPORTED_VIOLATIONS = [
  "flat_tradeoff[0]",
  "flat_tradeoff[1]",
  "branch[1].tradeoff[0]",
  "branch[1].tradeoff[1]",
  "branch[1].action[0]",
] as const;

export const C18_MEASURED_VIOLATION_EXCERPT = "this left the second patient unverified";

/** The R2.28 broad-review DTO shape, reduced to the fields that carried authority. */
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

export type OracleVerdict = { applicability: ApplicabilityResult; compliance: ComplianceResult };

/** Full human oracle over the reachable surfaces, for the coverage matrix a regression asserts. */
export const C18_HUMAN_ORACLE: Record<string, OracleVerdict> = Object.fromEntries(
  C18_REACHABLE_SURFACES.map((s) => {
    if ((C18_CLEAR_VIOLATIONS as readonly string[]).includes(s.coordinate)) return [s.coordinate, { applicability: "applies", compliance: "violates" }];
    if ((C18_NOT_APPLICABLE as readonly string[]).includes(s.coordinate)) return [s.coordinate, { applicability: "not_applicable", compliance: "not_assessed" }];
    if ((C18_UNCERTAIN as readonly string[]).includes(s.coordinate)) return [s.coordinate, { applicability: "uncertain", compliance: "not_assessed" }];
    return [s.coordinate, { applicability: "applies", compliance: "complies" }];
  }),
);
