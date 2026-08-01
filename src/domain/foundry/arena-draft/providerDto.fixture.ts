/**
 * TEST FIXTURE ONLY (Slice 3.2I-R5B1A.1-R2.16) — never imported by product code.
 *
 * Converts a canonical `ArenaScenarioDraft` fixture into the PROVIDER wire shape, so existing
 * tests keep expressing intent in the canonical vocabulary while exercising the real provider
 * contract. It is the inverse of `canonicalizeProviderScenario` for the fields the model authors:
 * it DROPS every id (the server assigns those) and turns the `branches` map into a positional
 * array ordered by the draft's own primary-choice order.
 */

import { enumerateBoundarySurfaces, reviewableSurfaces } from "./boundarySurfaces";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildAllEvidenceCandidates, poolFor } from "./boundaryEvidenceCandidates";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import type { ArenaScenarioDraft } from "./types";
import type { ConstraintAssessment } from "./boundary";
import type { ProviderActionDecision, ProviderChoice, ProviderPracticeScenario } from "./providerDto";
import type { ProviderBoundaryGrounding } from "./boundaryGrounding";
import type { ProviderChoiceConstruction } from "./choiceConstruction";

type AssessmentsByChoiceId = Record<string, ConstraintAssessment[]>;

/**
 * R2.22 — a VALID, sibling-distinct construction record. Every provider choice now carries one, so
 * canonical fixtures need a default that clears the deterministic construction gate without
 * asserting anything about the scenario: the value/cost/intent tuple varies by position so siblings
 * never share a profile, and a safety basis is always stated so a delay-shaped label is supported.
 *
 * Tests that exercise a construction DEFECT override the field they are testing.
 */
const VALUES = ["operational continuity", "accuracy of the record", "the client relationship", "team capacity"];
const COSTS = [
  "the queue lengthens behind you",
  "the decision takes longer to reach",
  "another commitment slips this week",
  "you carry the exposure personally",
];
export function constructionFor(label: string, i: number, boundaryIds: string[] = []): ProviderChoiceConstruction {
  return {
    legitimateValue: VALUES[i % VALUES.length],
    acceptedCost: COSTS[i % COSTS.length],
    competentIntent: `a capable lead could protect ${VALUES[i % VALUES.length]} here, option ${i + 1}`,
    concreteAction: label,
    boundaryCompliance: boundaryIds,
    urgencySafetyBasis: "no urgent care is delayed; any pause is bounded and stated",
    whyNotDominated: `it gives up ${COSTS[i % COSTS.length]} that the alternative keeps`,
    distinguishesFromSibling: `different value and cost profile from option ${((i + 1) % 2) + 1}`,
  };
}

// R2.23C — provider choices no longer carry constraintAssessments. The `a` parameter is retained
// so existing call sites keep compiling; it is deliberately unused.
const choiceOf = (c: { id: string; label: string }, i: number, _a?: AssessmentsByChoiceId, b: string[] = []): ProviderChoice => ({
  label: c.label,
  construction: constructionFor(c.label, i, b),
});

const actionOf = (
  d: { prompt: string; choices: Array<{ id: string; label: string; isActionCommitment: boolean }> },
  _a?: AssessmentsByChoiceId,
  b: string[] = [],
): ProviderActionDecision => ({
  prompt: d.prompt,
  choices: d.choices.map((c, i) => ({
    label: c.label,
    isActionCommitment: c.isActionCommitment,
    construction: constructionFor(c.label, i, b),
  })),
});

/**
 * @param draft canonical fixture
 * @param assessmentsByChoiceId optional canonical-id-keyed assessments to inline onto each choice
 * @param boundaryGrounding optional R2.21 grounding declarations (empty for unconstrained fixtures)
 */
export function toProviderDto(
  draft: ArenaScenarioDraft,
  assessmentsByChoiceId?: AssessmentsByChoiceId,
  boundaryGrounding: ProviderBoundaryGrounding[] = [],
): ProviderPracticeScenario {
  const boundaryIds = boundaryGrounding.map((g) => g.boundaryId);
  const primaryIds = draft.primary.choices.map((c) => c.id);
  const branches = draft.branches ?? {};
  return {
    boundaryGrounding,
    noSafeJudgmentSpace: false,
    title: draft.title,
    opening: draft.opening,
    primaryChoices: draft.primary.choices.map((c, i) => choiceOf(c, i, assessmentsByChoiceId, boundaryIds)),
    flatEscalationText: draft.tradeoff.escalationText,
    flatTradeoffChoices: draft.tradeoff.choices.map((c, i) => choiceOf(c, i, assessmentsByChoiceId, boundaryIds)),
    flatActionDecision: actionOf(draft.actionDecision, assessmentsByChoiceId, boundaryIds),
    // Positional: branch i is the continuation of primary choice i, in the draft's own order.
    // A primary with no branch simply yields no entry — the resulting count mismatch is the
    // correct rejection for a flat draft, and is what the flat-draft test asserts.
    branches: primaryIds.flatMap((pid) => {
      const b = branches[pid];
      if (!b) return [];
      return [{
        resultingWorldState: b.resultingWorldState ?? "",
        escalationText: b.escalationText,
        tradeoffChoices: b.tradeoffChoices.map((c, i) => choiceOf(c, i, assessmentsByChoiceId, boundaryIds)),
        actionDecision: actionOf(b.actionDecision, assessmentsByChoiceId, boundaryIds),
      }];
    }),
  };
}

/** Convenience: the provider wire STRING for a canonical fixture. */
export const providerJson = (draft: ArenaScenarioDraft, a?: AssessmentsByChoiceId, g: ProviderBoundaryGrounding[] = []): string =>
  JSON.stringify(toProviderDto(draft, a, g));

// ---------------------------------------------------------------------------
// Semantic review fixtures (R2.18). The reviewer now runs for EVERY generation, so any test that
// expects a successful generation must also supply a review that ACCEPTS.
// ---------------------------------------------------------------------------

import type { SemanticReview } from "./semanticReview";
import { enumerateChoices } from "./choiceConstruction";

/**
 * A consistent ACCEPT review sized to the draft it reviews.
 *
 * R2.21: the reviewer now returns one boundary assessment per CONFIRMED constraint plus a urgency
 * block sized to the primary choices. `constraintIds` defaults to none — pass it for a constrained
 * fixture, or the count gate rejects the review.
 */
export function acceptReview(draft: ArenaScenarioDraft, over: Partial<SemanticReview> = {}, constraintIds: string[] = []): SemanticReview {
  const branchKeys = Object.keys(draft.branches ?? {});
  return {
    boundaryAssessments: constraintIds.map((boundaryId) => ({
      boundaryId,
      presentInScenario: true,
      operationalized: true,
      affectedStages: ["opening", "primary", "branch_tradeoff"],
      allPrimaryChoicesComply: true,
      allBranchesPreserve: true,
      allTradeoffChoicesComply: true,
      allActionChoicesComply: true,
      prohibitedAlternativeExcluded: true,
      remainingJudgmentDimensions: ["sequencing", "escalation order"],
      violatedChoiceReferences: [],
      violatedBranchReferences: [],
      defectCodes: [],
      conciseExplanation: "The rule is established up front and every option stays inside it.",
    })),
    urgency: {
      urgencyPresent: false,
      urgencySource: "",
      timeSensitiveHarmPossible: false,
      choices: draft.primary.choices.map((_, index) => ({
        index,
        introducesDelay: false,
        delayPurpose: "",
        safetyBasis: "",
        foreseeableHarm: "",
        escalationUsed: false,
        defensible: true,
        defectCodes: [],
      })),
      overallUrgencyVerdict: "not_applicable",
    },
    noSafeJudgmentSpace: false,
    noSafeReasonCode: "judgment_space_remains",
    boundaryIdsConsidered: [],
    remainingJudgmentDimensions: ["sequencing", "communication timing"],
    violatedBoundaryIds: [],
    explanation: "Legitimate judgment remains inside the confirmed boundary.",
    primaryChoices: draft.primary.choices.map((_, i) => ({
      index: i,
      legitimateValue: i === 0 ? "transparency" : "certainty",
      acceptedCost: i === 0 ? "slows the schedule" : "delays the disclosure",
      defensible: true,
      defectCodes: [],
    })),
    twoValuesInTension: true,
    tensionValueA: "transparency",
    tensionValueB: "certainty",
    branches: branchKeys.map((_, i) => ({
      index: i,
      selectedPrimarySummary: `primary ${i + 1} already chosen`,
      resultingWorldState: `world after primary ${i + 1}`,
      newConstraintOrPressure: `new pressure ${i + 1}`,
      nextDecisionDimension: i === 0 ? "escalation order" : "staffing coverage",
      repeatsPrimaryDecision: false,
      overlapsOtherBranchIndex: -1,
      overlapReason: "",
      branchDistinct: true,
      defectCodes: [],
      // R2.22 — progression + causal identity. Distinct axes per branch, and a different dimension
      // at the action phase than at the tradeoff phase, so the branch actually advances.
      primaryDecisionPreserved: true,
      tradeoffDecisionDimension: i === 0 ? "escalation order" : "staffing coverage",
      actionDecisionDimension: i === 0 ? "who owns the recovery" : "what scope is committed",
      tradeoffAdvancesScenario: true,
      actionAdvancesScenario: true,
      repeatedMeaningPairs: [],
      progressionValid: true,
      selectedPrimaryEffect: `primary ${i + 1} changed who is available`,
      affectedStakeholders: [i === 0 ? "the director" : "the wider team"],
      resourceOrRelationshipChange: `resource state ${i + 1}`,
      causalLink: `this follows directly from primary ${i + 1}`,
      boundaryState: "unchanged and still in force",
      urgencyState: "no time-sensitive harm introduced",
    })),
    // Every visible choice, every phase, reviewed exactly once.
    phaseChoices: enumerateChoices(draft).map((c, n) => ({
      phase: c.phase,
      branchIndex: c.branchIndex,
      choiceIndex: c.index,
      legitimateValue: n % 2 === 0 ? "speed" : "certainty",
      acceptedCost: n % 2 === 0 ? "less verification" : "more elapsed time",
      competentIntent: "a capable lead could reasonably choose this",
      actionable: true,
      defensible: true,
      dominatedBySibling: false,
      badFaith: false,
      vagueReassurance: false,
      nonCommitmentDecoy: false,
      unsafe: false,
      constructionAgrees: true,
      constructionDispute: "",
      defectCodes: [],
      conciseExplanation: "Names a concrete action with a real cost.",
    })),
    crossBranch: {
      resultingWorldOverlapPairs: [],
      nextDecisionAxisOverlapPairs: [],
      stakeholderOverlapPairs: [],
      repeatedActionMeaningPairs: [],
      branchesInterchangeable: false,
      allBranchesSameGenericAxis: false,
      defectCodes: [],
      conciseExplanation: "Each branch follows from its own primary choice.",
    },
    boundaryCompliant: true,
    overallVerdict: "accept",
    defectCodes: [],
    retryInstruction: "",
    ...over,
  };
}

/** True when this request is the semantic-review call rather than the generation call. */
export const isReviewRequest = (params: { messages?: Array<{ content?: string }> }): boolean =>
  (params.messages ?? []).some((m) => typeof m.content === "string" && m.content.includes("You are a strict REVIEWER"));

/**
 * R2.29 — the NARROW boundary review runs BEFORE the broad semantic review for every
 * boundary-bearing scenario. A test double that answers only the generation and broad-review calls
 * would now stall the pipeline at the narrow stage, so routing must recognise all three.
 */
export const isBoundaryReviewRequest = (params: { messages?: Array<{ content?: string }> }): boolean =>
  (params.messages ?? []).some((m) => typeof m.content === "string" && m.content.includes("CONFIRMED-BOUNDARY TRUTH REPORTER"));

/**
 * Build an all-complies narrow response DERIVED FROM THE REQUEST, so it satisfies exact Cartesian
 * coverage and same-surface evidence grounding for whatever scenario the test happens to use.
 *
 * It is a transport double, not an oracle: a test that wants a violation states one explicitly.
 */
export function compliantBoundaryReview(params: { messages?: Array<{ content?: string }> }): string {
  const user = (params.messages ?? []).find((m) => typeof m.content === "string" && m.content.includes("\"surfaces\""));
  const req = JSON.parse(user?.content ?? "{}") as {
    constraints?: Array<{ id: string }>;
    surfaces?: Array<{ surfaceRef: string; text: string }>;
    evidenceCandidates?: Array<{
      boundaryId: string;
      surfaces: Array<{ surfaceRef: string; governedActionCandidates: Array<{ candidateId: string }> }>;
    }>;
  };
  // R2.38 — the double SELECTS a server-issued candidate id, exactly as a real response must. A
  // double that authored its own excerpt would pass a check no live answer could, which is how the
  // R2.36 defects stayed invisible to CI. `absent` + `not_applicable` is the cheapest settled truth.
  const actionId = (boundaryId: string, surfaceRef: string) =>
    (req.evidenceCandidates ?? []).find((e) => e.boundaryId === boundaryId)?.surfaces.find((s) => s.surfaceRef === surfaceRef)
      ?.governedActionCandidates[0]?.candidateId ?? "none";
  const assessments = (req.constraints ?? []).flatMap((b) =>
    (req.surfaces ?? []).map((s) => ({
      boundaryId: b.id,
      surfaceRef: s.surfaceRef,
      governedActionStatus: "absent",
      prerequisiteStatus: "not_applicable",
      temporalRelation: "not_applicable",
      governedActionCandidateId: actionId(b.id, s.surfaceRef),
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })),
  );
  return JSON.stringify({ assessments });
}

/**
 * The same all-complies narrow response, built from a DRAFT rather than a captured request — for
 * tests that queue ordered responses with `mockResolvedValueOnce` and so never see the request.
 */
export function compliantBoundaryReviewFor(draft: ArenaScenarioDraft, constraintIds: string[]): string {
  // Only the REACHABLE surfaces are ever handed to the reviewer (R2.30).
  const surfaces = reviewableSurfaces(enumerateBoundarySurfaces(draft, {}));
  // The same candidate ids the server will issue, derived the same way.
  const segments = buildContextSegments(draft, surfaces);
  const boundaries = constraintIds.map((id) => ({ id, statement: "Two identifiers must be verified before treatment" }));
  const { candidates } = buildAllEvidenceCandidates(boundaries, buildSemanticFrames(boundaries), surfaces, segments);
  return JSON.stringify({
    assessments: constraintIds.flatMap((boundaryId) =>
      surfaces.map((s) => ({
        boundaryId,
        surfaceRef: s.coordinate,
        governedActionStatus: "absent",
        prerequisiteStatus: "not_applicable",
        temporalRelation: "not_applicable",
        governedActionCandidateId: poolFor(candidates, boundaryId, s.coordinate, "governed_action")[0]?.candidateId ?? "none",
        prerequisiteSatisfactionCandidateId: "none",
        prerequisiteFailureCandidateId: "none",
        reason: "",
      })),
    ),
  });
}
