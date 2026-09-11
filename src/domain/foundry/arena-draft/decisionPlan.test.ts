import { describe, it, expect } from "vitest";
import {
  parseDecisionPlan,
  renderPlanCorrection,
  renderPlanForPrompt,
  validateDecisionPlan,
  type DecisionPlan,
} from "./decisionPlan";

/** A structurally STRONG plan: two different worlds, two different tradeoffs, distinct actions. */
const STRONG: DecisionPlan = {
  primary: {
    dimensionId: "response_stance",
    dimension: "요청을 지금 거절할지, 대안을 먼저 찾을지",
    tension: "운영 인력을 지키는 것과 요청자를 존중하는 것이 함께 걸려 있다",
    choices: [
      { id: "p1", stance: "운영 인력 확보", acceptedCost: "요청자의 신뢰가 흔들린다" },
      { id: "p2", stance: "요청자의 사정 존중", acceptedCost: "이번 주 운영이 빠듯해진다" },
    ],
  },
  branches: [
    {
      primaryChoiceId: "p1",
      resultingWorldState: "요청은 거절되었고 해당 의사는 이유를 듣지 못한 상태다",
      tradeoff: { dimensionId: "explanation_depth", dimension: "얼마나 설명할지", tension: "솔직함과 사기 저하 사이" },
      action: { dimensionId: "who_hears_first", dimension: "누구에게 먼저 알릴지" },
    },
    {
      primaryChoiceId: "p2",
      resultingWorldState: "휴가는 승인되었고 그 주 근무표에 공백이 생겼다",
      tradeoff: { dimensionId: "coverage_source", dimension: "공백을 어디서 메울지", tension: "팀 피로와 외부 비용 사이" },
      action: { dimensionId: "rota_commitment", dimension: "근무표를 언제 확정할지" },
    },
  ],
};

const clone = (): DecisionPlan => JSON.parse(JSON.stringify(STRONG));
const problems = (p: DecisionPlan) => validateDecisionPlan(p).findings.map((f) => f.problem);

describe("the plan validator decides by identity, never by similarity", () => {
  it("5 — a structurally strong plan passes", () => {
    expect(validateDecisionPlan(STRONG)).toEqual({ ok: true, findings: [] });
  });

  /*
    ★ THE MEASURED COLLAPSE, CAUGHT BEFORE PROSE EXISTS.
    run6 shipped tradeoff "추가 인력을 요청하여 운영을 유지하기" with action "…유지한다" — one verb
    ending apart, invisible to normalized string equality. As ids, it is just `a === b`.
  */
  it("1 — tradeoff and action sharing a dimensionId is rejected", () => {
    const p = clone();
    p.branches[0]!.action.dimensionId = p.branches[0]!.tradeoff.dimensionId;
    const v = validateDecisionPlan(p);
    expect(v.ok).toBe(false);
    expect(v.findings).toContainEqual({ branch: "p1", field: "action.dimensionId", problem: "same_as_tradeoff_dimension" });
  });

  it("1b — an action re-opening the primary decision is rejected", () => {
    const p = clone();
    p.branches[1]!.action.dimensionId = p.primary.dimensionId;
    expect(problems(p)).toContain("same_as_primary_dimension");
  });

  it("2 — a missing resulting world state is rejected", () => {
    const p = clone();
    p.branches[0]!.resultingWorldState = "   ";
    expect(problems(p)).toContain("consequence_empty_or_generic");
  });

  it("3 — two branches for one primary choice is rejected", () => {
    const p = clone();
    p.branches[1]!.primaryChoiceId = "p1";
    const probs = problems(p);
    expect(probs).toContain("two_branches_for_one_choice");
    expect(probs).toContain("branch_missing_for_primary_choice");
  });

  it("4 — a missing branch is rejected", () => {
    const p = clone();
    p.branches = [p.branches[0]!];
    expect(problems(p)).toContain("branch_missing_for_primary_choice");
  });

  /*
    ★ v1.1 — EACH SIBLING STAGE IS CHECKED ON ITS OWN.

    These two cases are the measured v1 escapes, reproduced exactly: run3 was approved with both
    branches ending on one action dimension, run4 with both facing one tradeoff dimension under
    different worlds. v1's rule needed BOTH to coincide and therefore caught neither.
  */
  it("8.1 — siblings sharing a TRADEOFF dimension are rejected, even with different worlds", () => {
    const p = clone();
    p.branches[1]!.tradeoff.dimensionId = p.branches[0]!.tradeoff.dimensionId;
    expect(p.branches[0]!.resultingWorldState).not.toBe(p.branches[1]!.resultingWorldState);
    expect(problems(p)).toContain("sibling_tradeoff_dimension_repeated");
  });

  it("8.2 + 8.4 — siblings sharing an ACTION dimension are rejected, even with different tradeoffs", () => {
    const p = clone();
    p.branches[1]!.action.dimensionId = p.branches[0]!.action.dimensionId;
    expect(p.branches[0]!.tradeoff.dimensionId).not.toBe(p.branches[1]!.tradeoff.dimensionId);
    expect(problems(p)).toContain("sibling_action_dimension_repeated");
  });

  it("8.3 — a shared world is reported on its own, as secondary evidence", () => {
    const p = clone();
    p.branches[1]!.resultingWorldState = p.branches[0]!.resultingWorldState;
    const probs = problems(p);
    expect(probs).toContain("sibling_world_state_identical");
    // …and the semantic stages, which differ here, are NOT accused.
    expect(probs).not.toContain("sibling_tradeoff_dimension_repeated");
    expect(probs).not.toContain("sibling_action_dimension_repeated");
  });

  /* 8.5 — the strong plan differs at BOTH stages, which is what makes it strong. */
  it("8.5 — different tradeoff AND different action passes", () => {
    expect(validateDecisionPlan(STRONG).ok).toBe(true);
  });

  /*
    ★ 8.10/8.11 — A DIMENSION MUST NAME SOMETHING CHOOSABLE.
    Measured in v1: `리더십 가치` cleared the word floor and named no decision.
  */
  it("8.10 — a bare topic is rejected in either language", () => {
    // Long enough to clear the length floor, so the decision-form rule is what refuses them.
    for (const bare of ["리더십 가치", "좋은 소통", "the leadership value here", "clear team communication always"]) {
      const p = clone();
      p.branches[0]!.tradeoff.dimension = bare;
      expect(problems(p), bare).toContain("description_names_no_decision");
    }
  });

  /* A short bare topic is still refused — by the length floor, which runs first. */
  it("8.10b — a very short topic is refused by the floor before the form rule", () => {
    const p = clone();
    p.branches[0]!.tradeoff.dimension = "leadership value";
    expect(problems(p)).toContain("description_too_thin");
    expect(validateDecisionPlan(p).ok).toBe(false);
  });

  it("8.11 — a real decision variable passes, in either language", () => {
    for (const good of [
      "운영 안정성을 얼마나 우선할지",
      "즉시 알릴지 먼저 확인할지",
      "어느 정도의 유연성을 허용할지",
      "what to prioritize under the capacity constraint",
      "when to disclose versus verify",
    ]) {
      const p = clone();
      p.branches[0]!.tradeoff.dimension = good;
      expect(problems(p), good).not.toContain("description_names_no_decision");
    }
  });

  it("rejects ids that name nothing, and numbered-apart ids", () => {
    for (const bad of ["dimension", "d1", "axis2", "new", "generic"]) {
      const p = clone();
      p.branches[0]!.action.dimensionId = bad;
      expect(problems(p), bad).toContain("dimension_id_carries_no_meaning");
    }
    const shape = clone();
    shape.branches[0]!.action.dimensionId = "Not Snake Case";
    expect(problems(shape)).toContain("dimension_id_not_semantic");
  });

  /* The Hangul floor established in Track A applies here too: 2 units in Korean, 3 otherwise. */
  it("rejects an empty or too-thin dimension description, in either language", () => {
    const ko = clone();
    ko.branches[0]!.action.dimension = "결정";
    expect(problems(ko)).toContain("description_too_thin");
    const en = clone();
    en.branches[0]!.action.dimension = "who decides";
    expect(problems(en)).toContain("description_too_thin");
    const generic = clone();
    generic.branches[0]!.action.dimension = "TBD";
    expect(problems(generic)).toContain("description_empty_or_generic");
  });
});

describe("parsing is structural and fails closed", () => {
  it("reads a well-formed plan", () => {
    const r = parseDecisionPlan(JSON.parse(JSON.stringify(STRONG)));
    expect(r.ok).toBe(true);
  });

  it("refuses shapes it cannot read", () => {
    for (const bad of [null, "text", {}, { primary: {}, branches: [] }]) {
      expect(parseDecisionPlan(bad).ok).toBe(false);
    }
  });

  it("refuses a choice id outside p1/p2", () => {
    const p = JSON.parse(JSON.stringify(STRONG));
    p.primary.choices[0].id = "p3";
    expect(parseDecisionPlan(p).ok).toBe(false);
  });
});

describe("the correction names coordinates and supplies no answer", () => {
  const packet = renderPlanCorrection([
    { branch: "p1", field: "action.dimensionId", problem: "same_as_tradeoff_dimension" },
  ]);

  it("carries branch, field and problem", () => {
    expect(packet).toContain("branch=p1");
    expect(packet).toContain("field=action.dimensionId");
    expect(packet).toContain("problem=same_as_tradeoff_dimension");
  });

  it("never supplies the replacement decision", () => {
    for (const forbidden of ["for example", "instead use", "such as", "e.g."]) {
      expect(packet.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("the render contract carries every settled decision", () => {
  const text = renderPlanForPrompt(STRONG);

  it("10 — states the plan the renderer must obey", () => {
    expect(text).toContain("Do not redesign it");
    for (const id of ["response_stance", "explanation_depth", "who_hears_first", "coverage_source", "rota_commitment"]) {
      expect(text).toContain(id);
    }
    for (const b of STRONG.branches) expect(text).toContain(b.resultingWorldState);
  });

  /* v1 represents ONLY today's runtime graph — the player does not branch after the tradeoff. */
  it("does not invent a per-tradeoff continuation", () => {
    expect(text).not.toContain("afterTradeoff");
    const src = JSON.stringify(STRONG);
    expect(src).not.toContain("afterTradeoff");
  });
});
