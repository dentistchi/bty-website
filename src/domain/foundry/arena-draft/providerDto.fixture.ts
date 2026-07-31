/**
 * TEST FIXTURE ONLY (Slice 3.2I-R5B1A.1-R2.16) — never imported by product code.
 *
 * Converts a canonical `ArenaScenarioDraft` fixture into the PROVIDER wire shape, so existing
 * tests keep expressing intent in the canonical vocabulary while exercising the real provider
 * contract. It is the inverse of `canonicalizeProviderScenario` for the fields the model authors:
 * it DROPS every id (the server assigns those) and turns the `branches` map into a positional
 * array ordered by the draft's own primary-choice order.
 */

import type { ArenaScenarioDraft } from "./types";
import type { ConstraintAssessment } from "./boundary";
import type { ProviderActionDecision, ProviderChoice, ProviderPracticeScenario } from "./providerDto";

type AssessmentsByChoiceId = Record<string, ConstraintAssessment[]>;

const choiceOf = (c: { id: string; label: string }, a?: AssessmentsByChoiceId): ProviderChoice => ({
  label: c.label,
  constraintAssessments: a?.[c.id] ?? [],
});

const actionOf = (
  d: { prompt: string; choices: Array<{ id: string; label: string; isActionCommitment: boolean }> },
  a?: AssessmentsByChoiceId,
): ProviderActionDecision => ({
  prompt: d.prompt,
  choices: d.choices.map((c) => ({ label: c.label, isActionCommitment: c.isActionCommitment, constraintAssessments: a?.[c.id] ?? [] })),
});

/**
 * @param draft canonical fixture
 * @param assessmentsByChoiceId optional canonical-id-keyed assessments to inline onto each choice
 */
export function toProviderDto(draft: ArenaScenarioDraft, assessmentsByChoiceId?: AssessmentsByChoiceId): ProviderPracticeScenario {
  const primaryIds = draft.primary.choices.map((c) => c.id);
  const branches = draft.branches ?? {};
  return {
    noSafeJudgmentSpace: false,
    title: draft.title,
    opening: draft.opening,
    primaryChoices: draft.primary.choices.map((c) => choiceOf(c, assessmentsByChoiceId)),
    flatEscalationText: draft.tradeoff.escalationText,
    flatTradeoffChoices: draft.tradeoff.choices.map((c) => choiceOf(c, assessmentsByChoiceId)),
    flatActionDecision: actionOf(draft.actionDecision, assessmentsByChoiceId),
    // Positional: branch i is the continuation of primary choice i, in the draft's own order.
    // A primary with no branch simply yields no entry — the resulting count mismatch is the
    // correct rejection for a flat draft, and is what the flat-draft test asserts.
    branches: primaryIds.flatMap((pid) => {
      const b = branches[pid];
      if (!b) return [];
      return [{
        resultingWorldState: b.resultingWorldState ?? "",
        escalationText: b.escalationText,
        tradeoffChoices: b.tradeoffChoices.map((c) => choiceOf(c, assessmentsByChoiceId)),
        actionDecision: actionOf(b.actionDecision, assessmentsByChoiceId),
      }];
    }),
  };
}

/** Convenience: the provider wire STRING for a canonical fixture. */
export const providerJson = (draft: ArenaScenarioDraft, a?: AssessmentsByChoiceId): string =>
  JSON.stringify(toProviderDto(draft, a));

// ---------------------------------------------------------------------------
// Semantic review fixtures (R2.18). The reviewer now runs for EVERY generation, so any test that
// expects a successful generation must also supply a review that ACCEPTS.
// ---------------------------------------------------------------------------

import type { SemanticReview } from "./semanticReview";

/** A consistent ACCEPT review sized to the draft it reviews. */
export function acceptReview(draft: ArenaScenarioDraft, over: Partial<SemanticReview> = {}): SemanticReview {
  const branchKeys = Object.keys(draft.branches ?? {});
  return {
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
      nextDecisionDimension: i === 0 ? "escalation order" : "scope of disclosure",
      repeatsPrimaryDecision: false,
      overlapsOtherBranchIndex: -1,
      overlapReason: "",
      branchDistinct: true,
      defectCodes: [],
    })),
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
