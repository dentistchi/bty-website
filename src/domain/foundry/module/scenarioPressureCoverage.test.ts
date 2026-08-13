import { describe, it, expect } from "vitest";
import { namesRealPressure, namesIndependentMoment, SCENARIO_PRESSURE_POLICY, scenarioPressurePromptLines } from "./program-coherence";

/**
 * SLICE 3.2P-A3-R2 — ORDINARY DIFFICULTY IS STILL DIFFICULTY.
 *
 * A3's chain started here. Child 1 was refused `scenario_without_pressure`; the licensed patch
 * then asked for "a real constraint of one of these kinds" from a narrow list, and the repaired
 * pressure named a different occasion — which the moment floor correctly caught. The moment floor
 * measured precision 1.00 and is not the defect. The pressure floor is: it rejected NINE of
 * twenty legitimate in-occasion pressures, including "the huddle is running over time" and "two
 * people are talking over each other".
 *
 * A model steered away from ordinary meeting difficulty has fewer places to go, and one of the
 * remaining ones is a second occasion.
 *
 * This corpus is the floor's acceptance test. It is labelled by SEMANTICS — is this a
 * circumstance inside the occasion that makes the behaviour harder? — never by vocabulary, and
 * it deliberately contains temporal words that must NOT be read as relocation.
 */
const PRESSURE: [string, string][] = [
  // TIME / PACE
  ["only two minutes remain", "time"],
  ["the huddle is running over time", "time"],
  ["people are already standing to leave", "time"],
  ["the next appointment is waiting", "time"],
  ["the group wants to finish quickly", "time"],
  // COMPETING ATTENTION
  ["several issues are being discussed at once", "attention"],
  ["people are checking messages", "attention"],
  ["someone is distracted by an urgent patient", "attention"],
  ["two people are talking over each other", "attention"],
  // SOCIAL HESITATION
  ["nobody volunteers to own the issue", "hesitation"],
  ["people avoid naming who will take it", "hesitation"],
  ["one person hesitates to assign a peer", "hesitation"],
  ["the room goes quiet when ownership is asked for", "hesitation"],
  // INTERRUPTION
  ["someone interrupts with an urgent issue", "interruption"],
  ["another topic is raised before the current one is resolved", "interruption"],
  ["questions keep breaking the flow", "interruption"],
  // UNCERTAINTY / AMBIGUITY
  ["two people think the other person owns it", "ambiguity"],
  ["the next step is unclear", "ambiguity"],
  ["several possible owners are named", "ambiguity"],
  ["nobody is sure which deadline applies", "ambiguity"],
  // WORKLOAD / QUEUE
  ["several unresolved items remain", "workload"],
  ["more issues are raised than the group can discuss", "workload"],
  ["the team is already behind", "workload"],
  // RESISTANCE / DISAGREEMENT
  ["someone pushes back on taking ownership", "resistance"],
  ["two people disagree about the next step", "resistance"],
  ["the group wants to move on without deciding", "resistance"],
  // FATIGUE
  ["the group is tired near the end", "fatigue"],
  ["attention is fading", "fatigue"],
  // ABSENCE / STAFFING
  ["the usual owner is absent", "absence"],
  ["the person with context is not there", "absence"],
  ["coverage is thin", "absence"],
  // TEMPORAL WORDS THAT STAY INSIDE THE OCCASION
  ["someone raises a problem before anyone has finished speaking", "inside/temporal"],
  ["people keep checking the time while the list is read out", "inside/temporal"],
  ["one item is raised after another with no pause", "inside/temporal"],
  ["everyone is watching the clock during the update", "inside/temporal"],
  ["the next speaker starts before the last item is settled", "inside/temporal"],
];

const NOT_PRESSURE: [string, string][] = [
  // NEUTRAL DESCRIPTION
  ["the team is in a morning huddle", "neutral"],
  ["several people are present", "neutral"],
  ["the agenda is on the screen", "neutral"],
  ["the manager is speaking", "neutral"],
  // ACTION RESTATEMENT
  ["state the owner and deadline", "restatement"],
  ["write the owner in the note", "restatement"],
  ["confirm the next action", "restatement"],
  // OUTCOME / COMPLETION
  ["the note shows an owner", "outcome"],
  ["every item has a deadline", "outcome"],
];

/** Relocation is a SEPARATE question — these must stay refused by the moment floor. */
const SECOND_OCCASION = [
  "after the huddle ends",
  "later that afternoon",
  "at the next meeting",
  "before the shift starts",
  "when everyone returns to their desks",
];

describe("[3.2P-A3-R2] the pressure floor recognises ordinary difficulty", () => {
  it("every legitimate in-occasion pressure is recognised", () => {
    const missed = PRESSURE.filter(([t]) => !namesRealPressure(t));
    const tp = PRESSURE.length - missed.length;
    console.log(`PRESSURE  tp=${tp} fn=${missed.length} of ${PRESSURE.length}  recall=${(tp / PRESSURE.length).toFixed(2)}`);
    for (const [t, family] of missed) console.log(`  MISSED (${family}) ${JSON.stringify(t)}`);
    expect(missed.map(([t]) => t), "every labelled pressure must be recognised").toEqual([]);
  });

  it("and nothing that is NOT pressure sneaks in", () => {
    /*
      THE REAL RISK OF WIDENING. A pressure floor that accepts any difficult-sounding sentence
      stops being a floor. Neutral setting description, a restatement of the trained action, and
      a completion claim must all still fail — the first two are what `scenario_without_pressure`
      and `restates_action` exist for.
    */
    const wrong = NOT_PRESSURE.filter(([t]) => namesRealPressure(t));
    for (const [t, why] of wrong) console.log(`  FALSE POSITIVE (${why}) ${JSON.stringify(t)}`);
    expect(wrong.map(([t]) => t)).toEqual([]);
  });

  it("M — temporal words are judged by shape, and never relocate on their own", () => {
    for (const [t] of PRESSURE.filter(([, f]) => f === "inside/temporal")) {
      expect(namesRealPressure(t), t).toBe(true);
      expect(namesIndependentMoment(t), t).toBe(false);
    }
  });

  it("L/8 — recognising pressure never overrides the moment floor", () => {
    /*
      The two questions stay separate and ordered: a phrase can describe real difficulty AND
      still be invalid because it moves the scenario. Widening what counts as pressure must not
      make a second occasion acceptable — so this asserts the moment floor is UNCHANGED, not that
      it is complete.

      ITS MEASURED RECALL GAP IS LEFT ALONE, deliberately (3.2P-A3-R2 §1). "later that afternoon"
      and "when everyone returns to their desks" are relocations the floor does not catch. It is
      conservative and high-precision — 1.00 across 27 phrases — and widening it on a recall
      argument is how a high-precision floor starts refusing real work. Recorded here so the gap
      is a known state rather than a surprise.
    */
    const caught = SECOND_OCCASION.filter((t) => namesIndependentMoment(t));
    const missed = SECOND_OCCASION.filter((t) => !namesIndependentMoment(t));
    expect(caught).toEqual(["after the huddle ends", "at the next meeting", "before the shift starts"]);
    expect(missed, "known, unchanged recall gap").toEqual(["later that afternoon", "when everyone returns to their desks"]);
  });
});

describe("[3.2P-A3-R2] N — one policy, two consumers", () => {
  it("every family reaches the prompt, and every prompt line comes from a family", () => {
    const lines = scenarioPressurePromptLines();
    expect(lines).toHaveLength(SCENARIO_PRESSURE_POLICY.length);
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(lines.some((l) => l.includes(f.promptLine)), f.id).toBe(true);
    }
  });

  it("every family's own example survives its own pattern — no validator-only family", () => {
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(f.pattern.test(f.example), `${f.id}: ${f.example}`).toBe(true);
      expect(namesRealPressure(f.example), f.id).toBe(true);
      // …and a family may never offer the model something the moment floor then refuses.
      expect(namesIndependentMoment(f.example), `${f.id} offers a second occasion`).toBe(false);
    }
  });
});

import { semanticRepairInstruction, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, repairPatchContract, repairLicenseFor } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

const ANSWERS = {
  problem: "During morning huddles, team members leave without naming who will act.",
  audienceType: "leaders", recurringMoment: "During morning huddles",
  observableBehavior: "Confirm the owner and the deadline.", successEvidence: "The huddle note records one owner.",
  learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf", followUpDays: 7, arenaRecommended: true,
} as unknown as BuilderAnswers;

describe("[3.2P-A3-R2] O/P — the repair instructions describe the contract that exists", () => {
  const SEMANTIC = ["scenario_without_pressure", "material_fabrication", "evidence_overclaim"] as const;

  it("O — no semantic repair instruction still asks for a whole program", () => {
    /*
      A1-R3 retired the whole-program retry; these instructions kept describing it. A3's repair
      returned 32 tokens because it followed the SCHEMA, not this text — but telling a model to
      preserve fields it is never sent implies the response should contain them.
    */
    for (const code of SEMANTIC) {
      const t = semanticRepairInstruction(code, ANSWERS);
      expect(t, code).toContain("the response shape contains those fields and nothing else");
      for (const stale of [
        "Return the SAME program",
        "Do NOT add, remove, rename or reorder any element",
        "Do NOT touch the title, the assumptions, the warnings",
        "Leave every other field and every element exactly as they were",
      ]) {
        expect(t, `${code} still says: ${stale}`).not.toContain(stale);
      }
    }
  });

  it("the scenario-pressure repair states the moment rule and offers the whole policy", () => {
    const t = semanticRepairInstruction("scenario_without_pressure", ANSWERS);
    expect(t).toContain("still happens at the host's own moment");
    expect(t).toContain("never moves the learner to a different one");
    expect(t).toContain("a difficulty inside the moment, never a second moment");
    // N — the same single policy the validator reads.
    for (const f of SCENARIO_PRESSURE_POLICY) expect(t, f.id).toContain(f.promptLine);
  });

  it("Q — the repair patch shapes are unchanged; only prose and policy moved", () => {
    expect(repairPatchContract(repairLicenseFor("scenario_without_pressure", "scenario"))!.name)
      .toBe("bty_guided_program_repair_scenario_pressure_v1");
    expect(Object.keys(repairPatchContract({ surface: "narrative" })!.schema.properties as object))
      .toEqual(["display_title", "assumptions", "warnings"]);
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v20");
  });
});
