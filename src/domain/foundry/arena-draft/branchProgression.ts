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
 * CROSS-BRANCH causal diversity. Compares the reviewer's own per-branch causal identity fields, so
 * a defect is established by the review's detail rather than by a similarity heuristic over prose.
 */
export function collectCrossBranchDefects(
  branches: Array<BranchProgressionFields & { index: number; resultingWorldState: string; nextDecisionDimension: string }>,
  cross: CrossBranchReview | null,
): { errors: string[]; defects: string[] } {
  const errors: string[] = [];
  const defects: string[] = [];
  if (branches.length < 2) return { errors, defects };
  if (!cross) return { errors: ["review_cross_branch_missing"], defects };

  const axes = branches.map((b) => normalize(b.nextDecisionDimension));
  const worlds = branches.map((b) => normalize(b.resultingWorldState));

  // Every branch posing the SAME next decision means the primary choice changed nothing.
  if (axes.length >= 2 && new Set(axes).size === 1) defects.push("cross_branch_axis_collapse");
  if (new Set(worlds).size !== worlds.length) defects.push("sibling_world_state_overlap");
  // The measured c18 shape: every branch reduced to "what do we tell people, and when".
  if (axes.length >= 2 && axes.every((a) => isCommunicationAxis(a))) defects.push("generic_communication_collapse");
  // A branch whose causal link to its own primary choice is unstated has not established one.
  if (branches.some((b) => !b.selectedPrimaryEffect.trim() || !b.causalLink.trim())) defects.push("primary_choice_has_no_causal_effect");

  if (cross.branchesInterchangeable) defects.push("interchangeable_branch_consequence");
  if (cross.allBranchesSameGenericAxis) defects.push("generic_communication_collapse");
  if (cross.resultingWorldOverlapPairs.length > 0) defects.push("sibling_world_state_overlap");
  if (cross.nextDecisionAxisOverlapPairs.length > 0) defects.push("cross_branch_axis_collapse");
  if (cross.repeatedActionMeaningPairs.length > 0) defects.push("repeated_action_meaning");
  defects.push(...cross.defectCodes);

  // Shared stakeholders alone are NOT a defect — deliberately absent from the rules above, because a
  // client or a charge nurse can legitimately appear in every branch. Only a reviewer that reports
  // stakeholder overlap AND identical next decisions has actually shown a collapse.
  if (cross.stakeholderOverlapPairs.length > 0 && new Set(axes).size === 1) defects.push("interchangeable_branch_consequence");

  return { errors, defects: [...new Set(defects)] };
}
