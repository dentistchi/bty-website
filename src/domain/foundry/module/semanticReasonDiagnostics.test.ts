import { describe, it, expect } from "vitest";
import { validateProgramProposal, requiredProgramKinds, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME } from "./program-authorship";
import { SCENARIO_DEFECT_REASONS, SCENARIO_FIELD_LIMIT } from "./program-coherence";
import { EVIDENCE_POLICY, evidencePolicyRuleIds } from "./evidence-policy";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-A5-R2 — ONE EVALUATION, TWO REPRESENTATIONS.
 *
 * The umbrella refusal is what the Host sees and what the retry logic reads; the subtype is
 * what a forensic slice needs. They must come from the SAME validator result — a subtype
 * re-derived later from the refusal code or from the text is a second opinion, and the ledger
 * exists to record what actually happened.
 *
 * Every case below drives the REAL `validateProgramProposal`, never a hand-built defect.
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

/** A candidate that PASSES, so each case below differs from it in exactly one place. */
function baseline() {
  return {
    program: {
      display_title: "Naming an Owner for Every Agreed Action",
      elements: requiredProgramKinds(ANSWERS).map((kind) => ({
        kind,
        content: CONTENT[kind] ?? "A short, concrete statement about this part of the training.",
        // OMITTED, not empty: an empty rationale is a structural fault, an absent one is fine.
      })),
      assumptions: ["Participants are able to attend the session."],
      warnings: ["Training alone cannot settle a staffing shortage."],
      behavior_contract: { action_verb: "confirm", action_detail: "the owner and the deadline for every agreed item" },
      scenario_contract: { pressure_condition: "only two minutes remain", pressure_detail: null },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  } as Record<string, unknown>;
}
type Program = { scenario_contract: { pressure_condition: string; pressure_detail: string | null }; display_title: string; warnings: string[] };
const withScenario = (pressure_condition: string, pressure_detail: string | null = null) => {
  const c = baseline();
  (c.program as Program).scenario_contract = { pressure_condition, pressure_detail };
  return c;
};
const validate = (candidate: Record<string, unknown>) => validateProgramProposal(candidate, ANSWERS, []);

describe("[3.2P-A5-R2] the baseline is genuinely valid", () => {
  it("so every case below is a one-variable change", () => {
    const v = validate(baseline());
    expect(v.ok, v.ok ? "" : `baseline refused: ${v.code} ${v.kind ?? ""}`).toBe(true);
  });
});

describe("[3.2P-A5-R2] every scenario reason survives to the refusal", () => {
  /**
   * A5's whole problem in one table. All five of the first column's rows carry the SAME
   * `refusal_code`; only the second column tells them apart.
   */
  const CASES: [string, Record<string, unknown>, string, string][] = [
    ["missing", withScenario("short"), "scenario_without_pressure", "missing"],
    ["too_long", withScenario(`only two minutes remain ${"and the queue is waiting ".repeat(8)}`.slice(0, SCENARIO_FIELD_LIMIT + 20)), "scenario_without_pressure", "too_long"],
    ["generic", withScenario("it is difficult"), "scenario_without_pressure", "generic"],
    ["restates_action", withScenario("confirm the owner and the deadline for every agreed item"), "scenario_without_pressure", "restates_action"],
    ["no_pressure", withScenario("the agenda is on the screen"), "scenario_without_pressure", "no_pressure"],
    ["independent_moment", withScenario("after the huddle ends"), "scenario_independent_moment", "independent_moment"],
  ];

  for (const [label, candidate, code, reason] of CASES) {
    it(`${label} → ${code} + ${reason}`, () => {
      const v = validate(candidate);
      expect(v.ok).toBe(false);
      if (v.ok) return;
      console.log(`  SCENARIO ${String(v.code).padEnd(28)} reason=${v.scenario?.reason ?? "—"}  field=${v.scenario?.field ?? "—"}`);
      expect(v.code).toBe(code);
      expect(v.scenario?.reason).toBe(reason);
      // The subtype is never invented for an unrelated refusal.
      expect(v.evidenceRule).toBeUndefined();
    });
  }

  it("covers the whole closed vocabulary — a new reason fails here first", () => {
    expect(CASES.map(([, , , r]) => r).sort()).toEqual([...SCENARIO_DEFECT_REASONS].sort());
  });
});

describe("[3.2P-A5-R2] every evidence rule survives to the refusal", () => {
  /*
    Driven from EVIDENCE_POLICY itself rather than a hand-written list: each rule's own
    `forbiddenSample` is placed in a warning — one of the advisory fields A1 and A4 were
    actually refused on — and the ledger value must be that rule's id.
  */
  for (const rule of EVIDENCE_POLICY) {
    it(`${rule.id} → evidence_overclaim + ${rule.id}`, () => {
      const c = baseline();
      (c.program as Program).warnings = [rule.forbiddenSample];
      const v = validate(c);
      expect(v.ok).toBe(false);
      if (v.ok) return;
      console.log(`  EVIDENCE ${String(v.code).padEnd(20)} rule=${v.evidenceRule ?? "—"}`);
      expect(v.code).toBe("evidence_overclaim");
      expect(v.evidenceRule).toBe(rule.id);
      expect(v.scenario).toBeUndefined();
    });
  }

  it("a title carries the same rule as a warning — the surface does not change the id", () => {
    const c = baseline();
    (c.program as Program).display_title = "Mastering Consistent Handoffs";
    const v = validate(c);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.code).toBe("evidence_overclaim");
    expect(v.evidenceRule).toBe("mastery_claim");
  });

  it("covers the whole policy — a new rule fails here first", () => {
    expect(EVIDENCE_POLICY.map((r) => r.id)).toEqual(evidencePolicyRuleIds());
  });
});

describe("[3.2P-A5-R2] what did NOT change", () => {
  it("no proposal becomes valid or invalid — this slice adds observability only", () => {
    expect(validate(baseline()).ok).toBe(true);
    // The umbrella codes are exactly what they were before the subtype existed.
    const v = validate(withScenario("the agenda is on the screen"));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("scenario_without_pressure");
  });

  it("and the authorship version does NOT move for a diagnostic", () => {
    /*
      This constant answers one question — could an existing proposal's acceptance have
      changed? Observability cannot change it, and moving the version would strand valid
      cached work for nothing. Deploy identity is the commit sha; that moves, and this does not.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v21");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
  });

  it("a successful proposal carries neither subtype", () => {
    const v = validate(baseline());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect("scenario" in v).toBe(false);
    expect("evidenceRule" in v).toBe(false);
  });
});
