import { describe, it, expect } from "vitest";
import { systemPrompt } from "./programAuthorshipService";
import {
  SCENARIO_PRESSURE_POLICY,
  namesRealPressure,
  validateScenarioContract,
  type BehaviorContract,
} from "@/domain/foundry/module/program-coherence";

/**
 * SLICE 3.2O-R1 — the prompt is one half of a contract whose other half is a validator.
 *
 * The live refusal `scenario_independent_moment` happened because the no-second-occasion rule
 * is enforced by `namesIndependentMoment` on BOTH pressure fields and was written into the
 * prompt for only `pressure_condition`. `pressure_detail` was even introduced as "a second
 * circumstance", which invites the phrasing that gets refused.
 *
 * These assertions fail if either field is ever dropped from the instruction again.
 */
const PROMPT = systemPrompt(
  "en",
  ["why_it_matters", "observable_standard", "scenario", "action_decision", "field_application", "completion_check", "follow_up"],
  "Nothing here can show that behaviour changed.",
  { exists: ["a video"], contentsVerified: false },
  ["- do not overclaim"],
);

describe("[3.2O-R1] the scenario prompt constrains BOTH pressure fields", () => {
  it("names both fields in the no-second-occasion rule", () => {
    const rule = PROMPT.split("\n").find(
      (l) => /pressure_condition/i.test(l) && /pressure_detail/i.test(l) && /occasion/i.test(l),
    );
    expect(rule, "one line must bind BOTH fields to the occasion rule").toBeTruthy();
  });

  it("says explicitly that neither field may name an occasion of its own", () => {
    expect(PROMPT).toMatch(/BOTH pressure_condition AND pressure_detail/i);
    expect(PROMPT).toMatch(/Neither may name an occasion of its own/i);
  });

  it("forbids the concrete second-anchor phrasings in EITHER field", () => {
    const forbidden = PROMPT.split("\n").find((l) => /Forbidden in EITHER field/i.test(l));
    expect(forbidden).toBeTruthy();
    for (const phrase of ["during the call", "before the appointment", "at the end of the day"]) {
      expect(forbidden, phrase).toContain(phrase);
    }
  });

  it("tells the model not to restate ITS OWN trigger's occasion — the collision that fails hardest", () => {
    const line = PROMPT.split("\n").find((l) => /behavior_contract\.trigger names/i.test(l));
    expect(line, "the trigger's own noun is the easiest way to trip the rule").toBeTruthy();
    expect(line).toMatch(/do NOT restate that occasion in either pressure field/i);
  });

  it("states positively what IS allowed, so the rule is not only prohibition", () => {
    /*
      Rewritten in Slice 3.2O-R2. R1 asserted a hand-written allow-list that included
      "workload" and "operational constraint" — two categories the pressure floor recognises
      nothing of, which is what cost the third paid window. The property this test protects
      (the prompt says what IS allowed, not only what is not) is unchanged; the allowance is
      now derived from SCENARIO_PRESSURE_POLICY and asserted family by family below.
    */
    expect(PROMPT).toMatch(/A real difficulty is one of these, and none of them is an occasion:/);
    expect(PROMPT).toContain("A queue is building at the desk");
  });

  it("keeps the original single-moment rule intact", () => {
    expect(PROMPT).toMatch(/THE SITUATION HAPPENS AT THE TRIGGER/);
    expect(PROMPT).toMatch(/Do NOT give the situation an occasion of its own/);
  });
});

/**
 * SLICE 3.2O-R2 — the prompt's pressure guidance must BE the validator's, not resemble it.
 *
 * The third paid window was refused `scenario_without_pressure` against a prompt that had
 * just recommended two categories the floor recognises nothing of. These assertions fail if
 * the prompt ever again names a category the product cannot accept.
 */
const PRESSURE_BEHAVIOR: BehaviorContract = {
  actor: "Front desk staff",
  trigger: "before each scheduled appointment",
  observableAction: "make a confirmation call and follow the checklist of required questions",
  completion: { confirmedBy: "the supervisor", confirmationAction: "review the completed checklist" },
};

describe("[3.2O-R2] the prompt's pressure vocabulary is derived, not hand-written", () => {
  it("carries every canonical family, verbatim from the policy", () => {
    for (const f of SCENARIO_PRESSURE_POLICY) {
      expect(PROMPT, `${f.id} missing from the deployed prompt`).toContain(f.promptLine);
    }
  });

  it("names no pressure category the validator would refuse", () => {
    // The two that cost a window. A promptLine can only exist with a machine-verified
    // example, so a category the floor cannot accept can no longer reach the model.
    expect(PROMPT.toLowerCase()).not.toContain("workload");
    expect(PROMPT.toLowerCase()).not.toContain("operational constraint");
  });

  it("every worked example the prompt calls valid really passes the validator", () => {
    for (const valid of ["A queue is building at the desk"]) {
      expect(PROMPT).toContain(valid);
      const r = validateScenarioContract({ pressure_condition: valid, pressure_detail: null }, PRESSURE_BEHAVIOR);
      expect(r.ok, `${valid} → ${r.ok ? "" : r.defect.reason}`).toBe(true);
    }
  });

  it("every phrase the prompt calls forbidden really is refused", () => {
    for (const bad of ["during the call the patient is distracted", "at the end of the day", "at the next handover"]) {
      expect(PROMPT).toContain(bad);
      const r = validateScenarioContract({ pressure_condition: bad, pressure_detail: null }, PRESSURE_BEHAVIOR);
      expect(r.ok, bad).toBe(false);
    }
  });

  it("keeps the pressure floor and the moment rule as separate teachings", () => {
    // A phrase may satisfy one and fail the other; the prompt must not conflate them.
    expect(namesRealPressure("a queue is building at the desk")).toBe(true);
    expect(PROMPT).toMatch(/BOTH pressure_condition AND pressure_detail/i);
    expect(PROMPT).toMatch(/A real difficulty is one of these/i);
  });
});
