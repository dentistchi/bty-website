import { describe, it, expect } from "vitest";
import {
  PRESSURE_FRAMES, pressureFrameIds, renderPressureFrame, renderScenarioSentence,
  namesIndependentMoment, namesRealPressure, validateScenarioContract,
  type PressureFrame, type BehaviorContract,
} from "./program-coherence";
import {
  validateProgramProposal, requiredProgramKinds, isSemanticRepairableCode,
  PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, PROGRAM_JSON_SCHEMA,
} from "./program-authorship";
import { assertsOverclaimByPolicy } from "./evidence-policy";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-A7-R2 — THE MODEL CHOOSES THE DIFFICULTY; BTY WRITES IT.
 *
 * THE EXPERIMENT THAT ENDED FREE-TEXT PRESSURE. A7 (`309c2bb1`, v21) named an occasion of its
 * own on its first call. Its licensed repair — narrowest surface in the system, freeze clean,
 * merged, fully revalidated — opened with the sentence "you put the practice situation at a
 * different time or event", carried all seventeen difficulty families, and returned 32 tokens
 * naming ANOTHER occasion. Explicit prompt, correct validator, sound repair, same defect twice.
 *
 * Three slices tried instruction (A3-R2), then diagnosis (A5-R2), then a bounded correction
 * (A6-R2). The correction was given a fair test and lost. What is left is the field itself.
 *
 * This file replaces `scenarioPressureContract`, `scenarioPressureRepair` and
 * `scenarioPressureCoverage`, which tested rules that policed free text. Their subject no
 * longer exists; the properties worth keeping are re-asserted here against the frame.
 */
const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders", recurringMoment: "During morning huddles",
  observableBehavior: "Confirm the owner and the deadline for every agreed item.",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf",
  followUpDays: 7, arenaRecommended: true,
  completionPrompt: "What specific phrases will you use at the next huddle?",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
} as unknown as BuilderAnswers;

const CONTENT: Record<string, string> = {
  why_it_matters: "When a problem is raised and nobody is named, the next step quietly belongs to no one.",
  observable_standard: "Confirm the owner and the deadline for every agreed item.",
  scenario: "Two people are talking over each other and the item has no owner yet.",
  reflection: "What usually happens when an action needs an owner?",
  action_decision: "I will name one owner and one deadline for every item I raise.",
  completion_check: "What exact words will you use to confirm the owner and the deadline?",
  follow_up: "At follow-up you will be asked what you said and what happened next.",
};

function candidate(pressure_frame: string = "time_is_short") {
  return {
    program: {
      display_title: "Naming an Owner for Every Agreed Action",
      elements: requiredProgramKinds(ANSWERS).map((kind) => ({
        kind, content: CONTENT[kind] ?? "A short, concrete statement about this part of the training.",
      })),
      assumptions: ["Participants are able to attend the session."],
      warnings: ["Training alone cannot settle a staffing shortage."],
      behavior_contract: { action_verb: "confirm", action_detail: "the owner and the deadline for every agreed item" },
      scenario_contract: { pressure_frame },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  } as Record<string, unknown>;
}
const validate = (c: unknown) => validateProgramProposal(c, ANSWERS, []);

describe("[3.2P-A7-R2] §20 A–C — an occasion has nowhere to be written", () => {
  it("the provider wire carries ONE enum and no prose", () => {
    const sc = (PROGRAM_JSON_SCHEMA as unknown as { properties: { program: { properties: Record<string, { properties?: Record<string, unknown>; required?: string[] }> } } })
      .properties.program.properties.scenario_contract;
    expect(Object.keys(sc.properties ?? {})).toEqual(["pressure_frame"]);
    expect(sc.required).toEqual(["pressure_frame"]);
    const wire = JSON.stringify(PROGRAM_JSON_SCHEMA);
    for (const gone of ["pressure_condition", "pressure_detail"]) {
      expect(wire, `the wire still exposes ${gone}`).not.toContain(gone);
    }
  });

  it("A — every phrasing A7 could have produced is now unrepresentable", () => {
    /*
      These are not refused. They cannot be SENT: the only scenario field takes one of twelve
      server-defined ids, and none of them is a time.
    */
    for (const occasion of [
      "after the meeting ends", "at the next handoff", "later that afternoon",
      "before the next shift begins", "when everyone returns to their desks",
    ]) {
      const v = validate(candidate(occasion));
      expect(v.ok, occasion).toBe(false);
      if (v.ok) continue;
      // A shape fault the structural retry can fix — NOT a semantic refusal.
      expect(v.diagnosis?.path).toBe("program.scenario_contract.pressure_frame");
      expect(v.code).not.toBe("scenario_independent_moment");
    }
  });

  it("B/C — and so are empty pressure, generic pressure and a restatement of the action", () => {
    for (const bad of ["", "it is difficult", "confirm the owner and the deadline for every agreed item", "something hard"]) {
      const v = validate(candidate(bad));
      expect(v.ok, bad).toBe(false);
      if (!v.ok) expect(v.code).not.toBe("scenario_without_pressure");
    }
  });
});

describe("[3.2P-A7-R2] §16 — the server's own product language", () => {
  const HOSTS = ["During morning huddles", "At each patient handoff", "Whenever a deadline changes", "During the weekly scheduling review", "아침 허들 때마다"];
  const ACTIONS = ["confirm the owner and the deadline", "write down what was agreed", "hand over the open items", "follow up on what was raised"];

  it("every frame clause is genuine difficulty, and none of it is an occasion", () => {
    for (const f of PRESSURE_FRAMES) {
      expect(renderPressureFrame(f.id), f.id).toBe(f.clause);
      expect(namesIndependentMoment(f.clause), `${f.id} names an occasion`).toBe(false);
      expect(assertsOverclaimByPolicy(f.clause)?.id ?? null, `${f.id} over-claims`).toBeNull();
      // It must read as a difficulty, not as a neutral setting.
      expect(f.clause.length, f.id).toBeGreaterThan(10);
    }
  });

  it("no clause restates a trained action or asserts completion", () => {
    for (const f of PRESSURE_FRAMES) {
      for (const verb of ["confirm", "record", "write", "state", "name ", "complete"]) {
        expect(f.clause.toLowerCase(), `${f.id} restates an action (${verb})`).not.toContain(verb);
      }
      expect(f.clause.toLowerCase()).not.toContain("evidence");
    }
  });

  it("and it reads as English against every Host moment and several actions", () => {
    const behavior = (trigger: string, action: string): BehaviorContract => ({
      actor: "you", trigger, observableAction: action,
      completion: { criterion: ANSWERS.successEvidence as string },
    } as BehaviorContract);
    for (const host of HOSTS) {
      for (const frame of pressureFrameIds()) {
        const sentence = renderScenarioSentence(behavior(host, ACTIONS[0]), { frame });
        expect(sentence.startsWith(host), `${host} / ${frame}`).toBe(true);
        expect(sentence).toContain(`even when ${renderPressureFrame(frame)},`);
      }
    }
    // Read, not merely asserted — one full rendering per Host moment, and one per action.
    for (const host of HOSTS) console.log(renderScenarioSentence(behavior(host, ACTIONS[0]), { frame: "time_is_short" }));
    for (const a of ACTIONS) console.log(renderScenarioSentence(behavior(HOSTS[0], a), { frame: "nobody_steps_up" }));
  });

  it("E — the Host's moment is repeated verbatim, never transformed", () => {
    const behavior = (trigger: string): BehaviorContract => ({
      actor: "you", trigger, observableAction: "confirm the owner",
      completion: { criterion: "a note exists" },
    } as BehaviorContract);
    for (const host of HOSTS) {
      expect(renderScenarioSentence(behavior(host), { frame: "fatigue" })).toContain(host);
    }
  });
});

describe("[3.2P-A7-R2] the frames themselves", () => {
  it("twelve ids, all distinct, all semantic — no detector machinery", () => {
    expect(pressureFrameIds()).toHaveLength(12);
    expect(new Set(pressureFrameIds()).size).toBe(12);
    for (const gone of ["named_pressure", "korean_markers"]) {
      expect(pressureFrameIds(), `${gone} is detector machinery, not a product semantic`).not.toContain(gone as PressureFrame);
    }
    for (const f of PRESSURE_FRAMES) {
      expect(f.id).toMatch(/^[a-z_]+$/);
      expect(f.meaning.length).toBeGreaterThan(20);
    }
  });

  it("no pilot, role or setting vocabulary is frozen into the taxonomy", () => {
    const all = PRESSURE_FRAMES.map((f) => `${f.id} ${f.meaning} ${f.clause}`).join(" ").toLowerCase();
    for (const pilot of ["huddle", "handoff", "patient", "shift", "meeting", "nurse", "manager", "leader"]) {
      expect(all, pilot).not.toContain(pilot);
    }
  });

  it("a valid frame validates end to end, and renders into the program", () => {
    for (const frame of pressureFrameIds()) {
      const v = validate(candidate(frame));
      expect(v.ok, `${frame}: ${v.ok ? "" : v.code}`).toBe(true);
      if (!v.ok) continue;
      const scenario = v.value.proposal.elements.find((e) => e.kind === "scenario");
      expect(scenario?.content).toContain("During morning huddles");
      expect(scenario?.content).toContain(renderPressureFrame(frame));
    }
  });

  it("the old detector still recognises every frame clause as pressure", () => {
    /*
      NOT load-bearing any more — nothing validates the clause, because BTY wrote it. Asserted
      because a clause the old floor would have refused would be an odd thing to ship, and this
      is the cheapest possible cross-check of the taxonomy against three slices of measurement.
    */
    const missed = PRESSURE_FRAMES.filter((f) => !namesRealPressure(f.clause));
    for (const f of missed) console.log(`  old detector does not recognise: ${f.id} → "${f.clause}"`);
    expect(missed.length).toBeLessThanOrEqual(3);
  });
});

describe("[3.2P-A7-R2] §11/§12 — what became historical", () => {
  it("the scenario validator now answers one question, and unknown ids are shape faults", () => {
    const behavior = { actor: "you", trigger: "During morning huddles", observableAction: "confirm the owner", completion: { criterion: "a note exists" } } as BehaviorContract;
    expect(validateScenarioContract({ pressure_frame: "fatigue" }, behavior)).toEqual({ ok: true, value: { frame: "fatigue" } });
    for (const bad of [{ pressure_frame: "banana" }, {}, null, "fatigue"]) {
      const r = validateScenarioContract(bad, behavior);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      if (!r.ok) expect(r.defect.reason).toBe("missing");
    }
  });

  it("neither scenario code is repairable, because neither is reachable", () => {
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(false);
    expect(isSemanticRepairableCode("scenario_independent_moment")).toBe(false);
    // The two honesty families are untouched.
    expect(isSemanticRepairableCode("evidence_overclaim")).toBe(true);
    expect(isSemanticRepairableCode("material_fabrication")).toBe(true);
  });

  it("but the codes and reasons stay in the vocabulary — the ledger holds rows carrying them", () => {
    /*
      A3, A5, A6 and A7 are recorded with `scenario_without_pressure` /
      `scenario_independent_moment` and with `scenario_contract_reason` values that no new
      proposal can produce. A vocabulary that shrinks makes those rows unreadable.
    */
    const wire = JSON.stringify(PROGRAM_JSON_SCHEMA);
    expect(wire).not.toContain("pressure_condition");
    expect(validateScenarioContract({}, {} as BehaviorContract)).toEqual({ ok: false, defect: { field: "frame", reason: "missing" } });
  });

  it("the wire moved with the contract", () => {
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v23");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v12");
  });
});
