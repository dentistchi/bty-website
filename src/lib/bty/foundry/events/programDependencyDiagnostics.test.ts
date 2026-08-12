import { describe, it, expect } from "vitest";
import { validateProgramProposal, PROGRAM_REJECT_CODES } from "@/domain/foundry/module/program-authorship";
import { DEPENDENCY_DIAGNOSTICS_ENABLED, BEHAVIOR_CONTRACT_DIAGNOSTICS_ENABLED } from "./programGenerationRecorder";
import { deriveOperationalConstruct, CONSTRUCT_NOUNS, nounStem } from "@/domain/foundry/module/program-coherence";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * Slice 3.2L-R6.1 — G11/G12/G13.
 *
 * The R5 ledger could say `dependency_inversion` / `why_it_matters` and no more. These
 * assert that the domain now hands the recorder the branch, the construct noun and the
 * counterpart — and that nothing else ever populates those fields.
 */

const ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know", "decide"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What will you include in your handoff record?",
  arenaRecommended: false,
  followUpDays: 7,
};

const el = (kind: string, content: string, rationale = "because it fits") => ({ kind, content, rationale });

/** Same draft with practice + Arena, so a scenario is required. No construct in the behaviour. */
const PRACTICE_ANSWERS: BuilderAnswers = {
  ...ANSWERS,
  recurringMoment: "at each handoff point",
  observableBehavior: "Hand over unfinished work out loud.",
  learningNeeds: ["know", "decide", "practice"],
  arenaRecommended: true,
};

/** A behaviour that defines NO construct, so a definite reference to one is undefined. */
const BEHAVIOUR_ONLY = {
  actor: "the outgoing person",
  trigger: "At the end of every shift, before leaving the floor",
  action_verb: "state", action_detail: "each open item aloud to the person taking over",
  completion: { confirmed_by: "the person taking over", confirmation_action: "repeat the open items back" },
};

const program = (over: Record<string, unknown> = {}) => ({
  program: {
    display_title: "Handing over without gaps",
    elements: [
      el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed."),
      el("observable_standard", "placeholder — derived"),
      el("action_decision", "placeholder — derived"),
      el("field_application", "placeholder — derived"),
      el("completion_check", "placeholder — derived"),
      el("follow_up", "placeholder — derived"),
    ],
    assumptions: [],
    warnings: [],
    behavior_contract: BEHAVIOUR_ONLY,
    scenario_contract: null,
    completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    ...over,
  },
});

describe("[3.2L-R6.1] G11 — a dependency refusal carries branch, construct and counterpart", () => {
  /**
   * WITH v4 DERIVATION the old route is gone: mutating a derived section's model content
   * changes nothing, because that content is discarded. The remaining — and realistic —
   * route is a FREE-TEXT CONTRACT FIELD smuggling in a construct nothing defined.
   */
  it("used_before_defined names the section and the construct, with no counterpart", () => {
    const p = program({
      scenario_contract: {
        pressure_condition: "two people are already waiting and the agreed escalation process has stalled",
        pressure_detail: null,
      },
    });
    p.program.elements.splice(2, 0, el("scenario", "placeholder — derived"));
    const r = validateProgramProposal(p, PRACTICE_ANSWERS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("dependency_inversion");
      expect(r.dependency).toEqual({
        kind: "scenario",
        construct: "process",
        branch: "used_before_defined",
        counterpartKind: null,
      });
    }
  });

  it("G13 — the payload carries a closed-vocabulary noun, never the generated label", () => {
    const p = program();
    const p2 = program({
      scenario_contract: {
        pressure_condition: "two people are already waiting and the agreed escalation process has stalled",
        pressure_detail: null,
      },
    });
    p2.program.elements.splice(2, 0, el("scenario", "placeholder — derived"));
    const r = validateProgramProposal(p2, PRACTICE_ANSWERS);
    if (!r.ok && r.dependency) {
      // A stem from the closed list — not "the agreed escalation process".
      expect(CONSTRUCT_NOUNS.map(nounStem)).toContain(r.dependency.construct);
      expect(r.dependency.construct).not.toContain(" ");
      expect(JSON.stringify(r.dependency)).not.toMatch(/agreed escalation|middle of the/);
    }
  });

  it("the canonical construct is defined, so a reference to IT is fine", () => {
    expect(deriveOperationalConstruct({ observableBehavior: ANSWERS.observableBehavior })?.noun).toBe("standard");
    const p = program({
      scenario_contract: {
        pressure_condition: "two people are already waiting and the shared handoff standard is being skipped",
        pressure_detail: null,
      },
    });
    p.program.elements.splice(2, 0, el("scenario", "placeholder — derived"));
    const r = validateProgramProposal(p, { ...PRACTICE_ANSWERS, observableBehavior: "Create a shared handoff standard." });
    expect(r.ok, r.ok ? "" : `${r.code}`).toBe(true);
  });
});

describe("[3.2L-R6.1] G12 — every other outcome leaves the dependency fields null", () => {
  it("a successful program carries no dependency defect", () => {
    const r = validateProgramProposal(program(), ANSWERS);
    expect(r.ok).toBe(true);
  });

  it("structural and other semantic refusals carry none either", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["structural", { behavior_contract: undefined }],
      ["non_observable_standard", { behavior_contract: { ...BEHAVIOUR_ONLY, action_verb: "create", action_detail: "a shared standard that is then utilized" } }],
    ];
    for (const [name, over] of cases) {
      const r = validateProgramProposal(program(over), ANSWERS);
      expect(r.ok, name).toBe(false);
      if (!r.ok) {
        expect(r.code, name).not.toBe("dependency_inversion");
        expect(r.dependency, name).toBeUndefined();
      }
    }
  });

  it("the recorder writes the diagnostics now that the live columns exist", () => {
    // Enabled after the Founder executed migration 20260809000000 and the post-SQL
    // verification passed. Before that it was false, because writing a missing column
    // would fail the whole insert and lose the diagnosis.
    expect(DEPENDENCY_DIAGNOSTICS_ENABLED).toBe(true);
  });

  it("behaviour-contract diagnostics are enabled too, and independently", () => {
    // Both gates are now open; they were flipped in separate deploys, each only after its
    // own migration was executed and verified.
    expect(BEHAVIOR_CONTRACT_DIAGNOSTICS_ENABLED).toBe(true);
  });

  it("dependency_inversion is still a known refusal code with copy", () => {
    expect(PROGRAM_REJECT_CODES).toContain("dependency_inversion");
  });
});
