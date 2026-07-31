import { describe, it, expect } from "vitest";
import {
  CROSS_BRANCH_REVIEW_JSON_SCHEMA,
  collectBranchProgressionDefects,
  collectCrossBranchDefects,
  isCommunicationAxis,
  type BranchProgressionFields,
  type CrossBranchReview,
} from "./branchProgression";

/**
 * SAME-BRANCH PROGRESSION + CROSS-BRANCH CAUSAL DIVERSITY (Slice 3.2I-R5B1A.1-R2.22).
 *
 * c09 — a branch offered the same choice at the tradeoff phase and again at the action phase, and
 * part of the branch stayed on the axis the primary choice had already settled.
 * c18 — every sibling branch converged on "what do we tell people, and when", so the learner's
 * primary choice had no causal effect on what happened next.
 *
 * The negative cases matter as much as the positives: a shared stakeholder across branches is
 * legitimate, and shared vocabulary is not shared causality.
 */

type Branch = BranchProgressionFields & {
  index: number;
  repeatsPrimaryDecision: boolean;
  resultingWorldState: string;
  nextDecisionDimension: string;
};

const branch = (i: number, over: Partial<Branch> = {}): Branch => ({
  index: i,
  repeatsPrimaryDecision: false,
  resultingWorldState: `world after primary ${i + 1}`,
  nextDecisionDimension: i === 0 ? "escalation order" : "staffing coverage",
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
  causalLink: `follows from primary ${i + 1}`,
  boundaryState: "unchanged",
  urgencyState: "no time-sensitive harm",
  ...over,
});

const cross = (over: Partial<CrossBranchReview> = {}): CrossBranchReview => ({
  resultingWorldOverlapPairs: [],
  nextDecisionAxisOverlapPairs: [],
  stakeholderOverlapPairs: [],
  repeatedActionMeaningPairs: [],
  branchesInterchangeable: false,
  allBranchesSameGenericAxis: false,
  defectCodes: [],
  conciseExplanation: "Each branch follows from its own primary choice.",
  ...over,
});

const prog = (...b: Branch[]) => collectBranchProgressionDefects(b).defects;
const diverse = (b: Branch[], c: CrossBranchReview | null = cross()) => collectCrossBranchDefects(b, c).defects;

// ---------------------------------------------------------------------------
// 22-27. SAME-BRANCH PROGRESSION
// ---------------------------------------------------------------------------

describe("same-branch progression", () => {
  it("26. a genuinely progressive three-stage branch is ACCEPTED", () => {
    expect(prog(branch(0), branch(1))).toEqual([]);
  });

  it("22. a tradeoff that re-asks the primary question is rejected", () => {
    expect(prog(branch(0, { repeatsPrimaryDecision: true, progressionValid: false }))).toContain("tradeoff_repeats_primary");
    expect(prog(branch(0, { tradeoffAdvancesScenario: false, progressionValid: false }))).toContain("tradeoff_repeats_primary");
  });

  it("23. an action phase that re-asks the tradeoff is rejected", () => {
    expect(prog(branch(0, { actionAdvancesScenario: false, progressionValid: false }))).toContain("action_repeats_tradeoff");
  });

  it("24. a later phase that re-opens the primary decision is rejected", () => {
    expect(prog(branch(0, { primaryDecisionPreserved: false, progressionValid: false }))).toContain("action_reopens_primary");
  });

  it("25/27. THE c09 DEFECT — semantically identical choices one phase apart, however worded", () => {
    // The reviewer reports the PAIR, so this fires whether or not the strings are byte-identical.
    const r = prog(branch(0, { repeatedMeaningPairs: ["tradeoff 2 == action 2: both wait for the verification to finish"], progressionValid: false }));
    expect(r).toContain("repeated_choice_meaning_within_branch");
  });

  it("two decision phases naming ONE dimension is a loop with two labels on it", () => {
    expect(prog(branch(0, { actionDecisionDimension: "escalation order", progressionValid: false }))).toContain("no_new_decision_dimension");
    expect(prog(branch(0, { tradeoffDecisionDimension: "", progressionValid: false }))).toContain("no_new_decision_dimension");
  });

  it("a branch the reviewer calls invalid without saying why is a loop", () => {
    expect(prog(branch(0, { progressionValid: false }))).toContain("branch_decision_loop");
  });

  it("progressionValid=true cannot coexist with a repeated meaning it just reported", () => {
    expect(prog(branch(0, { repeatedMeaningPairs: ["a == b"], progressionValid: true }))).toContain("branch_decision_loop");
  });
});

// ---------------------------------------------------------------------------
// 28-34. CROSS-BRANCH DIVERSITY
// ---------------------------------------------------------------------------

describe("cross-branch causal diversity", () => {
  it("33. distinct world states and distinct decision axes are ACCEPTED", () => {
    expect(diverse([branch(0), branch(1)])).toEqual([]);
  });

  it("28. the same next-decision axis in every branch is collapse", () => {
    const same = [branch(0), branch(1, { nextDecisionDimension: "escalation order" })];
    expect(diverse(same)).toContain("cross_branch_axis_collapse");
  });

  it("28b. the reviewer reporting an axis-overlap pair is equally decisive", () => {
    expect(diverse([branch(0), branch(1)], cross({ nextDecisionAxisOverlapPairs: ["0-1"] }))).toContain("cross_branch_axis_collapse");
  });

  it("29/31. interchangeable consequences — branch content could be swapped and still cohere", () => {
    expect(diverse([branch(0), branch(1)], cross({ branchesInterchangeable: true }))).toContain("interchangeable_branch_consequence");
  });

  it("30. repeated action meaning across branches is rejected", () => {
    expect(diverse([branch(0), branch(1)], cross({ repeatedActionMeaningPairs: ["0-1"] }))).toContain("repeated_action_meaning");
  });

  it("sibling branches landing in the same world are rejected", () => {
    expect(diverse([branch(0), branch(1, { resultingWorldState: "world after primary 1" })])).toContain("sibling_world_state_overlap");
    expect(diverse([branch(0), branch(1)], cross({ resultingWorldOverlapPairs: ["0-1"] }))).toContain("sibling_world_state_overlap");
  });

  it("34. THE c18 DEFECT — every branch reduced to what to tell people and when", () => {
    const comms = [
      branch(0, { nextDecisionDimension: "what to tell the client about timing" }),
      branch(1, { nextDecisionDimension: "how to communicate the revised timeline" }),
    ];
    expect(diverse(comms)).toContain("generic_communication_collapse");
    expect(diverse([branch(0), branch(1)], cross({ allBranchesSameGenericAxis: true }))).toContain("generic_communication_collapse");
  });

  it("34b. NEGATIVE — ONE communication branch beside an operational one is not a collapse", () => {
    const mixed = [branch(0, { nextDecisionDimension: "what to tell the client about timing" }), branch(1, { nextDecisionDimension: "who covers the staffing gap" })];
    expect(diverse(mixed)).toEqual([]);
    expect(isCommunicationAxis("who covers the staffing gap")).toBe(false);
  });

  it("a branch with no stated causal link to its own primary choice has not established one", () => {
    expect(diverse([branch(0, { causalLink: "" }), branch(1)])).toContain("primary_choice_has_no_causal_effect");
    expect(diverse([branch(0, { selectedPrimaryEffect: " " }), branch(1)])).toContain("primary_choice_has_no_causal_effect");
  });

  it("32. NEGATIVE — a SHARED STAKEHOLDER with genuinely different causal states is ACCEPTED", () => {
    // The client appears in both branches. That is normal, and demanding vocabulary variety would
    // force artificial scenarios. Only overlap PLUS one identical axis is a collapse.
    const shared = [
      branch(0, { affectedStakeholders: ["the client", "the director"] }),
      branch(1, { affectedStakeholders: ["the client", "the delivery team"] }),
    ];
    expect(diverse(shared, cross({ stakeholderOverlapPairs: ["0-1"] }))).toEqual([]);
  });

  it("32b. …but shared stakeholders AND one identical axis is interchangeable", () => {
    const collapsed = [branch(0), branch(1, { nextDecisionDimension: "escalation order" })];
    expect(diverse(collapsed, cross({ stakeholderOverlapPairs: ["0-1"] }))).toContain("interchangeable_branch_consequence");
  });

  it("a missing cross-branch comparison is a broken review, not a pass", () => {
    expect(collectCrossBranchDefects([branch(0), branch(1)], null).errors).toContain("review_cross_branch_missing");
  });

  it("a single-branch scenario has nothing to compare", () => {
    expect(collectCrossBranchDefects([branch(0)], null)).toEqual({ errors: [], defects: [] });
  });

  it("the cross-branch schema names every field and forbids extras", () => {
    expect(CROSS_BRANCH_REVIEW_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(CROSS_BRANCH_REVIEW_JSON_SCHEMA.required).toEqual(Object.keys(CROSS_BRANCH_REVIEW_JSON_SCHEMA.properties));
  });
});
