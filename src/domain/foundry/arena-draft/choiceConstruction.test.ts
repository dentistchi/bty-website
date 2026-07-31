import { describe, it, expect } from "vitest";
import {
  CHOICE_CONSTRUCTION_JSON_SCHEMA,
  CHOICE_PHASES,
  detectLabelDefects,
  detectMeasuredLabelDefects,
  enumerateChoices,
  statesBadFaithIntent,
  validateChoiceConstructions,
  type ProviderChoiceConstruction,
} from "./choiceConstruction";
import { PROVIDER_SCENARIO_JSON_SCHEMA, canonicalizeProviderScenario, validateProviderScenario } from "./providerDto";
import { constructionFor, toProviderDto } from "./providerDto.fixture";
import type { ArenaScenarioDraft } from "./types";

/**
 * CHOICE CONSTRUCTION + MEASURED LABEL DEFECTS (Slice 3.2I-R5B1A.1-R2.22).
 *
 * Every case reproduces something measured in ACCEPTED live output: c01's "Assure the client that
 * everything is on schedule" (a lie, since the delivery had already been missed), its "Suggest they
 * trust your timeline without further explanation" and "Continue to deflect questions", and c09's
 * identical choice offered again one phase later inside a branch.
 *
 * Every deterministic rule here has a NEGATIVE fixture too. A rule that cannot be shown to leave
 * legitimate content alone is a rule that will quietly destroy legitimate content.
 */

const C01_FACTS = "Your team missed a delivery you personally promised the client, and the recovery plan is not yet confirmed";
const NEUTRAL_FACTS = "The team disagrees on how to prioritize two competing projects";

const label = (id: string, text: string) => ({ id, label: text });

function draftWith(over: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "A promise under pressure",
    opening: "The client is waiting on an update and the recovery plan is not confirmed yet.",
    primary: { choices: [label("p1", "Tell the client what is confirmed and commit to a written update by end of day"), label("p2", "Hold the update until the recovery plan is confirmed, accepting the silence")] },
    tradeoff: {
      escalationText: "A second stakeholder asks for a date within the hour.",
      choices: [label("ft1", "Give the range you can defend and name what would change it"), label("ft2", "Narrow the commitment to the one milestone you control")],
    },
    actionDecision: {
      prompt: "What now?",
      choices: [{ ...label("fa1", "Call the client now and own the miss"), isActionCommitment: true }, { ...label("fa2", "Send a written summary once the plan is confirmed"), isActionCommitment: false }],
    },
    branches: {
      p1: {
        escalationText: "The client escalates to your director within the hour.",
        tradeoffChoices: [label("p1-t1", "Brief the director yourself first"), label("p1-t2", "Send the written summary and let the director lead")],
        actionDecision: { prompt: "Commit to what?", choices: [{ ...label("p1-a1", "Give a dated recovery plan on the call"), isActionCommitment: true }, { ...label("p1-a2", "Ask for a day to confirm the fix"), isActionCommitment: false }] },
      },
      p2: {
        escalationText: "The delay consumes the buffer the schedule depended on.",
        tradeoffChoices: [label("p2-t1", "Ship the confirmed portion and hold the rest"), label("p2-t2", "Ask the team for an overtime push")],
        actionDecision: { prompt: "Commit to what?", choices: [{ ...label("p2-a1", "Tell the client which part slips"), isActionCommitment: true }, { ...label("p2-a2", "Confirm the scope before committing a date"), isActionCommitment: false }] },
      },
    },
    ...over,
  };
}

/** Valid constructions for every choice in a draft, distinct per sibling. */
function constructionsFor(draft: ArenaScenarioDraft, boundaryIds: string[] = []): Record<string, ProviderChoiceConstruction> {
  const out: Record<string, ProviderChoiceConstruction> = {};
  for (const c of enumerateChoices(draft)) out[c.id] = constructionFor(c.label, c.index, boundaryIds);
  return out;
}

const run = (draft: ArenaScenarioDraft, k: Record<string, unknown>, constraintIds: string[] = [], facts = NEUTRAL_FACTS) =>
  validateChoiceConstructions(draft, k, { constraintIds, factsText: facts });

const withOverride = (draft: ArenaScenarioDraft, id: string, over: Partial<ProviderChoiceConstruction>) => {
  const k = constructionsFor(draft);
  k[id] = { ...k[id], ...over };
  return k;
};

// ---------------------------------------------------------------------------
// 1-4. Every phase constructed
// ---------------------------------------------------------------------------

describe("choice construction reaches every phase", () => {
  it("1-4. enumerates primary, both flat phases, and every branch phase exactly once", () => {
    const ids = enumerateChoices(draftWith()).map((c) => c.id);
    expect(ids).toEqual(["p1", "p2", "ft1", "ft2", "fa1", "fa2", "p1-t1", "p1-t2", "p1-a1", "p1-a2", "p2-t1", "p2-t2", "p2-a1", "p2-a2"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(enumerateChoices(draftWith()).map((c) => c.phase))).toEqual(new Set(CHOICE_PHASES));
  });

  it("1-4. a fully constructed scenario is ACCEPTED", () => {
    expect(run(draftWith(), constructionsFor(draftWith()))).toEqual({ ok: true, errors: [] });
  });

  it("a construction missing from ANY phase is rejected — not just the primary phase", () => {
    for (const id of ["p1", "ft1", "fa2", "p1-t2", "p2-a1"]) {
      const k = constructionsFor(draftWith());
      delete k[id];
      expect(run(draftWith(), k).errors, `${id} went unchecked`).toContain("construction_missing");
    }
  });

  it("the strict provider schema requires a construction on every choice", () => {
    const p = PROVIDER_SCENARIO_JSON_SCHEMA.properties;
    expect(p.primaryChoices.items.required).toContain("construction");
    expect(p.flatTradeoffChoices.items.required).toContain("construction");
    expect(p.flatActionDecision.properties.choices.items.required).toContain("construction");
    expect(p.branches.items.properties.tradeoffChoices.items.required).toContain("construction");
    expect(p.branches.items.properties.actionDecision.properties.choices.items.required).toContain("construction");
    expect(CHOICE_CONSTRUCTION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(CHOICE_CONSTRUCTION_JSON_SCHEMA.required).toEqual(Object.keys(CHOICE_CONSTRUCTION_JSON_SCHEMA.properties));
  });
});

// ---------------------------------------------------------------------------
// 5-10. Value / cost / intent consistency
// ---------------------------------------------------------------------------

describe("construction consistency", () => {
  it("5. placeholder value or cost is rejected", () => {
    expect(run(draftWith(), withOverride(draftWith(), "p1", { legitimateValue: "" })).errors).toContain("no_legitimate_value");
    expect(run(draftWith(), withOverride(draftWith(), "p1", { legitimateValue: "n/a" })).errors).toContain("no_legitimate_value");
    expect(run(draftWith(), withOverride(draftWith(), "ft1", { acceptedCost: "none" })).errors).toContain("no_real_cost");
    expect(run(draftWith(), withOverride(draftWith(), "p2-a1", { acceptedCost: "cost" })).errors).toContain("no_real_cost");
  });

  it("5b. a copied value/cost/intent profile across siblings is not two choices", () => {
    const k = constructionsFor(draftWith());
    k["p2"] = { ...k["p1"] };
    expect(run(draftWith(), k).errors).toContain("duplicate_value_cost_profile");
  });

  it("5c. the SAME profile in different sibling groups is fine — they are never chosen against each other", () => {
    const k = constructionsFor(draftWith());
    k["p1-t1"] = { ...k["p1"] };
    expect(run(draftWith(), k).errors).not.toContain("duplicate_value_cost_profile");
  });

  it("6. THE c01 SHAPE — metadata claiming competence over a measurably false label", () => {
    const d = draftWith({ primary: { choices: [label("p1", "Assure the client that everything is on schedule"), label("p2", "Tell the client what is confirmed and commit to a written update by end of day")] } });
    const r = run(d, constructionsFor(d), [], C01_FACTS);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("construction_contradicts_label");
  });

  it("7. an intent that RESTS on concealment or deflection is rejected", () => {
    expect(run(draftWith(), withOverride(draftWith(), "p1", { competentIntent: "buys time by concealing the miss from the client" })).errors).toContain("competent_intent_bad_faith");
    expect(run(draftWith(), withOverride(draftWith(), "p1", { competentIntent: "keeps deflecting until the plan lands" })).errors).toContain("competent_intent_bad_faith");
  });

  it("7b. NEGATIVE — an intent that names bad faith in order to REJECT it is not bad faith", () => {
    for (const intent of [
      "protects the relationship without misleading the client about the date",
      "gives a defensible range rather than concealing the uncertainty",
      "avoids deflecting: it states what is known and what is not",
    ]) {
      expect(statesBadFaithIntent(intent), intent).toBe(false);
      expect(run(draftWith(), withOverride(draftWith(), "p1", { competentIntent: intent })).errors).not.toContain("competent_intent_bad_faith");
    }
  });

  it("8. a legitimate speed-versus-certainty pair is ACCEPTED", () => {
    const k = constructionsFor(draftWith());
    k["p1"] = { ...k["p1"], legitimateValue: "speed of information to the client", acceptedCost: "commits before the plan is confirmed", competentIntent: "the client can plan around a partial answer" };
    k["p2"] = { ...k["p2"], legitimateValue: "accuracy of what is promised", acceptedCost: "the client waits without news", competentIntent: "a date you can hold is worth the silence" };
    expect(run(draftWith(), k).ok).toBe(true);
  });

  it("9. a legitimate transparency-versus-privacy pair is ACCEPTED", () => {
    const k = constructionsFor(draftWith());
    k["p1"] = { ...k["p1"], legitimateValue: "transparency with the team", acceptedCost: "narrows what can be said later", competentIntent: "the team can act on what it is told" };
    k["p2"] = { ...k["p2"], legitimateValue: "a confirmed privacy boundary", acceptedCost: "the team reads the silence as distance", competentIntent: "protected information stays protected while the process runs" };
    expect(run(draftWith(), k).ok).toBe(true);
  });

  it("10. an identical label reused in a DIFFERENT branch is not rejected by equality alone", () => {
    const d = draftWith();
    d.branches!.p2.actionDecision.choices[0] = { ...label("p2-a1", "Give a dated recovery plan on the call"), isActionCommitment: true };
    // Same wording as branch 1's action, but the branches' action SETS still differ.
    expect(run(d, constructionsFor(d)).ok).toBe(true);
    expect(detectMeasuredLabelDefects(d, NEUTRAL_FACTS).errors).not.toContain("repeated_action_meaning");
  });

  it("whyNotDominated that merely echoes the label says nothing", () => {
    expect(run(draftWith(), withOverride(draftWith(), "p1", { whyNotDominated: "" })).errors).toContain("dominated_choice");
    const l = draftWith().primary.choices[0].label;
    expect(run(draftWith(), withOverride(draftWith(), "p1", { whyNotDominated: l })).errors).toContain("construction_metadata_generic");
  });

  it("a claimed boundary that was never confirmed is rejected, and a constrained scenario must claim one", () => {
    expect(run(draftWith(), withOverride(draftWith(), "p1", { boundaryCompliance: ["c9_invented"] }), ["c1_real"]).errors).toContain("unsupported_boundary_compliance");
    expect(run(draftWith(), constructionsFor(draftWith()), ["c1_real"]).errors).toContain("unsupported_boundary_compliance");
    expect(run(draftWith(), constructionsFor(draftWith(), ["c1_real"]), ["c1_real"]).ok).toBe(true);
  });

  it("a delay with no stated safety basis is unsupported; with one it is fine", () => {
    const d = draftWith({ actionDecision: { prompt: "What now?", choices: [{ ...label("fa1", "Call the client now and own the miss"), isActionCommitment: true }, { ...label("fa2", "Wait for the confirmation before saying anything"), isActionCommitment: false }] } });
    expect(run(d, withOverride(d, "fa2", { urgencySafetyBasis: "" })).errors).toContain("unsupported_delay_basis");
    expect(run(d, constructionsFor(d)).ok).toBe(true); // the fixture always states a basis
  });
});

// ---------------------------------------------------------------------------
// 11-17. Vague reassurance — measured, with over-reach guards
// ---------------------------------------------------------------------------

describe("measured reassurance defects", () => {
  const defects = (text: string, facts = C01_FACTS) => detectLabelDefects(text, /missed|not yet confirmed/.test(facts));

  it("11. THE c01 DEFECT — claiming the work is on schedule when the facts say it slipped", () => {
    expect(defects("Assure the client that everything is on schedule, but investigate internally")).toContain("false_reassurance");
  });

  it("11b. NEGATIVE — the same claim is NOT false when nothing in the facts says otherwise", () => {
    expect(detectLabelDefects("Confirm to the client that delivery is on schedule", false)).not.toContain("false_reassurance");
  });

  it("12. 'trust the timeline' with nothing actionable behind it", () => {
    expect(defects("Suggest they trust your timeline without further explanation")).toContain("vague_reassurance");
  });

  it("13. 'as soon as possible' with no owner or checkpoint", () => {
    expect(defects("Promise the client an answer as soon as possible")).toContain("vague_reassurance");
  });

  it("14. pacification with no operational commitment", () => {
    expect(defects("Insist on presenting the temporary solution to pacify the client")).toContain("vague_reassurance");
    expect(defects("Continue to deflect questions until the plan lands")).toContain("deflection_without_value");
  });

  it("15. NEGATIVE — a deliberately limited disclosure is a legitimate strategy", () => {
    expect(defects("Tell the team the process is running and that you cannot share protected details")).toEqual([]);
    expect(defects("Share what is confirmed and hold the unverified part until the check completes")).toEqual([]);
  });

  it("16. NEGATIVE — a concise update with ownership and a checkpoint is a legitimate strategy", () => {
    expect(defects("Tell the client what is confirmed and commit to a written update by end of day")).toEqual([]);
    expect(defects("Give the range you can defend and report back once the plan is confirmed")).toEqual([]);
    // Reassurance wording WITH a real commitment attached is not the measured defect.
    expect(defects("Say you will have an answer as soon as possible and set a checkpoint for tomorrow")).toEqual([]);
  });

  it("17. every deterministic rule is scoped to a whole scenario, not just the primary phase", () => {
    const d = draftWith();
    d.branches!.p1.tradeoffChoices[1] = label("p1-t2", "Continue to deflect questions");
    expect(detectMeasuredLabelDefects(d, C01_FACTS).errors).toContain("deflection_without_value");
  });
});

// ---------------------------------------------------------------------------
// c09 repetition + non-persistence
// ---------------------------------------------------------------------------

describe("repetition measured in c09 and c18", () => {
  it("27. THE c09 DEFECT — the same choice offered again one phase later inside a branch", () => {
    const repeated = "검증을 완료할 때까지 기다린다";
    const d = draftWith();
    d.branches!.p1.tradeoffChoices[0] = label("p1-t1", repeated);
    d.branches!.p1.actionDecision.choices[1] = { ...label("p1-a2", repeated), isActionCommitment: false };
    expect(detectMeasuredLabelDefects(d, NEUTRAL_FACTS).errors).toContain("repeated_choice_meaning_within_branch");
  });

  it("27b. the same string in DIFFERENT branches is not within-branch repetition", () => {
    const d = draftWith();
    d.branches!.p1.tradeoffChoices[0] = label("p1-t1", "Hold the line until it is confirmed");
    d.branches!.p2.actionDecision.choices[1] = { ...label("p2-a2", "Hold the line until it is confirmed"), isActionCommitment: false };
    expect(detectMeasuredLabelDefects(d, NEUTRAL_FACTS).errors).not.toContain("repeated_choice_meaning_within_branch");
  });

  it("30. EVERY branch offering an identical action set is collapse", () => {
    const d = draftWith();
    d.branches!.p2.actionDecision.choices = d.branches!.p1.actionDecision.choices.map((c) => ({ ...c, id: c.id.replace("p1", "p2") }));
    expect(detectMeasuredLabelDefects(d, NEUTRAL_FACTS).errors).toContain("repeated_action_meaning");
  });
});

describe("construction metadata never leaves the generation boundary", () => {
  it("35. it is keyed outside the canonical draft, so it can be neither persisted nor rendered", () => {
    const dto = toProviderDto(draftWith());
    const v = validateProviderScenario(dto);
    expect(v.ok).toBe(true);
    const { draft, constructionsByChoiceId } = canonicalizeProviderScenario((v as { value: typeof dto }).value);
    expect(Object.keys(constructionsByChoiceId)).toHaveLength(14);
    const serialized = JSON.stringify(draft);
    for (const key of ["construction", "legitimateValue", "acceptedCost", "competentIntent", "whyNotDominated", "distinguishesFromSibling"]) {
      expect(serialized, `${key} leaked into the persisted draft`).not.toContain(key);
    }
  });

  it("26. the canonical draft keeps exactly its existing shape", () => {
    const dto = toProviderDto(draftWith());
    const { draft } = canonicalizeProviderScenario((validateProviderScenario(dto) as { value: typeof dto }).value);
    expect(Object.keys(draft).sort()).toEqual(["actionDecision", "branches", "opening", "primary", "title", "tradeoff"]);
    expect(Object.keys(draft.primary.choices[0]).sort()).toEqual(["id", "label"]);
    expect(Object.keys(draft.actionDecision.choices[0]).sort()).toEqual(["id", "isActionCommitment", "label"]);
  });
});
