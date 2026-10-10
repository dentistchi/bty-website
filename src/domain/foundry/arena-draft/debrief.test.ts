import { describe, it, expect } from "vitest";
import { buildScenarioDebrief, debriefForPath, parseScenarioDebrief, type ScenarioDebrief } from "./debrief";
import { enumerateChoices } from "./choiceConstruction";
import { parseArenaScenarioDraft } from "./validate";
import { publishableSnapshot } from "./publish";
import type { ArenaScenarioDraft } from "./types";

/**
 * PRACTICE DEBRIEF V1 — the FEEDBACK after the TRY.
 *
 * The generator already constructs every choice on a legitimate value and a real cost, the gates
 * refuse placeholders and bad faith, and the reviewer checks them — then the record was discarded
 * and the learner's Practice ended on "nothing here counts against you". These tests pin what is
 * kept (value + cost, nothing else), when it is kept (all-or-nothing, same language as the scenario,
 * still describing the label the learner sees), and what a learner gets for the path they walked.
 */

const BRANCHED: ArenaScenarioDraft = {
  title: "Opening with a missing kit",
  opening: "The emergency kit is missing its oxygen mask and the first patient is in the chair.",
  primary: { choices: [{ id: "p1", label: "Tell the office manager now and hold the first patient" }, { id: "p2", label: "Check the back room first, then decide" }] },
  tradeoff: { escalationText: "Flat escalation.", choices: [{ id: "ft1", label: "flat one" }, { id: "ft2", label: "flat two" }] },
  actionDecision: { prompt: "Flat prompt", choices: [{ id: "fa1", label: "flat act", isActionCommitment: true }, { id: "fa2", label: "flat wait", isActionCommitment: false }] },
  branches: {
    p1: {
      escalationText: "The patient's parent asks why they are waiting.",
      tradeoffChoices: [{ id: "b1t1", label: "Explain the delay plainly" }, { id: "b1t2", label: "Offer to reschedule" }],
      actionDecision: { prompt: "Next?", choices: [{ id: "b1a1", label: "Log the gap and start once replaced", isActionCommitment: true }, { id: "b1a2", label: "Wait for the manager's call", isActionCommitment: false }] },
    },
    p2: {
      escalationText: "The back room has no spare mask either.",
      tradeoffChoices: [{ id: "b2t1", label: "Stop the schedule now" }, { id: "b2t2", label: "Borrow from the next office" }],
      actionDecision: { prompt: "Next?", choices: [{ id: "b2a1", label: "Call the manager now", isActionCommitment: true }, { id: "b2a2", label: "Send one runner first", isActionCommitment: false }] },
    },
  },
};

function constructionsFor(draft: ArenaScenarioDraft, over: Record<string, Record<string, unknown>> = {}) {
  const out: Record<string, Record<string, unknown>> = {};
  for (const c of enumerateChoices(draft)) {
    out[c.id] = {
      legitimateValue: `safety of ${c.id}`,
      acceptedCost: `the patient waits longer for ${c.id}`,
      competentIntent: "a private justification",
      concreteAction: "a private action",
      boundaryCompliance: [],
      urgencySafetyBasis: "",
      whyNotDominated: "private",
      distinguishesFromSibling: "private",
      ...(over[c.id] ?? {}),
    };
  }
  return out;
}

describe("[Debrief · B1-B6] building from an accepted generation", () => {
  it("B1 keeps value + cost for every choice, bound to its label, and nothing else", () => {
    const d = buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED))!;
    expect(Object.keys(d).sort()).toEqual(enumerateChoices(BRANCHED).map((c) => c.id).sort());
    expect(d.b1t2).toEqual({ forLabel: "Offer to reschedule", protects: "safety of b1t2", costs: "the patient waits longer for b1t2" });
    expect(JSON.stringify(d)).not.toContain("private");
  });

  it("B2 all-or-nothing — one choice without a usable value or cost means no debrief at all", () => {
    expect(buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED, { b2a2: { acceptedCost: "  " } }))).toBeNull();
    expect(buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED, { p1: { legitimateValue: 7 } }))).toBeNull();
    const missing = constructionsFor(BRANCHED);
    delete missing.ft2;
    expect(buildScenarioDebrief(BRANCHED, missing)).toBeNull();
  });

  it("B3 no constructions at all → null, never a throw", () => {
    expect(buildScenarioDebrief(BRANCHED, undefined)).toBeNull();
    expect(buildScenarioDebrief(BRANCHED, null)).toBeNull();
    expect(buildScenarioDebrief(BRANCHED, "x")).toBeNull();
  });

  it("B4 over-length reasoning is refused, not trimmed", () => {
    expect(buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED, { p1: { legitimateValue: "x".repeat(61) } }))).toBeNull();
  });

  it("B5 a Korean scenario with English reasoning gets no debrief (and vice versa)", () => {
    const ko: ArenaScenarioDraft = { ...BRANCHED, title: "응급 키트 없이 문 열기", opening: "응급 키트에 산소 마스크가 없습니다." };
    expect(buildScenarioDebrief(ko, constructionsFor(ko))).toBeNull();
    const koReasons = Object.fromEntries(
      enumerateChoices(ko).map((c) => [c.id, { legitimateValue: "환자 안전", acceptedCost: "첫 환자가 더 기다린다" }]),
    );
    expect(buildScenarioDebrief(ko, koReasons)!.p1).toEqual({ forLabel: ko.primary.choices[0].label, protects: "환자 안전", costs: "첫 환자가 더 기다린다" });
    expect(buildScenarioDebrief(BRANCHED, koReasons)).toBeNull();
  });

  it("B6 trims what it keeps", () => {
    const d = buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED, { p1: { legitimateValue: "  safety  " } }))!;
    expect(d.p1.protects).toBe("safety");
  });
});

describe("[Debrief · P1-P5] the stored value survives only while it is still true", () => {
  const debrief = buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED))!;

  it("P1 parseArenaScenarioDraft carries a valid debrief into the normalized draft", () => {
    const r = parseArenaScenarioDraft({ ...BRANCHED, debrief });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.debrief).toEqual(debrief);
  });

  it("P2 the published snapshot keeps it — publish freezes the parser's output", () => {
    const r = publishableSnapshot({ ...BRANCHED, debrief });
    expect(r.ok && r.snapshot.debrief).toEqual(debrief);
  });

  it("P3 a Host-edited label drops ONLY that choice's entry", () => {
    const edited = structuredClone({ ...BRANCHED, debrief });
    edited.branches!.p1.tradeoffChoices[1].label = "Offer a new time today";
    const r = parseArenaScenarioDraft(edited);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.debrief!.b1t2).toBeUndefined();
    expect(r.value.debrief!.b1t1).toBeDefined();
  });

  it("P4 a malformed debrief never blocks the scenario — it is simply dropped", () => {
    for (const bad of ["x", 3, [], { p1: "x" }, { p1: { forLabel: 1, protects: "a", costs: "b c" } }]) {
      const r = parseArenaScenarioDraft({ ...BRANCHED, debrief: bad });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.debrief).toBeUndefined();
    }
  });

  it("P5 entries for ids the scenario does not contain are not carried", () => {
    const withGhost = { ...debrief, ghost: { forLabel: "ghost", protects: "x", costs: "y z" } } as ScenarioDebrief;
    expect(parseScenarioDebrief(withGhost, BRANCHED)!.ghost).toBeUndefined();
  });
});

describe("[Debrief · W1-W5] what the learner gets for the path they walked", () => {
  const scenario: ArenaScenarioDraft = { ...BRANCHED, debrief: buildScenarioDebrief(BRANCHED, constructionsFor(BRANCHED))! };

  it("W1 one view per decision, in order, each beside the option not taken", () => {
    const v = debriefForPath(scenario, { primaryChoiceId: "p2", tradeoffChoiceId: "b2t1", actionChoiceId: "b2a2" });
    expect(v.map((s) => s.stage)).toEqual(["primary", "tradeoff", "action"]);
    expect(v[0].chosen.label).toBe("Check the back room first, then decide");
    expect(v[0].other!.label).toBe("Tell the office manager now and hold the first patient");
    expect(v[1].chosen.protects).toBe("safety of b2t1");
    expect(v[1].other!.protects).toBe("safety of b2t2");
    expect(v[2].chosen.costs).toBe("the patient waits longer for b2a2");
  });

  it("W2 the branch the learner did NOT walk never appears", () => {
    const text = JSON.stringify(debriefForPath(scenario, { primaryChoiceId: "p1", tradeoffChoiceId: "b1t1", actionChoiceId: "b1a1" }));
    expect(text).not.toContain("b2");
  });

  it("W3 no debrief, or no path, means nothing to show", () => {
    expect(debriefForPath(BRANCHED, { primaryChoiceId: "p1", tradeoffChoiceId: "b1t1", actionChoiceId: "b1a1" })).toEqual([]);
    expect(debriefForPath(scenario, {})).toEqual([]);
  });

  it("W4 a stale label is not explained even if it reaches the player unparsed (Host test preview)", () => {
    const edited = structuredClone(scenario);
    edited.primary.choices[0].label = "Something the Host rewrote";
    const v = debriefForPath(edited, { primaryChoiceId: "p1", tradeoffChoiceId: "b1t1", actionChoiceId: "b1a1" });
    expect(v.map((s) => s.stage)).toEqual(["tradeoff", "action"]);
  });

  it("W5 a legacy flat scenario walks the flat continuation", () => {
    const flat: ArenaScenarioDraft = { ...BRANCHED, branches: undefined };
    const withDebrief = { ...flat, debrief: buildScenarioDebrief(flat, constructionsFor(flat))! };
    const v = debriefForPath(withDebrief, { primaryChoiceId: "p1", tradeoffChoiceId: "ft2", actionChoiceId: "fa1" });
    expect(v.map((s) => s.chosen.label)).toEqual(["Tell the office manager now and hold the first patient", "flat two", "flat act"]);
  });
});
