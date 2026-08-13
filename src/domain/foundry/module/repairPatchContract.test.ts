import { describe, it, expect } from "vitest";
import {
  repairLicenseFor, repairPatchContract, licensedRepairContext, applyRepairPatch,
  repairFreezeViolated, validateProgramProposal, requiredProgramKinds,
  PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, PROGRAM_JSON_SCHEMA,
  isSemanticRepairableCode,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-A1-R3 — A RETRY YOU CANNOT WIN IS NOT A RETRY.
 *
 * A1's repair asked the model for the WHOLE program again, told it in prose to preserve
 * everything it was not licensed to change, and never showed it what that was — no assistant
 * turn is appended, so the target was invisible. Meanwhile `repairFreezeViolated` compares exact
 * serialisation: one dropped full stop, one extra space, one array reorder is a violation.
 * Sampling runs at temperature 0.7. The call was spent before it began, and the ledger recorded
 * the only possible outcome: `repair_freeze_violated: true`.
 *
 * So the licence stops being a diff applied afterwards and becomes the RESPONSE SHAPE. The model
 * returns only what it may change; the server merges it into a baseline it never let go of.
 */
const HOST = {
  arenaRecommended: true, audienceType: "leaders", capabilityCandidate: "Accountability",
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline?",
  evidenceType: "confirmed", followUpDays: 7, learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  recurringMoment: "During morning huddles",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
} as unknown as BuilderAnswers;
const KINDS = requiredProgramKinds(HOST);
const CONTENT: Record<string, string> = {
  why_it_matters: "When a huddle ends without a named owner and a deadline, the problem stays where it was.",
  observable_standard: "Name one owner and one deadline for every agreed action before the group leaves.",
  scenario: "The huddle is running late and people are already standing to leave.",
  reflection: "In your own words, what is the most important standard from this training?",
  field_application: "Name one owner and one deadline for every agreed action and write them in the huddle note.",
  completion_check: "What exactly will you say to name the owner and the deadline?",
  follow_up: "You will be asked what you actually said at the huddle.",
};
/** A candidate that is valid EXCEPT for an evidence overclaim on the narrative surface. */
const candidate = (over: { assumptions?: string[]; warnings?: string[]; title?: string } = {}) => ({
  program: {
    display_title: over.title ?? "End every huddle with an owner and a deadline",
    elements: KINDS.map((k) => ({ kind: k, content: CONTENT[k], rationale: "grounded in the host's own answers" })),
    assumptions: over.assumptions ?? ["the team holds a morning huddle"],
    warnings: over.warnings ?? ["a huddle nobody attends is an attendance problem"],
    behavior_contract: { action_verb: "state", action_detail: "the owner, action, and deadline for each agreed item" },
    scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
  },
});
const OVERCLAIM = "This training improves accountability across the team.";
const NARRATIVE = repairLicenseFor("evidence_overclaim", undefined);
const validate = (c: unknown) => validateProgramProposal(c, HOST, ["education.pdf"]);

describe("[3.2P-A1-R3] the A1 baseline is genuinely refused, and repairable", () => {
  it("an overclaiming assumption refuses on the advisory surface", () => {
    const r = validate(candidate({ assumptions: [OVERCLAIM] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("evidence_overclaim");
      expect(r.kind, "no element kind — the advisory loop, exactly as A1 recorded").toBeUndefined();
      expect(isSemanticRepairableCode(r.code)).toBe(true);
      expect(repairLicenseFor(r.code, r.kind)).toEqual({ surface: "narrative" });
    }
  });
});

describe("[3.2P-A1-R3] §12 E/F — an unlicensed field has nowhere to go", () => {
  it("the narrative patch schema cannot express any frozen program field", () => {
    const c = repairPatchContract(NARRATIVE)!;
    expect(c.name).toBe("bty_guided_program_repair_narrative_v1");
    expect(Object.keys(c.schema.properties as object)).toEqual(["display_title", "assumptions", "warnings"]);
    expect(c.schema.additionalProperties).toBe(false);
    const wire = JSON.stringify(c.schema);
    for (const frozen of ["elements", "behavior_contract", "scenario_contract", "completion_contract", "follow_up_contract", "action_verb", "action_detail", "kind", "content", "rationale"]) {
      expect(wire, frozen).not.toContain(`"${frozen}"`);
    }
  });

  it("and the merge refuses one anyway, rather than ignoring it", () => {
    for (const patch of [
      { display_title: "t", assumptions: [], warnings: [], behavior_contract: { action_verb: "x", action_detail: "y" } },
      { display_title: "t", assumptions: [], warnings: [], elements: [] },
    ]) {
      expect(applyRepairPatch({ baseline: candidate(), license: NARRATIVE, patch }))
        .toEqual({ ok: false, reason: "unlicensed_field" });
    }
  });
});

describe("[3.2P-A1-R3] §12 A–D, G, K — a legitimate patch merges and passes the freeze", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["A title only", { display_title: "Naming the owner before the huddle ends", assumptions: ["the team holds a morning huddle"], warnings: ["a huddle nobody attends is an attendance problem"] }],
    ["B assumptions only", { display_title: "End every huddle with an owner and a deadline", assumptions: ["the team meets every morning"], warnings: ["a huddle nobody attends is an attendance problem"] }],
    ["C warnings only", { display_title: "End every huddle with an owner and a deadline", assumptions: ["the team holds a morning huddle"], warnings: [] }],
    ["D all three", { display_title: "A different title", assumptions: ["a different assumption"], warnings: ["a different warning"] }],
  ];
  for (const [label, patch] of cases) {
    it(`${label} — merges, preserves every frozen value, freeze FALSE`, () => {
      const baseline = candidate({ assumptions: [OVERCLAIM] });
      const m = applyRepairPatch({ baseline, license: NARRATIVE, patch });
      expect(m.ok).toBe(true);
      if (!m.ok) return;
      const before = baseline.program;
      const after = (m.merged as typeof baseline).program;
      // G — every frozen field is byte-identical.
      expect(JSON.stringify(after.elements)).toBe(JSON.stringify(before.elements));
      expect(JSON.stringify(after.behavior_contract)).toBe(JSON.stringify(before.behavior_contract));
      expect(JSON.stringify(after.scenario_contract)).toBe(JSON.stringify(before.scenario_contract));
      expect(JSON.stringify(after.completion_contract)).toBe(JSON.stringify(before.completion_contract));
      expect(JSON.stringify(after.follow_up_contract)).toBe(JSON.stringify(before.follow_up_contract));
      // …and the licensed fields ARE the patch.
      expect(after.display_title).toBe(patch.display_title);
      expect(after.assumptions).toEqual(patch.assumptions);
      expect(after.warnings).toEqual(patch.warnings);
      // K — the defensive invariant, which A1 could never reach.
      expect(repairFreezeViolated({ code: "evidence_overclaim", kind: undefined, before: baseline, after: m.merged })).toBe(false);
    });
  }

  it("the baseline it merges into never leaves the server — the patch alone is the model's", () => {
    const ctx = licensedRepairContext(candidate({ assumptions: [OVERCLAIM] }), NARRATIVE)!;
    expect(Object.keys(ctx)).toEqual(["display_title", "assumptions", "warnings"]);
    // B (§16) — the model is SHOWN the current licensed values, which A1 never was.
    expect(ctx.assumptions).toEqual([OVERCLAIM]);
    const shown = JSON.stringify(ctx);
    for (const frozen of ["behavior_contract", "action_verb", "scenario_contract", "elements"]) {
      expect(shown, frozen).not.toContain(frozen);
    }
  });
});

describe("[3.2P-A1-R3] §12 H/I/J — the merged candidate faces the full validator", () => {
  it("I — a real repair reaches success", () => {
    const baseline = candidate({ assumptions: [OVERCLAIM] });
    const m = applyRepairPatch({
      baseline, license: NARRATIVE,
      patch: { display_title: "End every huddle with an owner and a deadline", assumptions: ["the team holds a morning huddle"], warnings: ["a huddle nobody attends is an attendance problem"] },
    });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const r = validate(m.merged);
    expect(r.ok, r.ok ? "" : `${r.code}`).toBe(true);
  });

  it("J — a patch that still overclaims is refused again", () => {
    const baseline = candidate({ assumptions: [OVERCLAIM] });
    const m = applyRepairPatch({
      baseline, license: NARRATIVE,
      patch: { display_title: "End every huddle with an owner and a deadline", assumptions: ["This training will improve collaboration across the team."], warnings: [] },
    });
    expect(m.ok).toBe(true);
    if (m.ok) {
      const r = validate(m.merged);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("evidence_overclaim");
    }
  });

  it("H — a patch that fixes its own fault but breaks another floor is still refused", () => {
    const baseline = candidate({ assumptions: [OVERCLAIM] });
    const m = applyRepairPatch({
      baseline, license: NARRATIVE,
      patch: { display_title: "End every huddle", assumptions: ["Use the provided huddle template."], warnings: [] },
    });
    expect(m.ok).toBe(true);
    if (m.ok) {
      const r = validate(m.merged);
      expect(r.ok, "a fabricated material is still a fabricated material").toBe(false);
    }
  });
});

describe("[3.2P-A1-R3] §12 L — a corrupted merge is caught by the defensive invariant", () => {
  it("the freeze still fires if the server writes outside the licence", () => {
    const baseline = candidate({ assumptions: [OVERCLAIM] });
    const corrupted = JSON.parse(JSON.stringify(baseline));
    corrupted.program.assumptions = ["fixed"];
    corrupted.program.elements[0].content += " ";   // the server got it wrong
    expect(repairFreezeViolated({ code: "evidence_overclaim", kind: undefined, before: baseline, after: corrupted })).toBe(true);
  });
});

describe("[3.2P-A1-R3] §11 — every licence has a patch contract", () => {
  it("all four surfaces, each naming only its own fields", () => {
    const surfaces = [
      [repairLicenseFor("scenario_without_pressure", "scenario"), "bty_guided_program_repair_scenario_pressure_v1", ["pressure_condition", "pressure_detail"]],
      [repairLicenseFor("evidence_overclaim", undefined), "bty_guided_program_repair_narrative_v1", ["display_title", "assumptions", "warnings"]],
      [repairLicenseFor("evidence_overclaim", "reflection"), "bty_guided_program_repair_element_v1", ["content", "rationale"]],
      [repairLicenseFor("evidence_overclaim", "observable_standard"), "bty_guided_program_repair_behavior_contract_v1", ["content", "rationale", "contract"]],
      [repairLicenseFor("evidence_overclaim", "scenario"), "bty_guided_program_repair_scenario_contract_v1", ["content", "rationale", "contract"]],
    ] as const;
    for (const [license, name, fields] of surfaces) {
      const c = repairPatchContract(license as never)!;
      expect(c, JSON.stringify(license)).not.toBeNull();
      expect(c.name).toBe(name);
      expect(Object.keys(c.schema.properties as object)).toEqual(fields);
      expect(c.schema.additionalProperties).toBe(false);
    }
  });

  it("an element patch writes only that element, and a contract patch only that contract", () => {
    const baseline = candidate();
    const el = repairLicenseFor("evidence_overclaim", "reflection");
    const m1 = applyRepairPatch({ baseline, license: el, patch: { content: "A new question?", rationale: "why" } });
    expect(m1.ok).toBe(true);
    if (m1.ok) {
      const after = (m1.merged as typeof baseline).program;
      expect(after.elements.find((e) => e.kind === "reflection")!.content).toBe("A new question?");
      expect(after.elements.find((e) => e.kind === "why_it_matters")!.content).toBe(CONTENT.why_it_matters);
      expect(JSON.stringify(after.behavior_contract)).toBe(JSON.stringify(baseline.program.behavior_contract));
      expect(repairFreezeViolated({ code: "evidence_overclaim", kind: "reflection", before: baseline, after: m1.merged })).toBe(false);
    }
    const sp = repairLicenseFor("scenario_without_pressure", "scenario");
    const m2 = applyRepairPatch({ baseline, license: sp, patch: { pressure_condition: "a senior colleague has already changed the subject", pressure_detail: null } });
    expect(m2.ok).toBe(true);
    if (m2.ok) {
      expect(repairFreezeViolated({ code: "scenario_without_pressure", kind: "scenario", before: baseline, after: m2.merged })).toBe(false);
      const r = validate(m2.merged);
      expect(r.ok, r.ok ? "" : r.code).toBe(true);
    }
  });
});

describe("[3.2P-A1-R3] the initial wire contract did NOT change", () => {
  it("repair schemas carry their own identity, and the authority version moves", () => {
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
    expect(Object.keys(PROGRAM_JSON_SCHEMA.properties.program.properties.behavior_contract.properties))
      .toEqual(["action_verb", "action_detail"]);
    /*
      Acceptance moved: a licensed repair can now structurally survive, where before it could
      not. The INITIAL wire shape is untouched, so its name stays — pretending it changed would
      be less truthful than giving the repair schemas their own names, which is what they have.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v20");
  });
});
