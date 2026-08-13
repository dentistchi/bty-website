import { describe, it, expect } from "vitest";
import { validateProgramProposal, requiredProgramKinds, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME } from "./program-authorship";
import { SCENARIO_DEFECT_REASONS } from "./program-coherence";
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
      scenario_contract: { pressure_frame: "time_is_short" },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  } as Record<string, unknown>;
}
type Program = { scenario_contract: { pressure_frame: string }; display_title: string; warnings: string[] };
const validate = (candidate: Record<string, unknown>) => validateProgramProposal(candidate, ANSWERS, []);

describe("[3.2P-A5-R2] the baseline is genuinely valid", () => {
  it("so every case below is a one-variable change", () => {
    const v = validate(baseline());
    expect(v.ok, v.ok ? "" : `baseline refused: ${v.code} ${v.kind ?? ""}`).toBe(true);
  });
});

describe("[3.2P-A5-R2] the scenario subtype, and what v22 did to it", () => {
  /*
    THIS BLOCK USED TO DRIVE ALL SIX REASONS through the real validator — `missing`, `too_long`,
    `generic`, `restates_action`, `no_pressure`, `independent_moment` — because five of them
    shared one umbrella code and A5 could not be classified without the discriminator.

    3.2P-A7-R2 removed the free-text pressure fields, so four of those six are unreachable by
    construction: there is no prose to be generic, to restate the action, to name no difficulty,
    or to name a second occasion. `missing` is the only reason a v22 proposal can still produce,
    and it now means "not one of the twelve frames".

    The diagnostic itself is unchanged and still load-bearing — the ledger holds A6's and A7's
    rows, and the vocabulary deliberately did not shrink.
  */
  it("an unknown frame is a SHAPE fault, so it carries no semantic subtype at all", () => {
    const c = baseline();
    (c.program as Program).scenario_contract = { pressure_frame: "after the meeting ends" };
    const v = validate(c);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.diagnosis?.path).toBe("program.scenario_contract.pressure_frame");
    expect(v.scenario).toBeUndefined();
    expect(v.evidenceRule).toBeUndefined();
  });

  it("and a valid frame produces no subtype either, because there is no defect", () => {
    const v = validate(baseline());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect("scenario" in v).toBe(false);
  });

  it("the closed vocabulary still holds all six — history stays readable", () => {
    expect([...SCENARIO_DEFECT_REASONS].sort()).toEqual(
      ["generic", "independent_moment", "missing", "no_pressure", "restates_action", "too_long"],
    );
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
  it("no proposal becomes valid or invalid — that slice added observability only", () => {
    expect(validate(baseline()).ok).toBe(true);
  });

  it("and the authorship version does NOT move for a diagnostic", () => {
    /*
      This constant answers one question — could an existing proposal's acceptance have
      changed? Observability cannot change it, and moving the version would strand valid
      cached work for nothing. Deploy identity is the commit sha; that moves, and this does not.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v22");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v12");
  });

  it("a successful proposal carries neither subtype", () => {
    const v = validate(baseline());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect("scenario" in v).toBe(false);
    expect("evidenceRule" in v).toBe(false);
  });
});
