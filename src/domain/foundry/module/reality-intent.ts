import { normalizeLearningNeeds, type BuilderAnswers } from "./module-builder";
import type { RealityGroundedJourneyV1 } from "./journey";
import { journeyActionDecision, journeyFieldApplication } from "./journey";

/**
 * REALITY INTENT READINESS — does this training deliver what its Host asked for? (Slice R4-R7A)
 *
 * THE DEFECT THIS EXISTS FOR, measured on production. Publish validated completeness only inside
 * `if (journeyEnabled)`, and `journeyEnabled` is `journey !== undefined`. So a draft with NO
 * journey skipped every check — while its Host had already declared, in their own Builder
 * answers, that they wanted a follow-up. Live: 30 of 32 module-bearing trainings set
 * `followUpDays > 0` and only 4 carry a grounded `field_application`. Twenty-six ask BTY to check
 * back on something that was never defined, and nobody was told.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does NOT require a Journey. A Journey is an internal artifact; the Host never types the
 * word. It asks a product question instead — *did the Host ask for behaviour, and can this
 * training deliver it?* — so a training whose intent is `know` or `shared_standard` is complete
 * with no Journey at all, exactly as today. Adoption is not the goal; truth is.
 *
 * IT READS THE HOST'S OWN INTENT, and only the two capabilities that intent can demand:
 *   followUpDays > 0        → a real-work action must exist to follow up ON  (`field_application`)
 *   learningNeeds ∋ decide  → the decision the learner makes must be defined (`action_decision`)
 *
 * The always-required kinds (`why_it_matters`, `observable_standard`, `completion_check`) are
 * deliberately NOT checked here. `missingProgramKinds` already owns them for journey-bearing
 * drafts, and demanding them of a no-journey draft would block the 24 legitimate
 * knowledge-oriented trainings this rule exists to protect.
 *
 * Pure: no I/O, no UI strings. Callers translate these facts into their own language, so Review
 * and Publish can never drift into two different definitions of "ready".
 */

export type RealityIntentGap = "field_action" | "decision";

export type RealityIntentReadiness = {
  /** The Host scheduled a follow-up (`followUpDays > 0`). */
  readonly followUpRequested: boolean;
  /** The Host declared `decide` among the learning needs. */
  readonly decisionRequested: boolean;
  /** A grounded real-work action exists for the learner to try. */
  readonly fieldActionReady: boolean;
  /** A grounded decision the learner is asked to make exists. */
  readonly decisionReady: boolean;
  /** Requested-but-absent capabilities, in a stable order. Empty ⇒ nothing to disclose. */
  readonly missing: readonly RealityIntentGap[];
};

function followUpRequestedFrom(answers: BuilderAnswers | undefined): boolean {
  const d = answers?.followUpDays;
  return typeof d === "number" && d > 0;
}

/**
 * @param answers the draft's Builder answers — the Host's declared intent.
 * @param journey the draft's journey, or undefined. Undefined is a legitimate state, not a fault.
 */
export function classifyRealityIntentReadiness(
  answers: BuilderAnswers | undefined,
  journey: RealityGroundedJourneyV1 | undefined,
): RealityIntentReadiness {
  const followUpRequested = followUpRequestedFrom(answers);
  const decisionRequested = normalizeLearningNeeds(answers).includes("decide");

  // Grounded-only, via the same readers the learner-facing projection and the apply-window
  // materializer already use. A `needs_confirmation` element is not a capability.
  const fieldActionReady = journeyFieldApplication(journey) !== null;
  const decisionReady = journeyActionDecision(journey) !== null;

  const missing: RealityIntentGap[] = [];
  if (followUpRequested && !fieldActionReady) missing.push("field_action");
  if (decisionRequested && !decisionReady) missing.push("decision");

  return { followUpRequested, decisionRequested, fieldActionReady, decisionReady, missing };
}

/** True when the Host asked for a behaviour capability this draft cannot yet deliver. */
export function hasRealityIntentGap(r: RealityIntentReadiness): boolean {
  return r.missing.length > 0;
}
