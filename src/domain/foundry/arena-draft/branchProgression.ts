/**
 * SAME-BRANCH PROGRESSION + CROSS-BRANCH CAUSAL DIVERSITY (Slice 3.2I-R5B1A.1-R2.22).
 *
 * TWO MEASURED DEFECTS
 *
 * c09 — one branch offered the SAME choice text at the tradeoff phase and again at the action phase
 * ("검증을 완료할 때까지 기다린다"). The branch did not progress; it looped. Part of the branch also
 * stayed on the original notify-versus-verify axis the primary choice had already settled.
 *
 * c18 — every sibling branch converged on the same generic problem: what to tell people about
 * timing. Different primary choices produced interchangeable consequences, so the choice the learner
 * made had no causal effect on what happened next.
 *
 * THE CONTRACT
 *
 * A branch is the world AFTER a primary choice. It must (a) preserve that decision, (b) pose a
 * genuinely new tradeoff, and (c) end in an action commitment on a further new dimension. Across
 * siblings, each branch must follow from ITS OWN primary choice: if two branches could be swapped
 * without becoming incoherent, the branching is decorative.
 *
 * Different wording is not different causality — and equally, shared vocabulary is not sameness. A
 * stakeholder may legitimately appear in several branches when the causal state and the next
 * decision genuinely differ, so nothing here demands artificial vocabulary diversity.
 *
 * Pure domain: no I/O, no provider, no DB.
 */

import { GEN_EXPLANATION_MAX, GEN_PAIRS_MAX_ITEMS, GEN_PAIR_MAX, GEN_REVIEW_TEXT_MAX } from "./types";
import { namesADecision } from "./decisionPlan";

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

export const BRANCH_PROGRESSION_DEFECT_CODES = [
  "tradeoff_repeats_primary",
  "action_repeats_tradeoff",
  "action_reopens_primary",
  "branch_decision_loop",
  "no_new_decision_dimension",
  "repeated_choice_meaning_within_branch",
] as const;
export type BranchProgressionDefectCode = (typeof BRANCH_PROGRESSION_DEFECT_CODES)[number];

export const CROSS_BRANCH_DEFECT_CODES = [
  "cross_branch_axis_collapse",
  "interchangeable_branch_consequence",
  "repeated_action_meaning",
  "sibling_world_state_overlap",
  "primary_choice_has_no_causal_effect",
  "generic_communication_collapse",
] as const;
export type CrossBranchDefectCode = (typeof CROSS_BRANCH_DEFECT_CODES)[number];

/**
 * DECISION B (R2.28) — codes the reviewer may no longer AUTHOR.
 *
 * Both name the same finding: "these two sibling branches are substantially the same decision
 * variable". Two prompt iterations measured that this reviewer cannot make that judgment reliably —
 * iteration 1 retained 1 of 6 known-collapsed cases, iteration 2 forced an explicit SAME/DIFFERENT
 * answer per pair and retained 0 of 6, answering DIFFERENT every time, once while naming one
 * branch's own dimension as the pair's shared variable.
 *
 * The definition direction was correct. What failed was asking THIS reviewer to decide it. So the
 * veto is removed rather than retuned: these codes survive for artifact readability and for the
 * deterministic rule below, but a model-authored occurrence is discarded.
 */
/**
 * REVIEWER-INTEGRITY SEVERITY (R2.28, Decision C).
 *
 * THE RULE: a field with ZERO decision authority cannot terminate a review merely because its
 * observation is malformed or low quality.
 *
 * Measured why: the `nextDecisionDimension` form contract and the Debt C fix were each reasonable
 * alone, but together they made the reviewer's PROSE FORMATTING of a telemetry field fatal — 35
 * service tests and 1 of 10 live diagnostic reviews died on `review_malformed`, with a topic label
 * where a decision question was asked for. Removing a model veto in one place and creating a new
 * one in another is not progress.
 *
 * TERMINAL means the required reviewer response contract is not safely interpretable at all.
 * SIGNAL means a non-authoritative observation is unusable: the affected input is withheld from
 * whatever consumed it, the finding is retained as evidence, and the review continues.
 *
 * This is a declared table, not a naming convention. Nothing infers severity from a prefix.
 */
export type IntegritySeverity = "terminal" | "signal";

export const CROSS_BRANCH_INTEGRITY_SEVERITY: Readonly<Record<string, IntegritySeverity>> = {
  // The whole cross-branch object is absent: there is no sibling comparison to interpret.
  review_cross_branch_missing: "terminal",
  // `nextDecisionDimension` is telemetry under Decision B. Badly written telemetry is not a crisis.
  review_next_decision_dimension_invalid: "signal",
};

export const LLM_NON_AUTHORITATIVE_CROSS_BRANCH_CODES: readonly string[] = [
  "cross_branch_axis_collapse",
  "branch_semantic_collapse",
];

// ---------------------------------------------------------------------------
// Reviewer fields
// ---------------------------------------------------------------------------

/** Per-branch progression + causal fields, merged into the existing branch review object. */
export type BranchProgressionFields = {
  primaryDecisionPreserved: boolean;
  tradeoffDecisionDimension: string;
  actionDecisionDimension: string;
  tradeoffAdvancesScenario: boolean;
  actionAdvancesScenario: boolean;
  /** Pairs of choice labels that mean the same thing, however differently worded. */
  repeatedMeaningPairs: string[];
  progressionValid: boolean;
  // --- causal identity, for the cross-branch comparison ---
  selectedPrimaryEffect: string;
  affectedStakeholders: string[];
  resourceOrRelationshipChange: string;
  causalLink: string;
  boundaryState: string;
  urgencyState: string;
};

export const BRANCH_PROGRESSION_SCHEMA_PROPERTIES = {
  primaryDecisionPreserved: { type: "boolean" },
  tradeoffDecisionDimension: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
  actionDecisionDimension: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
  tradeoffAdvancesScenario: { type: "boolean" },
  actionAdvancesScenario: { type: "boolean" },
  repeatedMeaningPairs: { type: "array", maxItems: 4, items: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX } },
  progressionValid: { type: "boolean" },
  selectedPrimaryEffect: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
  affectedStakeholders: { type: "array", maxItems: 4, items: { type: "string", maxLength: 60 } },
  resourceOrRelationshipChange: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
  causalLink: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
  boundaryState: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
  urgencyState: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
} as const;

export const BRANCH_PROGRESSION_REQUIRED = [
  "primaryDecisionPreserved", "tradeoffDecisionDimension", "actionDecisionDimension",
  "tradeoffAdvancesScenario", "actionAdvancesScenario", "repeatedMeaningPairs", "progressionValid",
  "selectedPrimaryEffect", "affectedStakeholders", "resourceOrRelationshipChange", "causalLink",
  "boundaryState", "urgencyState",
] as const;

/** The reviewer's whole-set comparison across siblings. */
export type CrossBranchReview = {
  /** "0-1" style pairs whose resulting world states mean the same thing. */
  resultingWorldOverlapPairs: string[];
  /**
   * TELEMETRY ONLY (R2.28, Decision B). The reviewer's opinion about which sibling pairs share a
   * decision axis is recorded for human review and carries NO authority: it cannot reject a draft.
   */
  nextDecisionAxisOverlapPairs: string[];
  stakeholderOverlapPairs: string[];
  repeatedActionMeaningPairs: string[];
  /** Could branch content be swapped without becoming incoherent? */
  branchesInterchangeable: boolean;
  /** Do all branches reduce to one generic problem (typically "what do we tell people, and when")? */
  allBranchesSameGenericAxis: boolean;
  defectCodes: string[];
  conciseExplanation: string;
};

export const CROSS_BRANCH_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    resultingWorldOverlapPairs: { type: "array", maxItems: GEN_PAIRS_MAX_ITEMS, items: { type: "string", maxLength: GEN_PAIR_MAX } },
    nextDecisionAxisOverlapPairs: { type: "array", maxItems: GEN_PAIRS_MAX_ITEMS, items: { type: "string", maxLength: GEN_PAIR_MAX } },
    stakeholderOverlapPairs: { type: "array", maxItems: GEN_PAIRS_MAX_ITEMS, items: { type: "string", maxLength: GEN_PAIR_MAX } },
    repeatedActionMeaningPairs: { type: "array", maxItems: GEN_PAIRS_MAX_ITEMS, items: { type: "string", maxLength: GEN_PAIR_MAX } },
    branchesInterchangeable: { type: "boolean" },
    allBranchesSameGenericAxis: { type: "boolean" },
    defectCodes: { type: "array", items: { type: "string", enum: CROSS_BRANCH_DEFECT_CODES } },
    conciseExplanation: { type: "string", maxLength: GEN_EXPLANATION_MAX },
  },
  required: [
    "resultingWorldOverlapPairs", "nextDecisionAxisOverlapPairs", "stakeholderOverlapPairs",
    "repeatedActionMeaningPairs", "branchesInterchangeable", "allBranchesSameGenericAxis",
    "defectCodes", "conciseExplanation",
  ],
} as const;

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The measured c18 collapse axis. All-branch convergence on "what do we tell people, and when" is
 * the one generic axis observed in accepted output, so it is named explicitly rather than inferred
 * from a general similarity score.
 */
const COMMUNICATION_AXIS = /\b(communicat|tell|telling|inform|notify|notification|announce|message|messaging|update|updating|disclos|timeline|timing|when to say|what to say|report to)/;
export const isCommunicationAxis = (dimension: string): boolean => COMMUNICATION_AXIS.test(dimension.toLowerCase());

export type BranchDefects = { defects: string[]; perBranch: Array<{ index: number; codes: string[] }> };

/**
 * SAME-BRANCH progression. A branch that re-asks a settled question, repeats a choice one phase
 * later, or ends with no commitment has not progressed — whatever its wording.
 */
export function collectBranchProgressionDefects(
  branches: Array<BranchProgressionFields & { index: number; repeatsPrimaryDecision: boolean }>,
): BranchDefects {
  const defects: string[] = [];
  const perBranch: BranchDefects["perBranch"] = [];

  for (const b of branches) {
    const codes = new Set<string>();
    if (b.repeatsPrimaryDecision || !b.tradeoffAdvancesScenario) codes.add("tradeoff_repeats_primary");
    if (!b.primaryDecisionPreserved) codes.add("action_reopens_primary");
    if (!b.actionAdvancesScenario) codes.add("action_repeats_tradeoff");
    if (b.repeatedMeaningPairs.length > 0) codes.add("repeated_choice_meaning_within_branch");
    // Two decision phases naming ONE dimension is a loop with two labels on it.
    if (normalize(b.tradeoffDecisionDimension) && normalize(b.tradeoffDecisionDimension) === normalize(b.actionDecisionDimension)) {
      codes.add("no_new_decision_dimension");
    }
    if (!b.tradeoffDecisionDimension.trim() || !b.actionDecisionDimension.trim()) codes.add("no_new_decision_dimension");
    // A branch the reviewer itself calls invalid, with nothing else established, is a loop.
    if (!b.progressionValid && codes.size === 0) codes.add("branch_decision_loop");
    // …and the converse: valid progression cannot coexist with any of the above.
    if (b.progressionValid && codes.size > 0) codes.add("branch_decision_loop");

    if (codes.size) {
      defects.push(...codes);
      perBranch.push({ index: b.index, codes: [...codes] });
    }
  }
  return { defects: [...new Set(defects)], perBranch };
}

/**
 * Integrity findings are separated BY THE DECLARED TABLE, so no downstream caller has to know or
 * guess a code's severity. An unlisted code is TERMINAL: a finding nobody classified must stop the
 * review rather than be silently downgraded.
 */
export type CrossBranchOutcome = { terminalErrors: string[]; signals: string[]; defects: string[] };

function split(errors: string[], defects: string[]): CrossBranchOutcome {
  const unique = [...new Set(errors)];
  return {
    terminalErrors: unique.filter((c) => CROSS_BRANCH_INTEGRITY_SEVERITY[c] !== "signal"),
    signals: unique.filter((c) => CROSS_BRANCH_INTEGRITY_SEVERITY[c] === "signal"),
    defects: [...new Set(defects)],
  };
}

/**
 * CROSS-BRANCH causal diversity. Compares the reviewer's own per-branch causal identity fields, so
 * a defect is established by the review's detail rather than by a similarity heuristic over prose.
 */
export function collectCrossBranchDefects(
  branches: Array<BranchProgressionFields & { index: number; resultingWorldState: string; nextDecisionDimension: string }>,
  cross: CrossBranchReview | null,
): CrossBranchOutcome {
  const errors: string[] = [];
  const defects: string[] = [];
  if (branches.length < 2) return split(errors, defects);
  if (!cross) return split(["review_cross_branch_missing"], defects);

  // FORM BEFORE MEANING (R2.26). A dimension written as a topic label rather than as a decision is
  // not a judgeable axis, so it is withheld from every collapse comparison below and reported as
  // REVIEWER integrity — never as a content defect the generator is told to correct.
  const wellFormed = branches.filter((b) => namesADecision(b.nextDecisionDimension));
  if (wellFormed.length !== branches.length) errors.push("review_next_decision_dimension_invalid");
  const malformedIndexes = new Set(branches.filter((b) => !namesADecision(b.nextDecisionDimension)).map((b) => b.index));
  // A pair is unjudgeable when either side's dimension is malformed.
  const judgeablePair = (pair: string) => {
    const parts = pair.split("-").map((n) => Number.parseInt(n.trim(), 10));
    return !parts.some((n) => Number.isInteger(n) && malformedIndexes.has(n));
  };


  const axes = wellFormed.map((b) => normalize(b.nextDecisionDimension));
  const worlds = branches.map((b) => normalize(b.resultingWorldState));

  /*
    THE ONLY SURVIVING AXIS RULE (R2.28, Decision B).

    EVIDENCE GRADE: deterministic over MODEL-AUTHORED OBSERVATIONS. The comparison is exact
    normalized equality performed in code, but the strings compared were written by the reviewer, so
    this is a narrower and weaker class than Plan `dimensionId` identity, which compares declared
    structural identifiers. It rejects only the identity it can PROVE, and is deliberately not
    broadened into similarity: two differently worded dimensions that may or may not mean one thing
    are human-review evidence, not an automatic rejection.
  */
  if (axes.length >= 2 && new Set(axes).size === 1) defects.push("cross_branch_axis_collapse");
  if (new Set(worlds).size !== worlds.length) defects.push("sibling_world_state_overlap");
  // The measured c18 shape: every branch reduced to "what do we tell people, and when".
  if (axes.length >= 2 && axes.every((a) => isCommunicationAxis(a))) defects.push("generic_communication_collapse");
  // A branch whose causal link to its own primary choice is unstated has not established one.
  if (branches.some((b) => !b.selectedPrimaryEffect.trim() || !b.causalLink.trim())) defects.push("primary_choice_has_no_causal_effect");

  if (cross.branchesInterchangeable) defects.push("interchangeable_branch_consequence");
  if (cross.allBranchesSameGenericAxis) defects.push("generic_communication_collapse");
  if (cross.resultingWorldOverlapPairs.length > 0) defects.push("sibling_world_state_overlap");
  if (cross.repeatedActionMeaningPairs.length > 0) defects.push("repeated_action_meaning");
  // Decision B — a model-authored paraphrase-identity verdict is recorded upstream, never acted on.
  defects.push(...cross.defectCodes.filter((c) => !LLM_NON_AUTHORITATIVE_CROSS_BRANCH_CODES.includes(c)));

  // Shared stakeholders alone are NOT a defect — deliberately absent from the rules above, because a
  // client or a charge nurse can legitimately appear in every branch. Only a reviewer that reports
  // stakeholder overlap AND identical next decisions has actually shown a collapse.
  if (cross.stakeholderOverlapPairs.length > 0 && axes.length >= 2 && new Set(axes).size === 1) defects.push("interchangeable_branch_consequence");

  return split(errors, defects);
}
