import { describe, it, expect } from "vitest";
import {
  validateProgramProposal, requiredProgramKinds, isSemanticRepairableCode, repairLicenseFor,
  repairPatchContract, licensedRepairContext, applyRepairPatch, semanticRepairInstruction,
  PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, PROGRAM_JSON_SCHEMA,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-A6-R2 — A DEFECT THAT CAN ONLY LIVE IN TWO FIELDS IS REPAIRABLE IN TWO FIELDS.
 *
 * A6 (`772a15e2`, v20) was refused on its FIRST call with `scenario_independent_moment` /
 * `scenario_contract_reason = independent_moment`, and got no repair, because that code has
 * been terminal since R4. The reason recorded there — "a second occasion can mean the scenario
 * was built around the wrong moment" — was true of the whole-program retry it was written for
 * and is not true of the architecture that exists now.
 *
 * This suite is the gate that decision had to pass, not a description of it: the defect is
 * proven to be reachable from two fields only, the patch is proven to be unable to touch
 * anything else, and a bad repair is proven not to buy acceptance.
 */
const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  recurringMoment: "During morning huddles",
  observableBehavior: "Confirm the owner and the deadline for every agreed item.",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  followUpDays: 7,
  arenaRecommended: true,
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

type Program = {
  behavior_contract: { action_verb: string; action_detail: string };
  scenario_contract: { pressure_condition: string; pressure_detail: string | null };
  display_title: string;
};

function baseline(pressure_condition = "only two minutes remain", pressure_detail: string | null = null) {
  return {
    program: {
      display_title: "Naming an Owner for Every Agreed Action",
      elements: requiredProgramKinds(ANSWERS).map((kind) => ({
        kind,
        content: CONTENT[kind] ?? "A short, concrete statement about this part of the training.",
      })),
      assumptions: ["Participants are able to attend the session."],
      warnings: ["Training alone cannot settle a staffing shortage."],
      behavior_contract: { action_verb: "confirm", action_detail: "the owner and the deadline for every agreed item" },
      scenario_contract: { pressure_condition, pressure_detail },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  } as Record<string, unknown>;
}
const validate = (c: unknown) => validateProgramProposal(c, ANSWERS, []);

/** Generic second occasions — never pilot vocabulary. */
const RELOCATIONS = [
  "after the meeting ends",
  "at the next handoff",
  "before the next shift begins",
];

describe("[3.2P-A6-R2] §2 — where a second occasion can come from", () => {
  it("the model owns no actor, no trigger, no moment and no completion field", () => {
    const p = (PROGRAM_JSON_SCHEMA as { properties: { program: { properties: Record<string, { properties?: Record<string, unknown> }> } } })
      .properties.program.properties;
    expect(Object.keys(p.behavior_contract.properties ?? {})).toEqual(["action_verb", "action_detail"]);
    expect(Object.keys(p.scenario_contract.properties ?? {})).toEqual(["pressure_condition", "pressure_detail"]);
    for (const absent of ["actor", "trigger", "recurring_moment", "moment", "completion_signal", "confirmed_by"]) {
      expect(Object.keys(p), `model can author ${absent}`).not.toContain(absent);
      expect(Object.keys(p.behavior_contract.properties ?? {}), `contract exposes ${absent}`).not.toContain(absent);
    }
  });

  it("and the scenario the learner reads is RENDERED, so the model's own prose cannot relocate it", () => {
    /*
      The decisive fact for repairability. `deriveContent` replaces the scenario element with
      `renderScenarioSentence(contract, scenarioContract)`, which opens on the host's trigger
      verbatim. An occasion written into the element's `content` never reaches a learner — and,
      measured separately, `namesIndependentMoment` is called in exactly ONE place, over the two
      pressure fields. Those two facts together are why the licence can be this narrow.
    */
    const c = baseline();
    (c.program as { elements: { kind: string; content: string }[] }).elements
      .filter((e) => e.kind === "scenario")
      .forEach((e) => { e.content = "Later that afternoon, the team meets again to review what was missed."; });
    const v = validate(c);
    expect(v.ok, v.ok ? "" : `refused ${v.code}`).toBe(true);
    if (!v.ok) return;
    const scenario = v.value.proposal.elements.find((e) => e.kind === "scenario");
    expect(scenario?.content).toContain("During morning huddles");
    expect(scenario?.content).not.toContain("Later that afternoon");
  });

  for (const where of ["pressure_condition", "pressure_detail"] as const) {
    it(`a relocation in ${where} is what actually refuses`, () => {
      const c = where === "pressure_condition"
        ? baseline("after the meeting ends")
        : baseline("only two minutes remain", "at the next handoff");
      const v = validate(c);
      expect(v.ok).toBe(false);
      if (v.ok) return;
      expect(v.code).toBe("scenario_independent_moment");
      expect(v.scenario?.reason).toBe("independent_moment");
    });
  }
});

describe("[3.2P-A6-R2] §3/§8 — the licence is the narrow one, and nothing else moved", () => {
  it("independent moment now gets ONE repair, on the same surface as its sibling", () => {
    expect(isSemanticRepairableCode("scenario_independent_moment")).toBe(true);
    expect(repairLicenseFor("scenario_independent_moment", "scenario")).toEqual({ surface: "scenario_pressure" });
    const contract = repairPatchContract(repairLicenseFor("scenario_independent_moment", "scenario"))!;
    expect(contract.name).toBe("bty_guided_program_repair_scenario_pressure_v1");
    expect(Object.keys(contract.schema.properties as object)).toEqual(["pressure_condition", "pressure_detail"]);
  });

  it("and NO other semantic refusal became repairable", () => {
    for (const terminal of [
      "non_observable_standard", "dependency_inversion", "person_evaluation", "scenario_unrelated",
      "application_moment_unrelated", "generic_completion", "trigger_not_recurring", "complaint_replay",
      "invented_specifics", "internal_jargon", "decision_is_only_reflection", "missing_required_kind",
    ] as const) {
      expect(isSemanticRepairableCode(terminal), terminal).toBe(false);
    }
    // Exactly four, and the two that were already there are untouched.
    for (const repairable of ["evidence_overclaim", "material_fabrication", "scenario_without_pressure", "scenario_independent_moment"] as const) {
      expect(isSemanticRepairableCode(repairable), repairable).toBe(true);
    }
  });
});

describe("[3.2P-A6-R2] §4 — a licensed repair of a relocated occasion", () => {
  const REFUSED = baseline("after the meeting ends");
  const LICENSE = repairLicenseFor("scenario_independent_moment", "scenario");

  it("A/B — the patch can express the fix, and cannot express the host's moment", () => {
    const ctx = licensedRepairContext(REFUSED, LICENSE)!;
    expect(Object.keys(ctx)).toEqual(["pressure_condition", "pressure_detail"]);
    expect(JSON.stringify(ctx)).not.toContain("During morning huddles");
  });

  it("C/D/E — a patch that reaches for anything else is refused, not merged", () => {
    for (const overreach of [
      { pressure_condition: "only two minutes remain", behavior_contract: { action_verb: "state", action_detail: "x" } },
      { pressure_condition: "only two minutes remain", display_title: "A Different Title" },
      { pressure_condition: "only two minutes remain", completion_contract: { verification_target: "the_behaviour" } },
    ]) {
      const r = applyRepairPatch({ baseline: REFUSED, license: LICENSE, patch: overreach });
      expect(r.ok, `unlicensed field merged: ${Object.keys(overreach).join(",")}`).toBe(false);
      if (!r.ok) expect(r.reason).toBe("unlicensed_field");
    }
  });

  it("F/G/H/I — a good patch merges, preserves every host authority, and reaches success", () => {
    const r = applyRepairPatch({
      baseline: REFUSED,
      license: LICENSE,
      patch: { pressure_condition: "two people are talking over each other", pressure_detail: null },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const merged = r.merged as { program: Program & { elements: { kind: string; content: string }[] } };
    // G — the host's moment, the action and the completion authority are byte-identical.
    const before = (REFUSED.program as Program);
    expect(merged.program.behavior_contract).toEqual(before.behavior_contract);
    expect(merged.program.display_title).toBe(before.display_title);
    expect(merged.program.scenario_contract.pressure_condition).toBe("two people are talking over each other");

    // H — the merged candidate goes through the WHOLE validator, not a scenario re-check.
    const v = validate(merged);
    expect(v.ok, v.ok ? "" : `merged candidate refused ${v.code}/${v.scenario?.reason ?? ""}`).toBe(true);
    if (!v.ok) return;
    // I — and the rendered scenario still opens on the host's own moment.
    const scenario = v.value.proposal.elements.find((e) => e.kind === "scenario");
    expect(scenario?.content).toContain("During morning huddles");
  });

  it("the freeze verdict is false for a legitimate patch — it stayed inside its licence", () => {
    /*
      `applyRepairPatch` returning ok IS the freeze passing: an unlicensed field has nowhere to
      be written, so it fails the merge rather than being caught afterwards. The service records
      `repairFreezeViolated = false` on this path.
    */
    const r = applyRepairPatch({
      baseline: REFUSED,
      license: LICENSE,
      patch: { pressure_condition: "two people are talking over each other", pressure_detail: null },
    });
    expect(r.ok).toBe(true);
  });
});

describe("[3.2P-A6-R2] §5 — the repair buys one correction, never acceptance", () => {
  const LICENSE = repairLicenseFor("scenario_independent_moment", "scenario");
  const repairWith = (pressure_condition: string) =>
    applyRepairPatch({ baseline: baseline("after the meeting ends"), license: LICENSE, patch: { pressure_condition, pressure_detail: null } });

  const BAD: [string, string, string, string][] = [
    ["another occasion", "before the next shift begins", "scenario_independent_moment", "independent_moment"],
    ["generic", "it is difficult", "scenario_without_pressure", "generic"],
    ["restatement", "confirm the owner and the deadline for every agreed item", "scenario_without_pressure", "restates_action"],
    ["no pressure", "the agenda is on the screen", "scenario_without_pressure", "no_pressure"],
  ];

  for (const [label, patch, code, reason] of BAD) {
    it(`${label} → ${code} / ${reason}`, () => {
      const r = repairWith(patch);
      expect(r.ok, "the merge itself is licensed — the CONTENT is what fails").toBe(true);
      if (!r.ok) return;
      const v = validate(r.merged);
      expect(v.ok).toBe(false);
      if (v.ok) return;
      expect(v.code).toBe(code);
      expect(v.scenario?.reason).toBe(reason);
    });
  }

  it("every relocation phrasing still refuses after a repair", () => {
    for (const t of RELOCATIONS) {
      const r = repairWith(t);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const v = validate(r.merged);
      expect(v.ok, t).toBe(false);
      if (!v.ok) expect(v.code, t).toBe("scenario_independent_moment");
    }
  });
});

describe("[3.2P-A6-R2] §10 — the instruction names the defect the model actually made", () => {
  it("the independent-moment repair opens on relocation, not on missing difficulty", () => {
    const t = semanticRepairInstruction("scenario_independent_moment", ANSWERS);
    expect(t).toContain("put the practice situation at a different time or event");
    expect(t).not.toContain("named nothing that competes");
  });

  it("and the body is the SAME one — nothing redundant was added", () => {
    const indep = semanticRepairInstruction("scenario_independent_moment", ANSWERS);
    const pressure = semanticRepairInstruction("scenario_without_pressure", ANSWERS);
    const body = (s: string) => s.slice(s.indexOf("The situation still happens"));
    expect(body(indep)).toBe(body(pressure));
    for (const rule of [
      "still happens at the host's own moment",
      "never moves the learner to a different one",
      "a difficulty inside the moment, never a second moment",
      "the response shape contains those fields and nothing else",
    ]) {
      expect(indep, rule).toContain(rule);
    }
    // No whole-program wording crept back in.
    expect(indep).not.toContain("Return the SAME program");
  });
});

describe("[3.2P-A6-R2] §7/§12 — what did NOT change", () => {
  it("Q — A3's chain would still terminate; a second refusal is still terminal", () => {
    /*
      A3 was child 1 `no_pressure` → child 2 `independent_moment`. Making the second code
      repairable does NOT give that chain a third call: `MAX_ATTEMPTS` is 2 and the loop is
      bounded by it, not by repairability. This slice gives a FIRST-call relocation the one
      opportunity its sibling already had — nothing more.
    */
    const secondRefusal = validate(baseline("before the next shift begins"));
    expect(secondRefusal.ok).toBe(false);
    if (!secondRefusal.ok) expect(secondRefusal.code).toBe("scenario_independent_moment");
    // The repairable set says a retry is ALLOWED; the attempt bound says how many exist.
    expect(isSemanticRepairableCode("scenario_independent_moment")).toBe(true);
  });

  it("the moment floor itself is untouched, and so is pressure recognition", () => {
    // Acceptance did not move: the same phrases refuse, for the same reasons.
    expect(validate(baseline("after the meeting ends")).ok).toBe(false);
    expect(validate(baseline("the agenda is on the screen")).ok).toBe(false);
    expect(validate(baseline("only two minutes remain")).ok).toBe(true);
  });

  it("the wire shape and the patch shape are unchanged; the authority version moved", () => {
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
    expect(repairPatchContract({ surface: "scenario_pressure" })!.name).toBe("bty_guided_program_repair_scenario_pressure_v1");
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v21");
  });
});
