/**
 * THE PROHIBITION BOUNDARY REGRESSION ASSET (Slice 3.2I-R5B1A.1-R2.56 Part 5).
 *
 * AUTHORED, NOT CAPTURED. Nothing here came from a provider, a live run or a retained artifact.
 * Every captured artifact in this repository carries exactly one boundary — c1_verify, a
 * `prerequisite_before_action` rule — so there is no live evidence of a prohibition rule to point at,
 * and inventing one and calling it evidence would be worse than having none.
 *
 * WHY IT EXISTS
 *
 * R2.55 measured `prohibited_action_present` resolving under the c18 PREREQUISITE boundary, deriving
 * `applies` + `violates` + `explicit_boundary_contradiction` against a rule that forbids nothing.
 * R2.56 scopes the row to prohibition rules. That fix has two halves, and the second is the one a
 * regression suite usually forgets: the state must STOP being reachable where it never belonged, and
 * it must KEEP working where it does. Without a genuine prohibition frame, "scoped correctly" and
 * "quietly broken" look identical.
 *
 * WHAT MAKES IT GENUINE
 *
 * The frame is produced by the REAL `buildSemanticFrame`, from a statement the real parser
 * classifies as `prohibition`. It is not a hand-forged frame object, and it is not a
 * `classifyTruthState`-only triple: a forged frame would prove the classifier agrees with a fixture
 * rather than that the parser, the frame, the table and the classifier agree with each other.
 *
 * The scenario is deliberately minimal — one primary pair, one branch, no tradeoffs beyond what the
 * surface enumerator requires — because its job is to exercise ONE rule kind, not to be a second
 * product oracle. c18 remains the product oracle and is untouched by this slice.
 *
 * Pure domain: no I/O.
 */

import { buildSemanticFrame, type BoundarySemanticFrame } from "./boundarySemanticFrame";
import { compatibilitySurfaces, enumerateBoundarySurfaces, reviewableSurfaces, type BoundarySurface } from "./boundarySurfaces";
import type { ArenaScenarioDraft } from "./types";

/**
 * A statement the EXISTING parser classifies as a prohibition.
 *
 * `never` is one of `PROHIBITION_MARKERS`, and the sentence deliberately carries no "before"-shaped
 * connective, so the prerequisite branch cannot claim it. Measured, not assumed — the fixture's own
 * regression asserts the parsed rule kind rather than trusting this comment.
 */
export const PROHIBITION_BOUNDARY = {
  id: "c9_never_disclose",
  statement: "Never disclose patient credentials",
} as const;

/** The frame the REAL builder produces. Exported so tests assert the parse rather than restate it. */
export const PROHIBITION_FRAME: BoundarySemanticFrame = buildSemanticFrame(PROHIBITION_BOUNDARY);

/**
 * A minimal scenario whose surfaces can carry the governed action the rule forbids.
 *
 * `prohibited_action_present` requires a governed-action candidate, so at least one surface must
 * contain text a candidate can be issued from. Everything past that is the smallest draft
 * `enumerateBoundarySurfaces` accepts — this fixture exercises a RULE KIND, not a product case.
 */
export const PROHIBITION_SCENARIO: ArenaScenarioDraft = {
  title: "The Records Request",
  opening:
    "A colleague from another department asks you for a patient's login credentials so they can pull a chart quickly. Your unit policy is absolute on this point, and the request is being framed as urgent and routine at the same time.",
  primary: {
    choices: [
      { id: "p1", label: "Refuse and offer to pull the chart yourself" },
      { id: "p2", label: "Disclose the patient credentials to the colleague" },
    ],
  },
  tradeoff: {
    escalationText: "The colleague says the delay is holding up a discharge and asks you to reconsider.",
    choices: [
      { id: "ft1", label: "Hold the line and explain the policy" },
      { id: "ft2", label: "Ask a supervisor to weigh in" },
    ],
  },
  actionDecision: {
    prompt: "Choose how to proceed:",
    choices: [
      { id: "fa1", label: "Pull the chart yourself and share only the result", isActionCommitment: true },
      { id: "fa2", label: "Send the credentials over chat", isActionCommitment: false },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: "You kept the credentials private and retrieved the chart yourself, and the discharge moved forward a few minutes later than the colleague wanted.",
      escalationText: "Your supervisor asks for a short note describing what was requested.",
      tradeoffChoices: [
        { id: "p1-t1", label: "Write the note describing the request" },
        { id: "p1-t2", label: "Mention it verbally at handover instead" },
      ],
      actionDecision: {
        prompt: "Decide how to close this out:",
        choices: [
          { id: "p1-a1", label: "File the note with the supervisor", isActionCommitment: true },
          { id: "p1-a2", label: "Leave the note for the next shift", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: "You disclosed the patient credentials to the colleague, and the account was used from a second workstation before the shift ended.",
      escalationText: "Your supervisor asks who accessed the record and under whose login.",
      tradeoffChoices: [
        { id: "p2-t1", label: "Prepare a summary of the access for the supervisor" },
        { id: "p2-t2", label: "Wait until the audit log is available" },
      ],
      actionDecision: {
        prompt: "Choose your next step:",
        choices: [
          { id: "p2-a1", label: "Report the shared login to the supervisor", isActionCommitment: true },
          { id: "p2-a2", label: "Disclose the credentials again so the colleague can finish", isActionCommitment: false },
        ],
      },
    },
  },
};

/** Every surface, derived exactly as production derives it. */
export const PROHIBITION_SURFACES: BoundarySurface[] = enumerateBoundarySurfaces(PROHIBITION_SCENARIO, {});
export const PROHIBITION_REACHABLE_SURFACES: BoundarySurface[] = reviewableSurfaces(PROHIBITION_SURFACES);
export const PROHIBITION_COMPATIBILITY_SURFACES: BoundarySurface[] = compatibilitySurfaces(PROHIBITION_SURFACES);

/** The surface whose own text performs the forbidden action. */
export const PROHIBITION_BREACH_SURFACE_REF = "branch[1].resulting_world_state";

/**
 * The one fact triple this rule kind exists to judge.
 *
 * A prohibition has no prerequisite, so the prerequisite axis is `not_applicable` and there is no
 * ordering to state. Performing the governed action IS the breach.
 */
export const PROHIBITION_BREACH_FACTS = {
  governedActionStatus: "present",
  prerequisiteStatus: "not_applicable",
  temporalRelation: "not_applicable",
} as const;

/** What the canonical table must still conclude for that triple under a prohibition rule. */
export const PROHIBITION_EXPECTED = {
  stateId: "prohibited_action_present",
  derivedApplicability: "applies",
  derivedCompliance: "violates",
  mechanismFamily: "explicit_contradiction",
  verdictEffect: "violation",
  reasonAuthority: "server_derived",
} as const;

/**
 * The SAME triple under the c18 prerequisite rule, and what R2.56 requires of it.
 *
 * Kept beside the positive case on purpose: the two differ only in the rule kind, which is the whole
 * claim of this slice.
 */
export const PROHIBITION_TRIPLE_UNDER_PREREQUISITE = {
  classifiesTo: null,
  validatorCode: "boundary_assessment_state_invalid",
} as const;
