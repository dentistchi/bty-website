import { describe, it, expect } from "vitest";
import {
  PROVIDER_SCENARIO_JSON_SCHEMA,
  canonicalizeProviderScenario,
  validateProviderScenario,
  type ProviderPracticeScenario,
} from "./providerDto";
import { parseArenaScenarioDraft } from "./validate";
import { constructionFor } from "./providerDto.fixture";

/**
 * PROVIDER DTO + deterministic canonicalization (Slice 3.2I-R5B1A.1-R2.16).
 *
 * The model authors judgment content; the server authors transport identity. These tests pin that
 * split: no id or dynamic key may be authored by the model, position is the branch relationship,
 * and canonicalization must never invent, merge, reorder or edit content.
 */

// R2.22 — every provider choice carries a construction record. `constructionFor` supplies a valid,
// sibling-distinct default so these transport-identity tests keep testing transport identity.
const choice = (label: string, i = 0) => ({ label, constraintAssessments: [], construction: constructionFor(label, i) });
const act = (label: string, commit: boolean, i = 0) => ({ label, isActionCommitment: commit, constraintAssessments: [], construction: constructionFor(label, i) });

function dto(over: Partial<ProviderPracticeScenario> = {}): ProviderPracticeScenario {
  return {
    boundaryGrounding: [], // no confirmed constraints in this fixture (see boundaryGrounding.test.ts)
    noSafeJudgmentSpace: false,
    title: "Raising a risk under a deadline",
    opening: "A teammate flags a safety gap hours before the client deadline; both promises cannot hold.",
    primaryChoices: [choice("Stop the line now"), choice("Verify the gap yourself first")],
    flatEscalationText: "A second reviewer reports the same gap and the client asks for a call.",
    flatTradeoffChoices: [choice("Ask the client for more time"), choice("Narrow the release scope")],
    flatActionDecision: { prompt: "What now?", choices: [act("Call the client now", true), act("Verify once more first", false)] },
    branches: [
      {
        resultingWorldState: "The line is stopped.",
        escalationText: "The client escalates to your director within the hour.",
        tradeoffChoices: [choice("Brief the director first"), choice("Send the written summary")],
        actionDecision: { prompt: "Commit to what?", choices: [act("Give a dated recovery plan", true), act("Ask for a day", false)] },
      },
      {
        resultingWorldState: "The gap is narrowed.",
        escalationText: "Verification consumed the schedule buffer.",
        tradeoffChoices: [choice("Ship the verified portion"), choice("Ask for an overtime push")],
        actionDecision: { prompt: "Commit to what?", choices: [act("Tell the client which part slips", true), act("Wait for the overtime result", false)] },
      },
    ],
    ...over,
  };
}

describe("strict JSON Schema shape", () => {
  it("forbids additional properties and names every required field", () => {
    const s = PROVIDER_SCENARIO_JSON_SCHEMA;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(Object.keys(s.properties)); // strict mode: all properties required
  });

  it("contains NO dynamic property names — branches is an array", () => {
    expect(PROVIDER_SCENARIO_JSON_SCHEMA.properties.branches.type).toBe("array");
    expect(JSON.stringify(PROVIDER_SCENARIO_JSON_SCHEMA)).not.toMatch(/patternProperties|<primaryChoiceId>/);
  });

  it("requires an explicit isActionCommitment boolean on every action choice", () => {
    const a = PROVIDER_SCENARIO_JSON_SCHEMA.properties.flatActionDecision.properties.choices.items;
    expect(a.properties.isActionCommitment.type).toBe("boolean");
    expect(a.required).toContain("isActionCommitment");
    expect(a.additionalProperties).toBe(false);
  });

  it("R2.23A — pins EXACTLY two at every generated decision point", () => {
    const p = PROVIDER_SCENARIO_JSON_SCHEMA.properties;
    expect([p.primaryChoices.minItems, p.primaryChoices.maxItems]).toEqual([2, 2]);
    expect([p.branches.minItems, p.branches.maxItems]).toEqual([2, 2]);
    expect([p.flatTradeoffChoices.minItems, p.flatTradeoffChoices.maxItems]).toEqual([2, 2]);
    expect([p.flatActionDecision.properties.choices.minItems, p.flatActionDecision.properties.choices.maxItems]).toEqual([2, 2]);
    const b = p.branches.items.properties;
    expect([b.tradeoffChoices.minItems, b.tradeoffChoices.maxItems]).toEqual([2, 2]);
    expect([b.actionDecision.properties.choices.minItems, b.actionDecision.properties.choices.maxItems]).toEqual([2, 2]);
  });
});

describe("DTO validation", () => {
  it("accepts a well-formed DTO", () => {
    expect(validateProviderScenario(dto()).ok).toBe(true);
  });

  it("accepts the noSafeJudgmentSpace refusal without requiring scenario structure", () => {
    const r = validateProviderScenario({ noSafeJudgmentSpace: true });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.noSafeJudgmentSpace).toBe(true);
  });

  it("rejects a branch count that differs from the primary-choice count", () => {
    const short = validateProviderScenario(dto({ branches: [dto().branches[0]] }));
    expect(short.ok).toBe(false);
    expect(!short.ok && short.errors).toContain("dto_branch_count_mismatch");
    const long = validateProviderScenario(dto({ branches: [...dto().branches, dto().branches[0]] }));
    expect(!long.ok && long.errors).toContain("dto_branch_count_mismatch");
  });

  it("rejects a missing isActionCommitment with the exact canary code", () => {
    const bad = dto();
    delete (bad.branches[0].actionDecision.choices[0] as { isActionCommitment?: boolean }).isActionCommitment;
    const r = validateProviderScenario(bad);
    expect(!r.ok && r.errors).toContain("action_choice_missing_commitment_flag");
  });

  it("preserves the existing no_action_commitment rule", () => {
    const bad = dto();
    bad.flatActionDecision.choices = bad.flatActionDecision.choices.map((c) => ({ ...c, isActionCommitment: false }));
    const r = validateProviderScenario(bad);
    expect(!r.ok && r.errors).toContain("no_action_commitment");
  });

  it("rejects a non-object and an empty label", () => {
    expect(validateProviderScenario(null).ok).toBe(false);
    expect(validateProviderScenario([dto()]).ok).toBe(false);
    const bad = dto();
    bad.primaryChoices[0].label = "";
    expect(validateProviderScenario(bad).ok).toBe(false);
  });
});

describe("deterministic canonicalization", () => {
  const valid = () => {
    const r = validateProviderScenario(dto());
    if (!r.ok) throw new Error("fixture invalid");
    return r.value;
  };

  it("assigns unique positional ids and produces a canonical draft that parses", () => {
    const { draft } = canonicalizeProviderScenario(valid());
    expect(draft.primary.choices.map((c) => c.id)).toEqual(["p1", "p2"]);
    expect(Object.keys(draft.branches!)).toEqual(["p1", "p2"]);
    expect(draft.branches!.p1.tradeoffChoices.map((c) => c.id)).toEqual(["p1-t1", "p1-t2"]);
    expect(draft.branches!.p2.actionDecision.choices.map((c) => c.id)).toEqual(["p2-a1", "p2-a2"]);
    expect(parseArenaScenarioDraft(draft).ok).toBe(true);
  });

  it("every id in the scenario is unique", () => {
    const { draft } = canonicalizeProviderScenario(valid());
    const ids = [
      ...draft.primary.choices.map((c) => c.id),
      ...draft.tradeoff.choices.map((c) => c.id),
      ...draft.actionDecision.choices.map((c) => c.id),
      ...Object.values(draft.branches!).flatMap((b) => [...b.tradeoffChoices.map((c) => c.id), ...b.actionDecision.choices.map((c) => c.id)]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is byte-identical for the same DTO (no randomness, no hashing of text)", () => {
    expect(JSON.stringify(canonicalizeProviderScenario(valid()).draft)).toBe(JSON.stringify(canonicalizeProviderScenario(valid()).draft));
  });

  it("copies content verbatim — nothing invented, merged, reordered or edited", () => {
    const src = valid();
    const { draft } = canonicalizeProviderScenario(src);
    expect(draft.title).toBe(src.title);
    expect(draft.opening).toBe(src.opening);
    expect(draft.primary.choices.map((c) => c.label)).toEqual(src.primaryChoices.map((c) => c.label));
    expect(draft.branches!.p2.escalationText).toBe(src.branches[1].escalationText);
    expect(draft.actionDecision.choices.map((c) => c.isActionCommitment)).toEqual(src.flatActionDecision.choices.map((c) => c.isActionCommitment));
  });

  it("keeps duplicate labels as separate choices with distinct ids", () => {
    const d = dto();
    d.primaryChoices[1].label = d.primaryChoices[0].label;
    const v = validateProviderScenario(d);
    expect(v.ok).toBe(true);
    const { draft } = canonicalizeProviderScenario((v as { value: ProviderPracticeScenario }).value);
    expect(draft.primary.choices).toHaveLength(2);
    expect(draft.primary.choices[0].id).not.toBe(draft.primary.choices[1].id);
    expect(draft.primary.choices[0].label).toBe(draft.primary.choices[1].label); // wording preserved, not merged
  });

  it("converts Korean content without translating or modifying it", () => {
    const ko = dto({
      title: "마감 앞에서 위험을 알리기",
      opening: "동료가 마감 몇 시간 전에 안전 문제를 조용히 알려왔습니다. 두 약속을 모두 지킬 수는 없습니다.",
      primaryChoices: [choice("지금 라인을 멈추고 팀에 알린다"), choice("직접 먼저 확인한 뒤 결정한다")],
    });
    const v = validateProviderScenario(ko);
    expect(v.ok).toBe(true);
    const { draft } = canonicalizeProviderScenario((v as { value: ProviderPracticeScenario }).value);
    expect(draft.title).toBe("마감 앞에서 위험을 알리기");
    expect(draft.primary.choices[0].label).toBe("지금 라인을 멈추고 팀에 알린다");
  });

  it("R2.23C — provider choices carry NO constraint attestation at all", () => {
    const { draft, constructionsByChoiceId } = canonicalizeProviderScenario(valid());
    // The generator no longer certifies its own compliance; the server materializes that evidence
    // from an ACCEPTED review instead (see constraintProjection.test.ts).
    expect(JSON.stringify(draft)).not.toContain("constraintAssessments");
    expect(Object.keys(constructionsByChoiceId)).toHaveLength(14);
    expect("assessmentsByChoiceId" in canonicalizeProviderScenario(valid())).toBe(false);
  });
});

describe("untrusted canonical input keeps its own duplicate-id rejection", () => {
  it("parseArenaScenarioDraft still rejects duplicate ids from a non-provider caller", () => {
    const { draft } = canonicalizeProviderScenario((validateProviderScenario(dto()) as { value: ProviderPracticeScenario }).value);
    const tampered = JSON.parse(JSON.stringify(draft));
    tampered.primary.choices[1].id = tampered.primary.choices[0].id;
    const r = parseArenaScenarioDraft(tampered);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("duplicate_choice_id");
  });
});
