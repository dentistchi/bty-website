import { describe, it, expect } from "vitest";
import { collectCrossBranchDefects, type BranchProgressionFields, type CrossBranchReview } from "./branchProgression";
import { namesADecision } from "./decisionPlan";

/**
 * DECISION-VARIABLE ALIGNMENT (R2.26).
 *
 * MEASURED CAUSE. In the full-retention 36-run, ten retained drafts carried
 * `cross_branch_axis_collapse`. Four were Commander-reviewed as FALSE. The clearest is
 * plan_render_v1 / c01-missed-commitment run 3, whose approved plan gave branch p1 the dimensions
 * "How much detail to provide about the next steps?" then "Who to assign the task of updating the
 * client?", and branch p2 "When to communicate with the client after confirming the recovery plan?"
 * then "What to explain in the update to the client once the plan is confirmed?".
 *
 * Those are four DIFFERENT decision variables — how much / who / when / what. The reviewer collapsed
 * them because every one of them is about the same client and the same communication. Shared topic
 * is not a shared decision.
 *
 * The dimension strings below are quoted from that retained artifact, so these cases fail if the
 * contract ever drifts back to topic-level sameness.
 */

type Branch = BranchProgressionFields & {
  index: number;
  repeatsPrimaryDecision: boolean;
  resultingWorldState: string;
  nextDecisionDimension: string;
};

const branch = (i: number, nextDecisionDimension: string): Branch => ({
  index: i,
  repeatsPrimaryDecision: false,
  resultingWorldState: `world after primary ${i + 1}`,
  nextDecisionDimension,
  primaryDecisionPreserved: true,
  tradeoffDecisionDimension: nextDecisionDimension,
  actionDecisionDimension: `what to commit to in branch ${i + 1}`,
  tradeoffAdvancesScenario: true,
  actionAdvancesScenario: true,
  repeatedMeaningPairs: [],
  progressionValid: true,
  selectedPrimaryEffect: `primary ${i + 1} changed the client's expectation`,
  affectedStakeholders: ["the client"],
  resourceOrRelationshipChange: `resource state ${i + 1}`,
  causalLink: `follows from primary ${i + 1}`,
  boundaryState: "unchanged",
  urgencyState: "no time-sensitive harm",
});

const cross = (over: Partial<CrossBranchReview> = {}): CrossBranchReview => ({
  resultingWorldOverlapPairs: [],
  nextDecisionAxisOverlapPairs: [],
  stakeholderOverlapPairs: [],
  repeatedActionMeaningPairs: [],
  branchesInterchangeable: false,
  allBranchesSameGenericAxis: false,
  defectCodes: [],
  conciseExplanation: "Each branch decides a different variable.",
  ...over,
});

const run = (dims: [string, string], c: CrossBranchReview = cross()) =>
  collectCrossBranchDefects([branch(0, dims[0]), branch(1, dims[1])], c);

// --- the four measured dimensions, verbatim ---------------------------------
const HOW_MUCH = "How much detail to provide about the next steps?";
const WHEN = "When to communicate with the client after confirming the recovery plan?";
const WHO = "Who to assign the task of updating the client?";
const WHAT = "What to explain in the update to the client once the plan is confirmed?";

describe("decision-variable distinctness", () => {
  it("1. same topic, different variable (how much vs when) is NOT axis collapse", () => {
    expect(run([HOW_MUCH, WHEN]).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("2. same topic, different variable (who vs what) is NOT axis collapse", () => {
    expect(run([WHO, WHAT]).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("3. a REWORDED variable is no longer auto-rejected — code cannot prove it, so it is evidence", () => {
    const same: [string, string] = ["whether to give a timeline", "whether to provide a timeline"];
    // Decision B: the deterministic rule proves identity; it does not guess at paraphrase.
    expect(run(same).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("3c. and no reviewer opinion can reject it either", () => {
    const same: [string, string] = ["whether to give a timeline", "whether to provide a timeline"];
    const opinionated = cross({
      nextDecisionAxisOverlapPairs: ["0-1"],
      defectCodes: ["cross_branch_axis_collapse"],
    });
    expect(run(same, opinionated).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("3b. a differently described resulting world does not rescue a byte-identical variable", () => {
    const r = collectCrossBranchDefects(
      [
        { ...branch(0, "whether to give a timeline"), resultingWorldState: "the client has been told" },
        { ...branch(1, "whether to give a timeline"), resultingWorldState: "the client is still waiting" },
      ],
      cross(),
    );
    expect(r.defects).toContain("cross_branch_axis_collapse");
  });
});

describe("nextDecisionDimension form integrity", () => {
  const TOPIC_LABEL = "client communication";

  it("4. a malformed dimension is withheld from collapse and reported as REVIEWER integrity", () => {
    const r = run([TOPIC_LABEL, WHEN]);
    expect(r.signals).toContain("review_next_decision_dimension_invalid");
    // Withheld from the comparison: an unjudgeable dimension cannot establish a content defect.
    expect(r.defects).not.toContain("cross_branch_axis_collapse");
  });

  it("4b. the integrity code is never a content defect", () => {
    const r = run([TOPIC_LABEL, TOPIC_LABEL]);
    expect(r.signals).toContain("review_next_decision_dimension_invalid");
    expect(r.defects).not.toContain("review_next_decision_dimension_invalid");
    expect(r.terminalErrors).toEqual([]);
    // Two identical TOPIC labels are not evidence of a repeated decision variable.
    expect(r.defects).not.toContain("cross_branch_axis_collapse");
  });

  it("5. a well-formed dimension participates normally and raises no integrity code", () => {
    expect(run([HOW_MUCH, WHEN]).signals).not.toContain("review_next_decision_dimension_invalid");
    // …and when both sides are well formed AND identical, the deterministic rule can prove it.
    expect(run([HOW_MUCH, HOW_MUCH]).defects).toContain("cross_branch_axis_collapse");
  });
});

describe("one form implementation, two callers", () => {
  /*
    The reviewer's form gate must BE the Plan contract, not a second copy that drifts from it. These
    inputs cover every branch of that one implementation, including the Korean `-(으)ㄹ지` ending,
    which no independently written checker would reproduce by accident.
  */
  const TABLE: Array<[string, boolean]> = [
    [HOW_MUCH, true],
    [WHEN, true],
    [WHO, true],
    [WHAT, true],
    ["whether to give a timeline", true],
    ["고객에게 언제 알릴지", true],
    ["어느 정도까지 공유할 것인지", true],
    ["client communication", false],
    ["transparency", false],
    ["리더십 가치", false],
  ];

  it.each(TABLE)("6. namesADecision(%j) === %s, and the collapse gate agrees", (text, expected) => {
    expect(namesADecision(text)).toBe(expected);
    // The gate's own verdict, observed through the integrity code it raises.
    const raised = run([text, WHEN]).signals.includes("review_next_decision_dimension_invalid");
    expect(raised).toBe(!expected);
  });
});

/*
  NOT CHANGED HERE, AND DELIBERATELY VISIBLE.

  `generic_communication_collapse` still fires from `isCommunicationAxis`, a TOPIC regex, when every
  branch dimension merely mentions communication vocabulary. The measured pair WHO / WHAT are
  different decision variables, yet both contain "update", so the topic rule alone would call them
  one generic axis. That code did NOT appear in any of the ten retained cases, so it is recorded as a
  latent misalignment rather than silently weakened to improve a replay number.
*/
describe("latent topic-level rule, recorded not repaired", () => {
  it("7. two different variables that both mention updating still trip the TOPIC regex", () => {
    expect(run([WHO, WHAT]).defects).toContain("generic_communication_collapse");
  });
});

/*
  DECISION B (R2.28) — THE LLM HAS NO PARAPHRASE-IDENTITY VETO.

  Two prompt iterations were measured against the ten labelled cases. Asked implicitly, the reviewer
  retained 1 of 6 known-collapsed cases. Asked as a schema-required, side-by-side SAME/DIFFERENT
  question with a mandatory decision-variable name, it retained 0 of 6 and answered DIFFERENT every
  time — once while writing one branch's own dimension as the pair's shared variable, and accepting
  the scenario with zero defects.

  The definition direction was right; asking THIS reviewer to apply it was the part that failed. So
  the judgment is removed from authority rather than tuned a third time.

  What remains automatic is only what code can PROVE: exact normalized identity. Its evidence grade
  is deterministic over MODEL-AUTHORED OBSERVATIONS — weaker than Plan `dimensionId` identity, which
  compares declared structural identifiers — so it is deliberately not broadened into similarity.
*/
describe("Decision B — no model veto over paraphrase identity", () => {
  const opinion = (over: Partial<ReturnType<typeof cross>> = {}) => cross({
    nextDecisionAxisOverlapPairs: ["0-1"],
    branchesInterchangeable: false,
    ...over,
  });

  it("the reviewer asserting the axis code directly cannot reject the draft", () => {
    const r = run([HOW_MUCH, WHEN], opinion({ defectCodes: ["cross_branch_axis_collapse"] }));
    expect(r.defects).not.toContain("cross_branch_axis_collapse");
  });

  it("the reviewer asserting branch_semantic_collapse directly cannot reject the draft", () => {
    const r = run([HOW_MUCH, WHEN], opinion({ defectCodes: ["branch_semantic_collapse"] }));
    expect(r.defects).not.toContain("branch_semantic_collapse");
  });

  it("the overlap-pair opinion is telemetry and rejects nothing", () => {
    expect(run([HOW_MUCH, WHEN], opinion()).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("an unrelated model-authored cross-branch code still carries its normal authority", () => {
    // Decision B is narrow: only paraphrase identity lost its veto.
    const r = run([HOW_MUCH, WHEN], opinion({ defectCodes: ["interchangeable_branch_consequence"] }));
    expect(r.defects).toContain("interchangeable_branch_consequence");
  });
});

describe("deterministic identity is what still rejects", () => {
  it("A. proven identity — the same normalized dimension twice — rejects", () => {
    expect(run([WHEN, WHEN]).defects).toContain("cross_branch_axis_collapse");
  });

  it("A2. identity survives whitespace and case, which normalization removes", () => {
    expect(run([WHEN, `  ${WHEN.toUpperCase()}  `]).defects).toContain("cross_branch_axis_collapse");
  });

  it("B. how much versus when is not identical and is not rejected", () => {
    expect(run([HOW_MUCH, WHEN]).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("C. who versus what is not identical and is not rejected", () => {
    expect(run([WHO, WHAT]).defects).not.toContain("cross_branch_axis_collapse");
  });

  it("D. a paraphrase the rule cannot prove is left alone, not guessed at", () => {
    // "how to update the team" / "how to provide the team an update" may well be one variable.
    // Code cannot prove that, so it stays human evidence rather than an automatic rejection.
    const r = run(["how to update the team", "how to provide the team an update"]);
    expect(r.defects).not.toContain("cross_branch_axis_collapse");
    expect(r.terminalErrors).toEqual([]);
    expect(r.signals).toEqual([]);
  });
});
