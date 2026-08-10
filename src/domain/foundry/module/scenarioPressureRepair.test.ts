import { describe, it, expect } from "vitest";
import {
  isSemanticRepairableCode,
  scenarioRepairFreezeViolated,
  semanticRepairInstruction,
  validateProgramProposal,
} from "./program-authorship";
import { SCENARIO_PRESSURE_POLICY, scenarioPressurePromptLines } from "./program-coherence";

/**
 * SLICE 3.2O-R4 — ONE BOUNDED REPAIR FOR ONE ISOLATED FAULT.
 *
 * `scenario_without_pressure` is the code for EVERY scenario defect except
 * `independent_moment` — a weak pressure, a generic one, one that restates the action, and a
 * too-long detail all land on it. Measured: every one of those defects lives in
 * `scenario_contract`'s two pressure fields, and none of them touches the actor, the trigger
 * or the trained action, which live in `behavior_contract`. THAT is what makes this class
 * repairable and its sibling `scenario_independent_moment` not: a second occasion can mean
 * the scenario was built around the wrong moment, which is not one phrase away from right.
 *
 * A licence to fix one field is worth nothing without enforcement, so the repair is frozen
 * deterministically. These tests are that enforcement's proof. Zero provider calls.
 */
const ANSWERS = {
  problem: "No confirmation calls made",
  observableBehavior: "Employees make a confirmation call and follow a checklist of required questions.",
  successEvidence: "A checklist is completed and submitted after each call, with supervisor verification.",
  learningNeeds: ["shared_standard", "practice", "decide"],
  materialIntent: "youtube",
  materialText: "x".repeat(48),
  completionPrompt: "Describe how you will use the checklist on your next confirmation call.",
  audienceType: "job_group",
  audienceDetail: "Admin",
  evidenceType: "confirmed",
  followUpDays: 7,
  arenaRecommended: true,
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  capabilityCandidate: "Process Adherence",
} as never;

const KINDS = [
  "why_it_matters", "observable_standard", "scenario", "reflection",
  "action_decision", "field_application", "completion_check", "follow_up",
];

/** One whole proposal, with the scenario pressure under test. */
const proposal = (pressureCondition: string, over: Record<string, unknown> = {}) => ({
  program: {
    display_title: "Confirmation calls that land",
    elements: KINDS.map((k) => ({ kind: k, content: `A grounded sentence for ${k} that the team would read.`, rationale: "grounded" })),
    assumptions: ["staff can reach the person before the appointment"],
    warnings: ["an out-of-date phone list needs fixing, not training"],
    behavior_contract: {
      actor: "Front desk staff",
      trigger: "before each scheduled appointment",
      observable_action: "make a confirmation call and follow the checklist of required questions",
      completion: { confirmed_by: "the supervisor", confirmation_action: "review the completed checklist" },
    },
    scenario_contract: { pressure_condition: pressureCondition, pressure_detail: "the phone list is out of date" },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    ...over,
  },
});

const verdict = (p: unknown) => {
  const r = validateProgramProposal(p, ANSWERS, []);
  return r.ok ? "PASS" : `${r.code}${r.kind ? "/" + r.kind : ""}`;
};

/** The exact failing shape: real words, no recognised constraint. */
const BEFORE = proposal("the workload is heavy and staff are managing many tasks");

describe("[3.2O-R4] the fault is isolated to ONE field", () => {
  it("the repairable set is exactly the three authorised codes", () => {
    expect(isSemanticRepairableCode("evidence_overclaim")).toBe(true);
    expect(isSemanticRepairableCode("material_fabrication")).toBe(true);
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(true);
    // Everything else stays terminal — especially the sibling scenario refusal.
    for (const code of [
      "scenario_independent_moment", "dependency_inversion", "scenario_unrelated",
      "application_moment_unrelated", "non_observable_standard", "field_type",
      "generic_completion", "complaint_replay", "trigger_not_recurring",
    ] as const) {
      expect(isSemanticRepairableCode(code), code).toBe(false);
    }
  });

  it("the baseline really does fail on pressure alone", () => {
    expect(verdict(BEFORE)).toBe("scenario_without_pressure/scenario");
  });
});

describe("[3.2O-R4] the repair instruction is derived, never hand-listed", () => {
  const instruction = semanticRepairInstruction("scenario_without_pressure", ANSWERS);

  it("carries every canonical pressure family, from the one authority", () => {
    for (const f of SCENARIO_PRESSURE_POLICY) expect(instruction, f.id).toContain(f.promptLine);
    for (const line of scenarioPressurePromptLines()) expect(instruction).toContain(line.trim());
  });

  it("names the editable fields and freezes the rest in words too", () => {
    expect(instruction).toMatch(/ONLY the scenario pressure fields/i);
    expect(instruction).toMatch(/pressure_condition/);
    expect(instruction).toMatch(/every other field and every element exactly as they were/i);
    expect(instruction).toMatch(/same actor, the same trigger and the same trained action/i);
    expect(instruction).toMatch(/never a second moment/i);
    expect(instruction).toMatch(/Do NOT restate the trained action/i);
  });

  it("does not leak into the other repair classes", () => {
    for (const code of ["evidence_overclaim", "material_fabrication"] as const) {
      expect(semanticRepairInstruction(code, ANSWERS)).not.toMatch(/pressure_condition/);
    }
  });
});

describe("[3.2O-R4] the repair fixture matrix", () => {
  it("A — valid canonical pressure → PASS, for every family", () => {
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(verdict(proposal(f.example)), `${f.id} :: ${f.example}`).toBe("PASS");
      expect(scenarioRepairFreezeViolated(BEFORE, proposal(f.example)), f.id).toBe(false);
    }
  });

  it("B — repair alters the trained behaviour → FROZEN OUT", () => {
    const after = proposal("a queue is building at the desk", {
      behavior_contract: {
        actor: "Front desk staff", trigger: "before each scheduled appointment",
        observable_action: "send a confirmation text instead",
        completion: { confirmed_by: "the supervisor", confirmation_action: "review the completed checklist" },
      },
    });
    expect(scenarioRepairFreezeViolated(BEFORE, after)).toBe(true);
  });

  it("C — repair alters the scenario trigger → FROZEN OUT", () => {
    const after = proposal("a queue is building at the desk", {
      behavior_contract: {
        actor: "Front desk staff", trigger: "at each weekly huddle",
        observable_action: "make a confirmation call and follow the checklist of required questions",
        completion: { confirmed_by: "the supervisor", confirmation_action: "review the completed checklist" },
      },
    });
    expect(scenarioRepairFreezeViolated(BEFORE, after)).toBe(true);
  });

  it("D — repair adds a second occasion → still refused by the validator", () => {
    expect(verdict(proposal("a queue is building during the next call"))).toBe("scenario_independent_moment/scenario");
  });

  it("E — repair restates the trained action → still refused", () => {
    /*
      `restates_action` shares the `scenario_without_pressure` CODE: every scenario defect
      except `independent_moment` maps to it. That is why the repair instruction forbids
      restating the action as well as demanding a real constraint.
    */
    expect(verdict(proposal("staff make a confirmation call and follow the checklist of required questions")))
      .toBe("scenario_without_pressure/scenario");
  });

  it("F — repair still names no pressure → still refused, and no second repair follows", () => {
    // No artifact noun: "records" would trip the material-fabrication gate first, which is
    // correct behaviour and a different refusal than the one under test here.
    expect(verdict(proposal("the team works hard and keeps everything moving along")))
      .toBe("scenario_without_pressure/scenario");
  });

  it("G — repair edits another element → FROZEN OUT", () => {
    const after = proposal("a queue is building at the desk", {
      elements: KINDS.map((k) => ({
        kind: k,
        content: k === "reflection" ? "A completely different reflection the model rewrote." : `A grounded sentence for ${k} that the team would read.`,
        rationale: "grounded",
      })),
    });
    expect(scenarioRepairFreezeViolated(BEFORE, after)).toBe(true);
  });

  it("the DETAIL is editable too — the code covers a too-long detail, not only a weak condition", () => {
    const after = proposal("a queue is building at the desk", {
      scenario_contract: { pressure_condition: "a queue is building at the desk", pressure_detail: "someone is waiting" },
    });
    expect(scenarioRepairFreezeViolated(BEFORE, after), "both pressure fields are in scope").toBe(false);
  });

  it("G2 — title, assumptions, warnings and the enum contracts are frozen too", () => {
    for (const over of [
      { display_title: "A different title" },
      { assumptions: ["something else entirely"] },
      { warnings: [] },
      { completion_contract: { verification_target: "the_confirmation_step", response_mode: "state_what_you_will_say" } },
      { follow_up_contract: { review_focus: "the_confirmation", confirmer: "the_host" } },

    ]) {
      expect(scenarioRepairFreezeViolated(BEFORE, proposal("a queue is building at the desk", over)), JSON.stringify(over))
        .toBe(true);
    }
  });

  it("H — changing ONLY the authorised field is accepted", () => {
    const after = proposal("a queue is building at the desk");
    expect(scenarioRepairFreezeViolated(BEFORE, after)).toBe(false);
    expect(verdict(after)).toBe("PASS");
  });

  it("a repair that drops the scenario contract entirely is a violation", () => {
    expect(scenarioRepairFreezeViolated(BEFORE, { program: { display_title: "x" } })).toBe(true);
    expect(scenarioRepairFreezeViolated(BEFORE, null)).toBe(true);
    expect(scenarioRepairFreezeViolated(BEFORE, "not an object")).toBe(true);
  });
});

describe("[3.2O-R4] the real pilot, simulated offline", () => {
  /**
   * The exact shape attempt 3 is believed to have produced — real words, no recognised
   * constraint — repaired by changing one field, and nothing else.
   */
  it("fails on pressure only, then passes after a one-field repair", () => {
    expect(verdict(BEFORE)).toBe("scenario_without_pressure/scenario");
    const repaired = proposal("a queue is building at the desk and someone is waiting");
    expect(scenarioRepairFreezeViolated(BEFORE, repaired), "one field moved").toBe(false);
    expect(verdict(repaired)).toBe("PASS");
  });

  it("and the whole scenario validator still runs on the repaired contract", () => {
    // A repair that fixes pressure but breaks a different scenario rule stays refused.
    expect(verdict(proposal("someone is waiting before the next appointment")))
      .toBe("scenario_independent_moment/scenario");
  });
});
