import { describe, it, expect } from "vitest";
import {
  EVIDENCE_POLICY,
  assertsOverclaimByPolicy,
  evidencePolicyMatrix,
  evidencePolicyPromptLines,
  OUTCOME_OBJECTS,
  OUTCOME_OBJECT_WORDS,
} from "./evidence-policy";
import {
  evidenceClaimBrief,
  isSemanticRepairableCode,
  requiredProgramKinds,
  semanticRepairInstruction,
  validateProgramProposal,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2L-R11.4I — the anti-drift tests.
 *
 * Three consecutive paid windows were refused for `evidence_overclaim` against a prompt
 * that carried an evidence ceiling each time. R11.4H aligned validator and prompt by hand;
 * the next window failed on a rule the prompt still did not mention. These tests exist so
 * that cannot happen a fourth time: the policy is one array, and a rule that does not reach
 * the model fails here rather than in a paid window.
 */
const CANONICAL: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
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

describe("[3.2L-R11.4I] one policy, two consumers", () => {
  it("every rule reaches the model — a rule the prompt never mentions is the defect this closes", () => {
    const brief = evidenceClaimBrief(CANONICAL).join("\n");
    const unreached = EVIDENCE_POLICY.filter((r) => !brief.includes(r.promptLine));
    expect(unreached.map((r) => r.id)).toEqual([]);
    expect(evidencePolicyPromptLines()).toHaveLength(EVIDENCE_POLICY.length);
  });

  it("every outcome the validator refuses is named in words the model can act on", () => {
    const stems = OUTCOME_OBJECTS.map((a) =>
      a.replace(/s\?$/, "").replace(/\\w\*/g, "").replace(/\\/g, "").replace(/[()?:]/g, "").trim(),
    );
    const said = OUTCOME_OBJECT_WORDS.join(" ").toLowerCase();
    expect(stems.filter((s) => !said.includes(s.toLowerCase()))).toEqual([]);
  });

  it("rule ids are unique and every rule carries a sample and a rewrite", () => {
    expect(new Set(EVIDENCE_POLICY.map((r) => r.id)).size).toBe(EVIDENCE_POLICY.length);
    for (const r of EVIDENCE_POLICY) {
      expect(r.promptLine.length, r.id).toBeGreaterThan(20);
      expect(r.forbiddenSample.length, r.id).toBeGreaterThan(10);
      expect(r.legalRewrite.length, r.id).toBeGreaterThan(10);
    }
  });
});

describe("[3.2L-R11.4I] adversarial matrix, derived from the policy itself", () => {
  const matrix = evidencePolicyMatrix();

  it("covers every rule — the matrix cannot fall behind the policy", () => {
    expect(matrix.map((m) => m.id).sort()).toEqual(EVIDENCE_POLICY.map((r) => r.id).sort());
  });

  it("every forbidden sample is refused, by its OWN rule", () => {
    for (const { id, forbidden } of matrix) {
      const hit = assertsOverclaimByPolicy(forbidden);
      expect(hit?.id, `${id}: ${forbidden}`).toBe(id);
    }
  });

  it("every legal rewrite passes", () => {
    for (const { id, legal } of matrix) {
      expect(assertsOverclaimByPolicy(legal)?.id ?? null, `${id}: ${legal}`).toBeNull();
    }
  });

  it("the honest denial of each claim is still legal", () => {
    for (const { id, forbidden } of matrix) {
      const denied = `This does not mean ${forbidden.charAt(0).toLowerCase()}${forbidden.slice(1)}`;
      expect(assertsOverclaimByPolicy(denied)?.id ?? null, `${id}: ${denied}`).toBeNull();
    }
  });

  it("the live refusal families are all represented", () => {
    const ids = EVIDENCE_POLICY.map((r) => r.id);
    for (const expected of [
      "organisational_outcome", "habitual_performance", "proof_of_high_rung",
      "readiness_claim", "competence_claim", "permanence_claim", "verification_claim",
      "improvement_claim", "guarantee_claim",
    ]) {
      expect(ids).toContain(expected);
    }
  });
});

describe("[3.2L-R11.4I] bounded semantic repair", () => {
  it("only the two honesty families are repairable", () => {
    expect(isSemanticRepairableCode("evidence_overclaim")).toBe(true);
    expect(isSemanticRepairableCode("material_fabrication")).toBe(true);
    for (const terminal of ["scenario_without_pressure", "non_observable_standard", "dependency_inversion", "person_evaluation"] as const) {
      expect(isSemanticRepairableCode(terminal), terminal).toBe(false);
    }
  });

  it("the repair instruction carries category, ceiling, preservation and scope — and no model prose", () => {
    const msg = semanticRepairInstruction("evidence_overclaim", CANONICAL);
    expect(msg).toMatch(/proves more than it can/i);
    expect(msg).toMatch(/reflection, not competence/);      // the derived ceiling
    expect(msg).toMatch(/Change ONLY the sentences/);
    expect(msg).toMatch(/Keep the same behaviour/);
    expect(msg).toMatch(/ONLY the JSON object/);
    const material = semanticRepairInstruction("material_fabrication", CANONICAL);
    expect(material).toMatch(/does not exist|nobody has read/i);
    expect(material).toMatch(/CREATES what they need/);
  });

  it("the instruction is generic — it names no subject matter", () => {
    for (const code of ["evidence_overclaim", "material_fabrication"] as const) {
      expect(semanticRepairInstruction(code, CANONICAL).toLowerCase()).not.toMatch(/handoff|handover|shift/);
    }
  });
});

/**
 * PART 9 — variation, not one golden sentence set. Three materially different programs,
 * each authored from the same canonical facts, all inside the ceiling.
 */
describe("[3.2L-R11.4I] multiple different 7-section proposals validate", () => {
  const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });
  const build = (v: {
    title: string; why: string; standard: string; scenario: string; decision: string;
    application: string; evidence: string; completion: string; followUp: string;
    actor: string; trigger: string; action: string; confirmedBy: string; confirmation: string;
    pressure: string;
  }) => ({
    program: {
      display_title: v.title,
      elements: [
        el("why_it_matters", v.why), el("observable_standard", v.standard), el("scenario", v.scenario),
        el("action_decision", v.decision), el("field_application", v.application),
        el("evidence", v.evidence), el("completion_check", v.completion), el("follow_up", v.followUp),
      ],
      assumptions: ["The moment described happens regularly."],
      warnings: ["If the step is missing from the workflow, training alone will not add it."],
      behavior_contract: {
        actor: v.actor, trigger: v.trigger, observable_action: v.action,
        completion: { confirmed_by: v.confirmedBy, confirmation_action: v.confirmation },
      },
      scenario_contract: { pressure_condition: v.pressure, pressure_detail: null },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  });

  const VARIANTS = [
    build({
      title: "Handing over without gaps",
      why: "When a handover misses a step, the next person starts without knowing what changed.",
      standard: "The outgoing person states each open item aloud and the incoming person repeats it back.",
      scenario: "The shift ran late and two people are already waiting to ask you questions.",
      decision: "I will decide which open items I always state aloud, even when the shift ran late.",
      application: "At your next handover, you state the open items before leaving.",
      evidence: "Create a handoff record naming the responsible person and the next action. It shows the items were stated, not that the next shift acted on them.",
      completion: "What will you say aloud at your next handover that you did not say before?",
      followUp: "In seven days you will be asked what you actually said. That is your own account, not an observation.",
      actor: "the outgoing person", trigger: "At the end of every shift, before leaving the floor",
      action: "state each open item aloud to the person taking over",
      confirmedBy: "the person taking over", confirmation: "repeat the open items back",
      pressure: "two people are already waiting and the shift ran late",
    }),
    build({
      title: "Naming what is still open",
      why: "Work that nobody names is work nobody owns when the next person picks it up.",
      standard: "The person leaving says every unfinished task aloud and who will pick it up, and the other person repeats it back.",
      scenario: "A senior colleague is waiting and has already said they know what is going on.",
      decision: "I will choose the two tasks I never leave unnamed, whatever the pressure.",
      application: "At your next changeover, you name the unfinished tasks before anyone leaves.",
      evidence: "Write down the tasks said aloud and who took them. That records what was said, not whether it was done.",
      completion: "Which unfinished task have you left unnamed before, and what will you say this time?",
      followUp: "At follow-up, review whether the tasks you named were written down in a real changeover.",
      actor: "the person handing over", trigger: "Every time work passes to someone else",
      action: "say each unfinished task aloud and name who will pick it up",
      confirmedBy: "the person taking the work", confirmation: "repeat back each task and its owner",
      pressure: "a senior colleague says they already know what is going on",
    }),
    build({
      title: "The last five minutes",
      why: "The end of a shift is when detail is dropped, because everyone is already leaving.",
      standard: "The outgoing person reads the open list aloud, and the incoming person confirms which item they will start with.",
      scenario: "It is past the end of the shift and the room has already started emptying.",
      decision: "I will decide the moment I start the read-out, so it is never squeezed out.",
      application: "At your next shift end, you read the open list aloud before anyone leaves.",
      evidence: "Keep the read-out list. It records what was read, never what happened afterwards.",
      completion: "When exactly will you start the read-out at your next shift end?",
      followUp: "At follow-up, discuss whether the read-out happened and what got in the way.",
      actor: "the outgoing person", trigger: "In the last five minutes of every shift",
      action: "read the open list aloud to the person taking over",
      confirmedBy: "the person taking over", confirmation: "confirm which item they will start with",
      pressure: "the shift has already ended and the room is emptying",
    }),
  ];

  it("all three validate, and they are materially different", () => {
    expect(requiredProgramKinds(CANONICAL)).toHaveLength(7);
    const titles = new Set(VARIANTS.map((v) => v.program.display_title));
    expect(titles.size).toBe(3);
    VARIANTS.forEach((p, i) => {
      const r = validateProgramProposal(p, CANONICAL, []);
      if (!r.ok) throw new Error(`variant ${i} refused: ${r.code}${r.kind ? ` (${r.kind})` : ""}`);
      expect(r.ok).toBe(true);
    });
  });

  it("each variant fails if ANY policy rule's forbidden sample is injected where a participant reads it", () => {
    for (const { id, forbidden } of evidencePolicyMatrix()) {
      const bad = JSON.parse(JSON.stringify(VARIANTS[0]));
      bad.program.assumptions = [forbidden];
      const r = validateProgramProposal(bad, CANONICAL, []);
      expect(r.ok, `${id}: ${forbidden}`).toBe(false);
      if (!r.ok) expect(r.code, id).toBe("evidence_overclaim");
    }
  });
});
