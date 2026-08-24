import { describe, it, expect } from "vitest";
import {
  availableEvidenceLevels,
  claimsAboveCeiling,
  deriveEvidenceCeiling,
  evidenceClaimBrief,
  outcomeNounsForPrompt,
  outcomeObjectStems,
  requiredProgramKinds,
  validateProgramProposal,
  EVIDENCE_LADDER,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2L-R11.4H — the ceiling the author writes to must be the ceiling the validator
 * enforces.
 *
 * The second authorized generation (`cdd16aaf`) was refused `evidence_overclaim` while the
 * prompt already carried an evidence ceiling. The ceiling said what the training cannot
 * SHOW; the outcome ban named five nouns; the validator refuses a causal verb pointed at
 * any of ~30. A model can obey every word it is given and still be refused.
 */
const CANONICAL: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  evidenceType: "seen",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
} as BuilderAnswers;

describe("[3.2L-R11.4H] the ladder is derived, not invented", () => {
  it("names the seven rungs the product has always encoded", () => {
    expect([...EVIDENCE_LADDER]).toEqual([
      "exposed", "reflected", "decided", "practiced", "applied", "observed", "sustained",
    ]);
  });

  it("the top three are unreachable no matter how the training is configured", () => {
    for (const answers of [
      CANONICAL,
      { ...CANONICAL, followUpDays: 30 },
      { ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, completionPrompt: "" },
    ] as BuilderAnswers[]) {
      const levels = availableEvidenceLevels(answers);
      expect(levels).not.toContain("applied");
      expect(levels).not.toContain("observed");
      expect(levels).not.toContain("sustained");
    }
  });

  it("each rung is unlocked by the Host answer that creates it", () => {
    expect(availableEvidenceLevels(CANONICAL)).toEqual(["exposed", "reflected", "decided", "practiced"]);
    expect(availableEvidenceLevels({ ...CANONICAL, arenaRecommended: false } as BuilderAnswers))
      .toEqual(["exposed", "reflected", "decided"]);
    expect(availableEvidenceLevels({ ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, completionPrompt: "" } as BuilderAnswers))
      .toEqual(["exposed"]);
  });

  it("the Host-visible ceiling and the ladder cannot drift apart", () => {
    const ceiling = deriveEvidenceCeiling(CANONICAL);
    expect(ceiling).toMatch(/reflection, not competence/);
    expect(ceiling).toMatch(/rehearsal, never field mastery/);
    const thin = deriveEvidenceCeiling({ ...CANONICAL, arenaRecommended: false } as BuilderAnswers);
    expect(thin).not.toMatch(/rehearsal/);
  });
});

describe("[3.2L-R11.4H] the instruction can never be narrower than the rule", () => {
  it("every outcome the validator refuses is named in the prompt", () => {
    const prompt = outcomeNounsForPrompt().join(" ").toLowerCase();
    const uncovered = outcomeObjectStems().filter((stem) => !prompt.includes(stem.toLowerCase()));
    expect(uncovered).toEqual([]);
  });

  it("the brief states what MAY be claimed before what may not", () => {
    const lines = evidenceClaimBrief(CANONICAL);
    const allowed = lines.findIndex((l) => l.startsWith("- ALLOWED"));
    const forbidden = lines.findIndex((l) => l.startsWith("- FORBIDDEN"));
    expect(allowed).toBeGreaterThan(-1);
    expect(forbidden).toBeGreaterThan(allowed);
  });

  it("it scales down with the training — no practice claim when there is no practice", () => {
    const brief = evidenceClaimBrief({ ...CANONICAL, arenaRecommended: false } as BuilderAnswers).join("\n");
    expect(brief).not.toMatch(/rehearsed the behaviour/);
    expect(evidenceClaimBrief(CANONICAL).join("\n")).toMatch(/rehearsed the behaviour/);
  });

  it("the follow-up instruction is prospective when there is a follow-up, and absent when there is not", () => {
    expect(evidenceClaimBrief(CANONICAL).join("\n")).toMatch(/PROSPECTIVE[\s\S]*review whether/i);
    expect(evidenceClaimBrief({ ...CANONICAL, followUpDays: 0 } as BuilderAnswers).join("\n"))
      .toMatch(/no follow-up/i);
  });
});

describe("[3.2L-R11.4H] the ceiling, case by case (Part 6)", () => {
  it("ACCEPTS what the interaction really produces", () => {
    for (const ok of [
      "Participant completed the handoff practice.",
      "Participant identified the three items they would include.",
      "Participant created a practice handoff record.",
      "At follow-up, ask whether the standard was used in a real handoff.",
      "In seven days you will be asked what you actually said. That is your own account, not an observation.",
      "Practice is rehearsal, never field mastery.",
    ]) {
      expect(claimsAboveCeiling(ok), ok).toBe(false);
    }
  });

  it("REFUSES a rung this product cannot reach", () => {
    for (const bad of [
      "Participant now consistently performs complete handoffs.",
      "Training proved handoff quality improved.",
      "Completion demonstrates sustained behavior change.",
      "Follow-up confirms the new standard is reliably used.",
      "The team reliably follows the agreed steps.",
      "This verifies mastery of the handover.",
    ]) {
      expect(claimsAboveCeiling(bad), bad).toBe(true);
    }
  });

  it("the Host's own problem statement is not an overclaim", () => {
    expect(claimsAboveCeiling("Our handoffs are inconsistent.")).toBe(false);
    expect(claimsAboveCeiling("Handovers happen inconsistently across shifts.")).toBe(false);
  });
});

describe("[3.2L-R11.4H] seven sections inside the ceiling (Part 6)", () => {
  const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });
  const proposal = {
    program: {
      display_title: "Handing over without gaps",
      elements: [
        el("why_it_matters", "When a handover misses a step, the next person starts without knowing what changed."),
        el("observable_standard", "The outgoing person states each open item aloud and the incoming person repeats it back before signing off."),
        el("scenario", "The shift ran late and two people are already waiting to ask you questions."),
        el("action_decision", "I will decide which open items I always state aloud at handover, even when the shift ran late."),
        el("field_application", "At your next handover, you state the open items before leaving."),
        el("evidence", "Create a handoff record that names the responsible person and the next action. It shows the items were stated, not that the next shift acted on them."),
        el("completion_check", "What will you say aloud at your next handover that you did not say before?"),
        el("follow_up", "In seven days you will be asked what you actually said at handover. That is your own account, not an observation."),
      ],
      assumptions: ["Handovers happen at a predictable moment."],
      warnings: ["If the handover step is missing from the workflow, training alone will not add it."],
      behavior_contract: {
        actor: "the outgoing person",
        trigger: "At the end of every shift, before leaving the floor",
        action_verb: "state", action_detail: "each open item aloud to the person taking over",
        completion: { confirmed_by: "the person taking over", confirmation_action: "repeat the open items back" },
      },
      scenario_contract: { pressure_frame: "time_is_short" },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  };

  it("a discarded sentence the participant never sees is deliberately tolerated (R9)", () => {
    const derived = JSON.parse(JSON.stringify(proposal));
    derived.program.elements[0].content = "After this, the team consistently performs complete handovers.";
    // WHY THIS MATTERS is rendered from the Host's own problem statement, so this sentence
    // is discarded before anyone reads it. Refusing a paid window over invisible prose was
    // decided against in R9; the claim is unreachable by construction instead.
    expect(validateProgramProposal(derived, CANONICAL, []).ok).toBe(true);
  });

  it("all seven kinds validate without exceeding the ceiling", () => {
    // 8 since Slice R4-R5C14A: the Host's success evidence has its own section now.
    expect(requiredProgramKinds(CANONICAL)).toHaveLength(8);
    const r = validateProgramProposal(proposal, CANONICAL, []);
    if (!r.ok) throw new Error(`refused ${r.code}`);
    expect(r.ok).toBe(true);
  });

  /*
    Mutated in ASSUMPTIONS and WARNINGS on purpose. R9 decided that an outcome claim inside
    prose the derivation DISCARDS cannot mislead anyone and must not burn a paid window —
    so the gate lives where text still reaches a participant. These are those places.
  */
  it("one habitual-performance sentence refuses the whole program", () => {
    const bad = JSON.parse(JSON.stringify(proposal));
    bad.program.assumptions = ["After this, the team consistently performs complete handovers."];
    const r = validateProgramProposal(bad, CANONICAL, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("evidence_overclaim");
  });

  it("one proof-of-change sentence refuses the whole program", () => {
    const bad = JSON.parse(JSON.stringify(proposal));
    bad.program.warnings = ["The follow-up confirms the standard is reliably used."];
    const r = validateProgramProposal(bad, CANONICAL, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("evidence_overclaim");
  });
});
