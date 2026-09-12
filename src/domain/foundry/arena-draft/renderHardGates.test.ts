import { describe, it, expect } from "vitest";
import { validatePlanDimensionLeakage, validateSiblingChoicePairs } from "./renderHardGates";
import type { DecisionPlan } from "./decisionPlan";
import type { ArenaScenarioDraft } from "./types";

/**
 * DETERMINISTIC RENDER HARD GATES (R2.29).
 *
 * These prove identity, never meaning. The negative cases carry the weight: a gate that also
 * rejected paraphrase would be taking back the authority Commander Decision B removed from the
 * reviewer, and it would do so with a worse instrument.
 */

const choice = (id: string, label: string) => ({ id, label });

function draftWith(over: {
  p1Tradeoff?: string[];
  p2Tradeoff?: string[];
  p1Action?: string[];
  p2Action?: string[];
  primary?: string[];
} = {}): ArenaScenarioDraft {
  const t1 = over.p1Tradeoff ?? ["Tell the client today", "Wait for the fix estimate"];
  const t2 = over.p2Tradeoff ?? ["Brief the team first", "Escalate to the director"];
  const a1 = over.p1Action ?? ["Send the update yourself", "Ask the lead to send it"];
  const a2 = over.p2Action ?? ["Book a call for Friday", "Put the revised date in writing"];
  const prim = over.primary ?? ["Disclose the slip now", "Confirm the recovery plan first"];
  const branch = (t: string[], a: string[], prefix: string) => ({
    resultingWorldState: `world ${prefix}`,
    escalationText: `escalation ${prefix}`,
    tradeoffChoices: t.map((l, i) => choice(`${prefix}-t${i + 1}`, l)),
    actionDecision: {
      prompt: `prompt ${prefix}`,
      choices: a.map((l, i) => ({ ...choice(`${prefix}-a${i + 1}`, l), isActionCommitment: i === 0 })),
    },
  });
  return {
    title: "t",
    opening: "o",
    primary: { choices: prim.map((l, i) => choice(`p${i + 1}`, l)) },
    tradeoff: { escalationText: "flat escalation", choices: [choice("ft1", "Flat one"), choice("ft2", "Flat two")] },
    actionDecision: {
      prompt: "flat prompt",
      choices: [{ ...choice("fa1", "Flat action one"), isActionCommitment: true }, { ...choice("fa2", "Flat action two"), isActionCommitment: false }],
    },
    branches: { p1: branch(t1, a1, "p1"), p2: branch(t2, a2, "p2") },
  } as unknown as ArenaScenarioDraft;
}

const G1 = (d: ArenaScenarioDraft) => validateSiblingChoicePairs(d).errors;

describe("Gate 1 — sibling choice-pair identity", () => {
  it("1. the same ordered pair in both branches is rejected", () => {
    const pair = ["Tell the client today", "Wait for the fix estimate"];
    expect(G1(draftWith({ p1Tradeoff: pair, p2Tradeoff: [...pair] }))).toContain("sibling_choice_pair_identical");
  });

  it("2. the same pair REVERSED is still the same pair", () => {
    const pair = ["Tell the client today", "Wait for the fix estimate"];
    expect(G1(draftWith({ p1Tradeoff: pair, p2Tradeoff: [pair[1], pair[0]] }))).toContain("sibling_choice_pair_identical");
  });

  it("3. whitespace and case differences are representation, not a different pair", () => {
    expect(
      G1(draftWith({
        p1Tradeoff: ["Tell the client today", "Wait for the fix estimate"],
        p2Tradeoff: ["  TELL THE   CLIENT TODAY ", "wait for the fix estimate"],
      })),
    ).toContain("sibling_choice_pair_identical");
  });

  it("4. one genuinely different option makes it a different pair", () => {
    expect(
      G1(draftWith({
        p1Tradeoff: ["Tell the client today", "Wait for the fix estimate"],
        p2Tradeoff: ["Tell the client today", "Escalate to the director"],
      })),
    ).toEqual([]);
  });

  it("5. a missing or empty choice is NOT identity — the construction gates own that", () => {
    expect(G1(draftWith({ p1Tradeoff: ["", ""], p2Tradeoff: ["", ""] }))).toEqual([]);
    expect(G1(draftWith({ p1Tradeoff: ["only one"], p2Tradeoff: ["only one"] }))).toEqual([]);
  });

  it("6. identical sibling TRADEOFF pairs are rejected", () => {
    const pair = ["Share the partial findings", "Hold until verification completes"];
    expect(G1(draftWith({ p1Tradeoff: pair, p2Tradeoff: [...pair] }))).toContain("sibling_choice_pair_identical");
  });

  it("7. identical sibling ACTION pairs are rejected", () => {
    const pair = ["Send the update yourself", "Ask the lead to send it"];
    expect(G1(draftWith({ p1Action: pair, p2Action: [...pair] }))).toContain("sibling_choice_pair_identical");
  });

  it("8. a tradeoff pair equal to an ACTION pair does not fire this gate", () => {
    // Within-branch repetition is a progression defect and belongs to the existing gates.
    const pair = ["Send the update yourself", "Ask the lead to send it"];
    expect(G1(draftWith({ p1Tradeoff: pair, p1Action: [...pair] }))).toEqual([]);
  });

  it("8b. Korean labels differing only by morphology are NOT identity", () => {
    // "알린다" vs "알리기" may well mean the same thing. This gate has no authority to say so.
    expect(
      G1(draftWith({
        p1Tradeoff: ["팀에게 알린다", "검증을 기다린다"],
        p2Tradeoff: ["팀에 알리기", "검증을 기다리기"],
      })),
    ).toEqual([]);
  });
});

const plan = (over: Partial<DecisionPlan> = {}): DecisionPlan =>
  ({
    primary: {
      dimensionId: "what_to_communicate",
      dimension: "What to communicate to the client about the missed delivery?",
      tension: "transparency versus overpromising",
      choices: [
        { id: "p1", stance: "Disclose now", acceptedCost: "no plan yet" },
        { id: "p2", stance: "Confirm first", acceptedCost: "delay" },
      ],
    },
    branches: [
      {
        primaryChoiceId: "p1",
        resultingWorldState: "w1",
        tradeoff: { dimensionId: "how_much_detail", dimension: "How much detail to provide about the next steps?", tension: "t" },
        action: { dimensionId: "who_to_assign_update", dimension: "Who to assign the task of updating the client?", tension: "" },
      },
      {
        primaryChoiceId: "p2",
        resultingWorldState: "w2",
        tradeoff: { dimensionId: "when_to_communicate", dimension: "When to communicate with the client?", tension: "t" },
        action: { dimensionId: "what_to_explain", dimension: "What to explain in the update?", tension: "" },
      },
    ],
    ...over,
  }) as DecisionPlan;

const G2 = (d: ArenaScenarioDraft, p: DecisionPlan | null) => validatePlanDimensionLeakage(d, p).errors;

describe("Gate 2 — Plan dimension leakage", () => {
  it("9. a learner label that IS the Plan dimension question is rejected", () => {
    const d = draftWith({ p1Tradeoff: ["How much detail to provide about the next steps?", "Wait for the estimate"] });
    expect(G2(d, plan())).toContain("plan_dimension_label_leakage");
  });

  it("9b. equality is normalized, so trailing space and case still leak", () => {
    const d = draftWith({ p1Tradeoff: ["  how much detail to provide about the next steps?  ", "Wait"] });
    expect(G2(d, plan())).toContain("plan_dimension_label_leakage");
  });

  it("10. a learner label containing the literal snake_case dimensionId is rejected", () => {
    const d = draftWith({ p2Action: ["Follow who_to_assign_update and send it", "Book a call"] });
    expect(G2(d, plan())).toContain("plan_dimension_label_leakage");
  });

  it("11. ordinary wording that merely shares topic words with a dimension passes", () => {
    const d = draftWith({
      p1Tradeoff: ["Give the client the detail we have and name what is still unknown", "Wait for the estimate"],
      p2Tradeoff: ["Communicate with the client on Friday once the plan is confirmed", "Escalate to the director"],
    });
    expect(G2(d, plan())).toEqual([]);
  });

  it("11b. a one-word dimension id is not hunted for inside natural text", () => {
    const p = plan({
      primary: { dimensionId: "timing", dimension: "When do we speak?", tension: "t", choices: [] } as never,
      branches: [],
    } as never);
    const d = draftWith({ p1Tradeoff: ["Improve the timing of the next update", "Wait"] });
    expect(G2(d, p)).toEqual([]);
  });

  it("12. Legacy input has no Plan, so the gate does not apply", () => {
    const d = draftWith({ p1Tradeoff: ["How much detail to provide about the next steps?", "Wait"] });
    expect(validatePlanDimensionLeakage(d, null)).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("13. a PTR render with real options and no leakage passes", () => {
    expect(G2(draftWith(), plan())).toEqual([]);
  });
});

/*
  GATE 2 — FULL-DIMENSION LITERAL CONTAINMENT (R2.32).

  MEASURED CAUSE. The live strict-parity 36-run rendered `문제에 대해 얼마나 알릴지 결정한다` from
  the declared Plan dimension `문제에 대해 얼마나 알릴지`, and the semantic reviewer ACCEPTED it —
  the first measured false accept of the whole arc. Exact equality missed it by four characters.

  MEASURED GUARD DECISION. Over 26 retained Plan/Render pairs there are 15 literal containments, and
  every single one sits inside a VIOLATED render. Zero of the 12 known FAITHFUL renders contain a
  complete declared dimension — including the shortest one measured, 10 normalized characters. So no
  length guard was invented: requiring the COMPLETE declared question is itself the guard.

  The reverse direction is deliberately absent, and no suffix is ever stripped.
*/
describe("Gate 2 — full-dimension literal containment", () => {
  const KO_DIM = "문제에 대해 얼마나 알릴지";
  const EN_DIM = "How much detail to provide in the update?";

  const koPlan = (): DecisionPlan =>
    ({
      primary: { dimensionId: "ko_primary_dim", dimension: KO_DIM, tension: "t", choices: [] },
      branches: [],
    }) as unknown as DecisionPlan;

  const enPlan = (): DecisionPlan =>
    ({
      primary: { dimensionId: "en_primary_dim", dimension: EN_DIM, tension: "t", choices: [] },
      branches: [],
    }) as unknown as DecisionPlan;

  const fire = (label: string, p: DecisionPlan) => validatePlanDimensionLeakage(draftWith({ p1Tradeoff: [label, "Wait for the estimate"] }), p);

  it("1. exact full-dimension equality still rejects, as EXACT_DIMENSION_EQUALITY", () => {
    const r = fire(KO_DIM, koPlan());
    expect(r.errors).toContain("plan_dimension_label_leakage");
    expect(r.reasons).toContain("EXACT_DIMENSION_EQUALITY");
  });

  it("2. the measured case — full Korean dimension plus 결정한다 — rejects by containment", () => {
    const r = fire(`${KO_DIM} 결정한다`, koPlan());
    expect(r.errors).toContain("plan_dimension_label_leakage");
    expect(r.reasons).toContain("FULL_DIMENSION_CONTAINMENT");
    // The suffix is never stripped; the whole dimension is simply present inside a longer string.
    expect(r.reasons).not.toContain("EXACT_DIMENSION_EQUALITY");
  });

  it("3. a full English dimension inside a longer learner label rejects", () => {
    const r = fire(`Decide ${EN_DIM} before the call`, enPlan());
    expect(r.errors).toContain("plan_dimension_label_leakage");
    expect(r.reasons).toContain("FULL_DIMENSION_CONTAINMENT");
  });

  it("4. the REVERSE direction is not this defect — a short label inside a long dimension passes", () => {
    const p = {
      primary: { dimensionId: "ko_time_dim", dimension: "검증에 얼마나 많은 시간을 쏟을지", tension: "t", choices: [] },
      branches: [],
    } as unknown as DecisionPlan;
    expect(fire("시간", p).errors).toEqual([]);
  });

  it("5. sharing only some dimension words passes", () => {
    expect(fire("문제에 대해 팀과 상의한다", koPlan()).errors).toEqual([]);
  });

  it("6. sharing topic vocabulary passes", () => {
    expect(fire("How much support the client needs right now", enPlan()).errors).toEqual([]);
  });

  it("7. a morphological change INSIDE the dimension removes it literally — containment does NOT fire", () => {
    // `알릴지` -> `알리는지` breaks the literal run, so the complete dimension is simply not present.
    // No stemming rescues it, and none is wanted: this gate matches text, not meaning.
    expect(fire("문제에 대해 얼마나 알리는지 결정한다", koPlan()).errors).toEqual([]);
  });

  it("7b. a particle ATTACHED to the dimension's last word does not break containment", () => {
    // `알릴지를` still starts with `알릴지`, so the complete declared question is literally present.
    // Recorded because it is the opposite of stripping: nothing was removed to make this match.
    const r = fire("문제에 대해 얼마나 알릴지를 결정한다", koPlan());
    expect(r.errors).toContain("plan_dimension_label_leakage");
    expect(r.reasons).toContain("FULL_DIMENSION_CONTAINMENT");
  });

  it("8. no length guard — even the shortest measured dimension (10 chars) fires on containment", () => {
    const p = {
      primary: { dimensionId: "ko_when_dim", dimension: "결과를 언제 알릴지", tension: "t", choices: [] },
      branches: [],
    } as unknown as DecisionPlan;
    const r = fire("결과를 언제 알릴지 결정하기", p);
    expect(r.errors).toContain("plan_dimension_label_leakage");
    expect(r.reasons).toContain("FULL_DIMENSION_CONTAINMENT");
  });

  it("9. snake_case dimensionId leakage keeps its own reason", () => {
    const r = fire("Follow ko_primary_dim and decide", koPlan());
    expect(r.errors).toContain("plan_dimension_label_leakage");
    expect(r.reasons).toContain("DIMENSION_ID_LITERAL");
  });

  it("10. Legacy with no Plan is still not applicable", () => {
    expect(validatePlanDimensionLeakage(draftWith({ p1Tradeoff: [`${KO_DIM} 결정한다`, "Wait"] }), null).errors).toEqual([]);
  });

  it("11. a PTR render with real options and no literal leakage passes", () => {
    const r = validatePlanDimensionLeakage(draftWith(), koPlan());
    expect(r.errors).toEqual([]);
    expect(r.reasons).toEqual([]);
  });
});
