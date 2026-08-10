import { describe, it, expect } from "vitest";
import { systemPrompt } from "./programAuthorshipService";

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
    const allowed = PROMPT.split("\n").find((l) => /ALLOWED in either field/i.test(l));
    expect(allowed).toBeTruthy();
    for (const ok of ["workload", "interruption", "competing priorities", "operational constraint"]) {
      expect(allowed, ok).toContain(ok);
    }
    expect(allowed).toContain("A queue is building at the desk");
  });

  it("keeps the original single-moment rule intact", () => {
    expect(PROMPT).toMatch(/THE SITUATION HAPPENS AT THE TRIGGER/);
    expect(PROMPT).toMatch(/Do NOT give the situation an occasion of its own/);
  });
});
