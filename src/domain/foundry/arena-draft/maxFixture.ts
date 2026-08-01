/**
 * MAXIMUM-CARDINALITY CONTRACT FIXTURES (Slice 3.2I-R5B1A.1-R2.23).
 *
 * WHY
 *
 * The provider schema grew materially in R2.21 (boundary grounding) and R2.22 (a construction
 * record on every choice). The generation budget has been 4,000 tokens since R2.15, when the schema
 * was much smaller. R2.15 already measured what happens when a ceiling sits below a schema's worst
 * case: the body truncates mid-object, `JSON.parse` fails, and the outcome is reported as
 * `malformed_shape` — a real content contract failure misread as bad authoring.
 *
 * So the budget is measured, not assumed. These builders construct the LARGEST response the current
 * product contract can legitimately produce — every array at its maximum, every string at its
 * maximum length, every optional field present — deterministically, so the fixture digest is stable
 * and a schema change moves it.
 *
 * Nothing here is ever sent to a provider or shown to a learner. It exists to size a budget.
 *
 * Pure domain: no I/O, no randomness, no clock.
 */

import {
  GENERATED_ACTION_CHOICES,
  GENERATED_PRIMARY_CHOICES,
  GENERATED_TRADEOFF_CHOICES,
  GEN_ACTION_PROMPT_MAX,
  GEN_ACTION_TEXT_MAX,
  GEN_CHOICE_LABEL_MAX,
  GEN_COST_MAX,
  GEN_DIMENSIONS_MAX_ITEMS,
  GEN_DIMENSION_MAX,
  GEN_ESCALATION_MAX,
  GEN_GROUNDING_STATEMENT_MAX,
  GEN_GROUNDING_TEXT_MAX,
  GEN_INTENT_MAX,
  GEN_OPENING_MAX,
  GEN_RATIONALE_MAX,
  GEN_SHORT_REASON_MAX,
  GEN_TITLE_MAX,
  GEN_REVIEW_TEXT_MAX,
  GEN_VALUE_MAX,
} from "./types";
import { CONSTRAINTS_MAX } from "./boundary";
import { MAX_ACTIVE_BOUNDARIES } from "./boundaryScope";
import type { ProviderPracticeScenario } from "./providerDto";
import type { ProviderBoundaryGrounding } from "./boundaryGrounding";
import type { ProviderChoiceConstruction } from "./choiceConstruction";
import type { SemanticReview } from "./semanticReview";
import {
  NARROW_REASON_MAX,
  type NarrowBoundaryReview,
} from "./narrowBoundaryReview";
import { CANDIDATE_ID_MAX } from "./boundaryEvidenceCandidates";
import { BRANCH_AWARE_REACHABLE_SURFACE_COUNT } from "./boundarySurfaces";

/**
 * Two profiles, because they answer different questions.
 *
 * `schema` — every string at its VALIDATOR maximum (400-char labels, 1200-char openings, 10
 * confirmed boundaries assessed on all 34 choices). This is the outer bound the schema PERMITS. It
 * is not a budget target: it exceeds the output cap of the configured model class entirely, which is
 * precisely why truncation detection is a required part of the contract rather than an optimisation.
 *
 * `realistic` — maximum product CARDINALITY (4 primary choices, 4 branches, every choice array
 * full, boundaries at the corpus maximum) with string lengths taken from measured live output. This
 * is what the token budget must actually cover.
 */
export type FixtureProfile = "schema" | "realistic";

/**
 * The shape being measured. `primary` drives the branch count (branch i continues primary i).
 * Defaults are the schema maxima; the runner measures its own operating cardinality.
 */
export type Cardinality = { primary?: number; tradeoff?: number; action?: number; boundaries?: number };

/**
 * Korean expresses the same content in roughly 60% of the characters of English. A fixture that
 * used identical CHARACTER counts for both would not be a Korean version of the same scenario — it
 * would be a 1.7x longer one, and would overstate the Korean budget accordingly. The comparison
 * that matters is content-equivalent, so Korean content strings are scaled and the token cost per
 * character (far higher for Hangul) does the rest.
 */
const KO_CONTENT_RATIO = 0.6;

type Sizes = {
  title: number; opening: number; escalation: number; prompt: number; label: number;
  value: number; cost: number; intent: number; action: number; safety: number; notDominated: number; distinguishes: number;
  rationale: number; boundaries: number;
  gStatement: number; gPresence: number; gEffect: number; gProhibited: number; gRemaining: number; gRemainingCount: number;
};

const SIZES: Record<FixtureProfile, Sizes> = {
  // R2.23A — the `schema` profile is now the GENERATION schema's permitted maximum: every string at
  // its bounded limit, every array at its exact/maximum count. It is finite by construction.
  schema: {
    title: GEN_TITLE_MAX, opening: GEN_OPENING_MAX, escalation: GEN_ESCALATION_MAX, prompt: GEN_ACTION_PROMPT_MAX, label: GEN_CHOICE_LABEL_MAX,
    value: GEN_VALUE_MAX, cost: GEN_COST_MAX, intent: GEN_INTENT_MAX, action: GEN_ACTION_TEXT_MAX,
    safety: GEN_SHORT_REASON_MAX, notDominated: GEN_SHORT_REASON_MAX, distinguishes: GEN_SHORT_REASON_MAX,
    rationale: GEN_RATIONALE_MAX, boundaries: MAX_ACTIVE_BOUNDARIES,
    gStatement: GEN_GROUNDING_STATEMENT_MAX, gPresence: GEN_GROUNDING_TEXT_MAX, gEffect: GEN_GROUNDING_TEXT_MAX,
    gProhibited: GEN_SHORT_REASON_MAX, gRemaining: GEN_DIMENSION_MAX, gRemainingCount: GEN_DIMENSIONS_MAX_ITEMS,
  },
  // Measured from the R2.19 canary artifacts: labels ran 60-110 chars, openings ~350, escalations
  // ~150, prompts ~45. Every number below is generous against those observations.
  realistic: {
    title: 60, opening: 500, escalation: 250, prompt: 80, label: 140,
    value: 40, cost: 90, intent: 110, action: 90, safety: 90, notDominated: 90, distinguishes: 90,
    rationale: 90, boundaries: 3,
    gStatement: 120, gPresence: 140, gEffect: 140, gProhibited: 120, gRemaining: 40, gRemainingCount: 3,
  },
};

/** Total user-facing choices at maximum cardinality: 4 primary + 3 + 3 flat + 4 branches x 6. */
export const MAX_VISIBLE_CHOICES = GENERATED_PRIMARY_CHOICES + GENERATED_TRADEOFF_CHOICES + GENERATED_ACTION_CHOICES + GENERATED_PRIMARY_CHOICES * (GENERATED_TRADEOFF_CHOICES + GENERATED_ACTION_CHOICES);

/**
 * Deterministic filler of an exact length. Latin text stands in for a realistic English scenario;
 * `hangul` produces Korean, whose token cost per character is far higher — the expansion risk the
 * budget has to survive.
 */
export function filler(length: number, seed: string, hangul = false): string {
  const alphabet = hangul ? "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허" : "abcdefghijklmnopqrstuvwxyz";
  if (hangul) length = Math.max(4, Math.round(length * KO_CONTENT_RATIO));
  let out = "";
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  while (out.length < length) {
    n = (n * 1103515245 + 12345) % 2147483648;
    out += alphabet[n % alphabet.length];
    if (out.length % 9 === 0 && out.length < length) out += " ";
  }
  return out.slice(0, length);
}

const construction = (seed: string, boundaryIds: string[], hangul: boolean, z: Sizes): ProviderChoiceConstruction => ({
  legitimateValue: filler(z.value, `${seed}v`, hangul),
  acceptedCost: filler(z.cost, `${seed}c`, hangul),
  competentIntent: filler(z.intent, `${seed}i`, hangul),
  concreteAction: filler(z.action, `${seed}a`, hangul),
  boundaryCompliance: boundaryIds,
  urgencySafetyBasis: filler(z.safety, `${seed}u`, hangul),
  whyNotDominated: filler(z.notDominated, `${seed}d`, hangul),
  distinguishesFromSibling: filler(z.distinguishes, `${seed}s`, hangul),
});

const choice = (seed: string, boundaryIds: string[], hangul: boolean, z: Sizes) => ({
  label: filler(z.label, `${seed}l`, hangul),
  construction: construction(seed, boundaryIds, hangul, z),
});

const actionChoice = (seed: string, boundaryIds: string[], hangul: boolean, z: Sizes, commit: boolean) => ({
  ...choice(seed, boundaryIds, hangul, z),
  isActionCommitment: commit,
});

const actionDecision = (seed: string, boundaryIds: string[], hangul: boolean, z: Sizes, n: number = GENERATED_ACTION_CHOICES) => ({
  prompt: filler(z.prompt, `${seed}p`, hangul),
  choices: Array.from({ length: n }, (_, i) => actionChoice(`${seed}a${i}`, boundaryIds, hangul, z, i === 0)),
});

export const maxBoundaryIds = (n: number = MAX_ACTIVE_BOUNDARIES): string[] => Array.from({ length: n }, (_, i) => `c${i + 1}_boundary_rule_identifier`);

const grounding = (ids: string[], hangul: boolean, z: Sizes): ProviderBoundaryGrounding[] =>
  ids.map((id, i) => ({
    boundaryId: id,
    boundaryStatement: filler(z.gStatement, `${id}s`, hangul),
    scenarioPresence: filler(z.gPresence, `${id}p`, hangul),
    operationalEffect: filler(z.gEffect, `${id}e`, hangul),
    affectedDecisionStages: ["opening", "primary", "flat_tradeoff", "flat_action", "branch_tradeoff", "branch_action"],
    prohibitedAlternativeExcluded: filler(z.gProhibited, `${id}x`, hangul),
    remainingJudgmentDimensions: Array.from({ length: z.gRemainingCount }, (_, j) => filler(z.gRemaining, `${id}r${i}${j}`, hangul)),
  }));

/**
 * The largest provider response the current contract permits: 4 primary choices, 4 branches, every
 * choice array full, every string at its maximum, 10 confirmed boundaries assessed on all 34
 * choices, and a grounding record per boundary.
 */
export function buildMaxProviderScenario(hangul = false, profile: FixtureProfile = "schema", card: Cardinality = {}): ProviderPracticeScenario {
  const z = SIZES[profile];
  const primaryCount = card.primary ?? GENERATED_PRIMARY_CHOICES;
  const tradeoffCount = card.tradeoff ?? GENERATED_TRADEOFF_CHOICES;
  const actionCount = card.action ?? GENERATED_ACTION_CHOICES;
  const ids = maxBoundaryIds(card.boundaries ?? z.boundaries);
  return {
    noSafeJudgmentSpace: false,
    title: filler(z.title, "title", hangul),
    opening: filler(z.opening, "opening", hangul),
    primaryChoices: Array.from({ length: primaryCount }, (_, i) => choice(`p${i}`, ids, hangul, z)),
    flatEscalationText: filler(z.escalation, "flatesc", hangul),
    flatTradeoffChoices: Array.from({ length: tradeoffCount }, (_, i) => choice(`ft${i}`, ids, hangul, z)),
    flatActionDecision: actionDecision("fa", ids, hangul, z, actionCount),
    branches: Array.from({ length: primaryCount }, (_, b) => ({
      resultingWorldState: filler(z.escalation, `bw${b}`, hangul),
      escalationText: filler(z.escalation, `be${b}`, hangul),
      tradeoffChoices: Array.from({ length: tradeoffCount }, (_, i) => choice(`b${b}t${i}`, ids, hangul, z)),
      actionDecision: actionDecision(`b${b}`, ids, hangul, z, actionCount),
    })),
    boundaryGrounding: grounding(ids, hangul, z),
  };
}

/** The smallest structurally valid provider response, for the lower bound of the same measurement. */
export function buildMinProviderScenario(): ProviderPracticeScenario {
  const c = { label: "Stop the line now", construction: {
    legitimateValue: "safety", acceptedCost: "the schedule slips", competentIntent: "a lead protects the line",
    concreteAction: "stops the line", boundaryCompliance: [], urgencySafetyBasis: "no urgent care is delayed",
    whyNotDominated: "gives up the delivery date", distinguishesFromSibling: "protects safety over speed",
  } };
  const c2 = { ...c, label: "Verify the gap yourself first", construction: { ...c.construction, legitimateValue: "accuracy", acceptedCost: "the risk stays live", competentIntent: "a lead confirms before acting", concreteAction: "verifies the gap", whyNotDominated: "gives up immediate safety margin", distinguishesFromSibling: "protects accuracy over safety margin" } };
  const action = { prompt: "What now?", choices: [{ ...c, isActionCommitment: true }, { ...c2, isActionCommitment: false }] };
  return {
    noSafeJudgmentSpace: false,
    title: "Raising a risk",
    opening: "A teammate flags a safety gap hours before the deadline and both promises cannot hold.",
    primaryChoices: [c, c2],
    flatEscalationText: "A second reviewer reports the same gap.",
    flatTradeoffChoices: [c, c2],
    flatActionDecision: action,
    branches: [
      { resultingWorldState: "The line is stopped.", escalationText: "The client escalates.", tradeoffChoices: [c, c2], actionDecision: action },
      { resultingWorldState: "The gap is narrowed.", escalationText: "The buffer is consumed.", tradeoffChoices: [c, c2], actionDecision: action },
    ],
    boundaryGrounding: [],
  };
}

/**
 * The largest semantic-review response the current contract permits: one assessment per visible
 * choice (34), one progression + causal record per branch (4), 10 boundary assessments, urgency for
 * every primary choice, and the cross-branch comparison.
 */
export function buildMaxSemanticReview(hangul = false, profile: FixtureProfile = "schema", card: Cardinality = {}): SemanticReview {
  const z = SIZES[profile];
  const primaryCount = card.primary ?? GENERATED_PRIMARY_CHOICES;
  const tradeoffCount = card.tradeoff ?? GENERATED_TRADEOFF_CHOICES;
  const actionCount = card.action ?? GENERATED_ACTION_CHOICES;
  const ids = maxBoundaryIds(card.boundaries ?? z.boundaries);
  // R2.23A — reviewer text is bounded too, so the review maximum is finite and measurable.
  const cap = profile === "schema" ? GEN_REVIEW_TEXT_MAX : Math.round(GEN_REVIEW_TEXT_MAX * 0.6);
  const text = (n: number, seed: string) => filler(Math.max(8, Math.min(n, cap)), seed, hangul);
  const phases: Array<{ phase: "primary" | "flat_tradeoff" | "flat_action" | "branch_tradeoff" | "branch_action"; branchIndex: number; count: number }> = [
    { phase: "primary", branchIndex: -1, count: primaryCount },
    { phase: "flat_tradeoff", branchIndex: -1, count: tradeoffCount },
    { phase: "flat_action", branchIndex: -1, count: actionCount },
    ...Array.from({ length: primaryCount }, (_, b) => ({ phase: "branch_tradeoff" as const, branchIndex: b, count: tradeoffCount })),
    ...Array.from({ length: primaryCount }, (_, b) => ({ phase: "branch_action" as const, branchIndex: b, count: actionCount })),
  ];
  return {
    noSafeJudgmentSpace: false,
    noSafeReasonCode: "judgment_space_remains",
    boundaryIdsConsidered: ids,
    remainingJudgmentDimensions: Array.from({ length: 4 }, (_, i) => text(60, `rjd${i}`)),
    violatedBoundaryIds: [],
    explanation: text(600, "expl"),
    primaryChoices: Array.from({ length: primaryCount }, (_, i) => ({
      index: i,
      legitimateValue: text(120, `pv${i}`),
      acceptedCost: text(200, `pc${i}`),
      defensible: true,
      defectCodes: [],
    })),
    twoValuesInTension: true,
    tensionValueA: text(120, "ta"),
    tensionValueB: text(120, "tb"),
    branches: Array.from({ length: primaryCount }, (_, i) => ({
      index: i,
      selectedPrimarySummary: text(200, `bsp${i}`),
      resultingWorldState: text(300, `brw${i}`),
      newConstraintOrPressure: text(240, `bnc${i}`),
      nextDecisionDimension: text(160, `bnd${i}`),
      repeatsPrimaryDecision: false,
      overlapsOtherBranchIndex: -1,
      overlapReason: text(160, `bor${i}`),
      branchDistinct: true,
      defectCodes: [],
      primaryDecisionPreserved: true,
      tradeoffDecisionDimension: text(160, `btd${i}`),
      actionDecisionDimension: text(160, `bad${i}`),
      tradeoffAdvancesScenario: true,
      actionAdvancesScenario: true,
      repeatedMeaningPairs: Array.from({ length: 4 }, (_, j) => text(140, `brm${i}${j}`)),
      progressionValid: true,
      selectedPrimaryEffect: text(240, `bse${i}`),
      affectedStakeholders: Array.from({ length: 4 }, (_, j) => text(60, `bas${i}${j}`)),
      resourceOrRelationshipChange: text(240, `brr${i}`),
      causalLink: text(240, `bcl${i}`),
      boundaryState: text(160, `bbs${i}`),
      urgencyState: text(160, `bus${i}`),
    })),
    phaseChoices: phases.flatMap((p) =>
      Array.from({ length: p.count }, (_, i) => ({
        phase: p.phase,
        branchIndex: p.branchIndex,
        choiceIndex: i,
        legitimateValue: text(120, `${p.phase}${p.branchIndex}v${i}`),
        acceptedCost: text(200, `${p.phase}${p.branchIndex}c${i}`),
        competentIntent: text(240, `${p.phase}${p.branchIndex}n${i}`),
        actionable: true,
        defensible: true,
        dominatedBySibling: false,
        badFaith: false,
        vagueReassurance: false,
        nonCommitmentDecoy: false,
        unsafe: false,
        constructionAgrees: true,
        constructionDispute: text(200, `${p.phase}${p.branchIndex}d${i}`),
        defectCodes: [],
        conciseExplanation: text(240, `${p.phase}${p.branchIndex}e${i}`),
      })),
    ),
    crossBranch: {
      resultingWorldOverlapPairs: Array.from({ length: 6 }, (_, i) => text(16, `cwo${i}`)),
      nextDecisionAxisOverlapPairs: Array.from({ length: 6 }, (_, i) => text(16, `cna${i}`)),
      stakeholderOverlapPairs: Array.from({ length: 6 }, (_, i) => text(16, `cso${i}`)),
      repeatedActionMeaningPairs: Array.from({ length: 6 }, (_, i) => text(16, `cra${i}`)),
      branchesInterchangeable: false,
      allBranchesSameGenericAxis: false,
      defectCodes: [],
      conciseExplanation: text(400, "cbe"),
    },
    boundaryCompliant: true,
    boundaryAssessments: ids.map((id) => ({
      boundaryId: id,
      presentInScenario: true,
      operationalized: true,
      affectedStages: ["opening", "primary", "flat_tradeoff", "flat_action", "branch_tradeoff", "branch_action"],
      allPrimaryChoicesComply: true,
      allBranchesPreserve: true,
      allTradeoffChoicesComply: true,
      allActionChoicesComply: true,
      prohibitedAlternativeExcluded: true,
      remainingJudgmentDimensions: Array.from({ length: 4 }, (_, j) => text(60, `${id}rj${j}`)),
      violatedChoiceReferences: Array.from({ length: 2 }, (_, j) => text(120, `${id}vc${j}`)),
      violatedBranchReferences: Array.from({ length: 2 }, (_, j) => text(120, `${id}vb${j}`)),
      defectCodes: [],
      conciseExplanation: text(240, `${id}ce`),
    })),
    urgency: {
      urgencyPresent: true,
      urgencySource: text(200, "us"),
      timeSensitiveHarmPossible: true,
      choices: Array.from({ length: primaryCount }, (_, i) => ({
        index: i,
        introducesDelay: true,
        delayPurpose: text(200, `udp${i}`),
        safetyBasis: text(200, `usb${i}`),
        foreseeableHarm: text(200, `ufh${i}`),
        escalationUsed: true,
        defensible: true,
        defectCodes: [],
      })),
      overallUrgencyVerdict: "safe",
    },
    overallVerdict: "accept",
    defectCodes: [],
    retryInstruction: text(400, "ri"),
  };
}

/**
 * The largest boundary TRUTH review the R2.38 contract permits: `boundaryCount` boundaries ×
 * BRANCH_AWARE_REACHABLE_SURFACE_COUNT surfaces, every string at its bound.
 *
 * R2.38 removed the two 100-character excerpts, the applicability enum, the compliance enum and the
 * mechanism enum from every row and replaced the evidence with three short ids. This fixture is
 * what proves the resulting budget rather than assuming it.
 */
export function buildMaxNarrowBoundaryReview(
  hangul = false,
  profile: FixtureProfile = "schema",
  boundaryCount: number = MAX_ACTIVE_BOUNDARIES,
): NarrowBoundaryReview {
  const boundaries = maxBoundaryIds(boundaryCount);
  const reasonCap = profile === "schema" ? NARROW_REASON_MAX : Math.round(NARROW_REASON_MAX * 0.6);
  const idCap = profile === "schema" ? CANDIDATE_ID_MAX : Math.round(CANDIDATE_ID_MAX * 0.6);
  const refs = [
    ...Array.from({ length: GENERATED_PRIMARY_CHOICES }, (_, i) => `primary[${i}]`),
    ...Array.from({ length: GENERATED_PRIMARY_CHOICES }, (_, b) => [
      `branch[${b}].resulting_world_state`,
      ...Array.from({ length: GENERATED_TRADEOFF_CHOICES }, (_, i) => `branch[${b}].tradeoff[${i}]`),
      ...Array.from({ length: GENERATED_ACTION_CHOICES }, (_, i) => `branch[${b}].action[${i}]`),
    ]).flat(),
  ];
  if (refs.length !== BRANCH_AWARE_REACHABLE_SURFACE_COUNT) {
    throw new Error(`reachable surface fixture drifted: ${refs.length} != ${BRANCH_AWARE_REACHABLE_SURFACE_COUNT}`);
  }
  return {
    assessments: boundaries.flatMap((boundaryId) =>
      refs.map((surfaceRef) => ({
        boundaryId,
        surfaceRef,
        governedActionStatus: "present" as const,
        prerequisiteStatus: "explicitly_missing" as const,
        temporalRelation: "action_before_prerequisite" as const,
        // The worst case fills all three ids even though the state table never requires all three.
        governedActionCandidateId: filler(idCap, `${boundaryId}${surfaceRef}a`, false),
        prerequisiteSatisfactionCandidateId: filler(idCap, `${boundaryId}${surfaceRef}s`, false),
        prerequisiteFailureCandidateId: filler(idCap, `${boundaryId}${surfaceRef}f`, false),
        reason: filler(reasonCap, `${boundaryId}${surfaceRef}r`, hangul),
      })),
    ),
  };
}
