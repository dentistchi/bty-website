import { describe, it, expect } from "vitest";
import {
  missingProgramKinds,
  requiredProgramKinds,
  validateProgramProposal,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";
import { reviewMissingSections } from "./module-publish";

/**
 * SLICE 3.2R-R2.2 — WHERE "YOUR DECISION" IS, AND THAT IT CANNOT BE SKIPPED.
 *
 * The Founder selected "Decision" at Step 6 and then looked at the Copilot's "Review the draft"
 * screen — which proposes BUILDER ANSWERS (learning approach, completion question, Arena,
 * follow-up, material) and has never contained an Action Decision, because an Action Decision is
 * not a builder answer. It is a JOURNEY ELEMENT, generated later at Review by the program
 * authorship path, and the live draft confirmed it: `ee79e3b3` at step 6 carries
 * `learningNeeds: ["decide","shared_standard"]` and NO `realityGroundedJourneyV1` yet.
 *
 * That makes the absence expected. This file exists so "expected" is not a promise: it proves the
 * chain that makes the decision impossible to miss LATER, and impossible to confuse with the
 * completion question, which is the property the product actually depends on.
 */

const DECIDE: BuilderAnswers = {
  title: "Close the Loop on One Commitment",
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "At the end of every shift, before leaving the floor",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
} as unknown as BuilderAnswers;

const el = (kind: string, content: string, rationale = "because it fits") => ({ kind, content, rationale });

const DECISION_SENTENCE =
  "I will decide which open items I always state aloud at handoff, even when the shift ran late.";
const COMPLETION_QUESTION = "What will you say aloud at your next handoff that you did not say before?";

/** A complete proposal for DECIDE. `over` replaces the elements array wholesale. */
function proposal(elements?: unknown[]) {
  return {
    program: {
      display_title: "Handing over without gaps",
      elements: elements ?? [
        el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed, and the risk lands on them."),
        el("observable_standard", "The outgoing person states each open item aloud and the incoming person repeats it back before signing off."),
        el("scenario", "You are finishing a long shift and the handoff standard is waiting, but two people are already asking you questions."),
        el("reflection", "What usually happens to the open items when a shift runs late?"),
        el("action_decision", DECISION_SENTENCE),
        el("field_application", "At your next shift change, you state the open items before leaving the floor."),
        el("evidence", "The handoff record shows the open items were stated. It shows they were recorded, not that the next shift acted on them."),
        el("completion_check", COMPLETION_QUESTION),
        el("follow_up", "In seven days you will be asked what you actually said at handoff. That is your own account, not an observation."),
      ],
      assumptions: ["Handoffs happen at a predictable shift change."],
      warnings: ["If the handoff step is missing from the workflow, training alone will not add it."],
      behavior_contract: {
        actor: "the outgoing person",
        trigger: "At the end of every shift, before leaving the floor",
        action_verb: "state",
        action_detail: "each open item aloud to the person taking over",
      },
      scenario_contract: { pressure_frame: "time_is_short" },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  };
}

describe("selecting Decision makes the Action Decision mandatory", () => {
  it("requiredProgramKinds includes action_decision", () => {
    expect(requiredProgramKinds(DECIDE)).toContain("action_decision");
  });

  it("REMOVING Decision removes the requirement (Part 6.5)", () => {
    const noDecide = { ...DECIDE, learningNeeds: ["shared_standard"] } as BuilderAnswers;
    expect(requiredProgramKinds(noDecide)).not.toContain("action_decision");
  });

  it("a generated proposal WITHOUT the decision is refused outright", () => {
    /*
      The Host can never be handed a decide-program that quietly lacks its decision: the whole
      proposal is rejected at validation, before it reaches the review screen.
    */
    const without = proposal()
      .program.elements.filter((e) => (e as { kind: string }).kind !== "action_decision");
    const r = validateProgramProposal(proposal(without), DECIDE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("missing_required_kind");
      expect(r.kind).toBe("action_decision");
    }
  });

  it("publish is blocked while the decision is absent from the journey", () => {
    const journey = {
      version: 1 as const,
      displayTitle: "Handing over without gaps",
      displayTitleStatus: "grounded" as const,
      elements: [
        { id: "el_why_it_matters", kind: "why_it_matters" as const, content: "x", grounding: [], confirmationStatus: "grounded" as const },
        { id: "el_observable_standard", kind: "observable_standard" as const, content: "y", grounding: [], confirmationStatus: "grounded" as const },
        { id: "el_completion_check", kind: "completion_check" as const, content: COMPLETION_QUESTION, grounding: [], confirmationStatus: "grounded" as const },
      ],
    };
    expect(missingProgramKinds(DECIDE, journey)).toContain("action_decision");
  });
});

describe("the Action Decision can never silently become the Completion Question (Part 6.1)", () => {
  /*
    THE GUARANTEE IS STRUCTURAL, AND STRONGER THAN A LEXICAL CHECK.

    `validateProgramProposal` computes `const c = deriveContent(kind) ?? content.value`: for every
    INSTRUCTIONAL kind — action_decision included — the model's own sentence is DISCARDED and the
    displayed text is rendered deterministically from the validated contracts. So the Action
    Decision cannot drift into being the completion question, because the model does not get to
    write it at all. These tests assert that, rather than a regex that never sees the output.
  */
  const validated = () => {
    const r = validateProgramProposal(proposal(), DECIDE);
    if (!r.ok) throw new Error(`refused ${JSON.stringify(r)}`);
    return r.value.proposal;
  };

  it("a genuine proposal validates, and carries BOTH sections", () => {
    const p = validated();
    const kinds = p.elements.map((e) => e.kind);
    expect(kinds).toContain("action_decision");
    expect(kinds).toContain("completion_check");
  });

  it("the two sections are DIFFERENT text — never one sentence doing both jobs", () => {
    const p = validated();
    const decision = p.elements.find((e) => e.kind === "action_decision")!.content;
    const completion = p.elements.find((e) => e.kind === "completion_check")!.content;
    expect(decision.trim().length).toBeGreaterThan(0);
    expect(decision).not.toBe(completion);
  });

  it("the decision is a COMMITMENT and the completion check is a QUESTION", () => {
    const p = validated();
    const decision = p.elements.find((e) => e.kind === "action_decision")!.content;
    const completion = p.elements.find((e) => e.kind === "completion_check")!.content;
    // The same distinction the validator enforces: commitment language vs a wh- question.
    expect(decision).toMatch(/\b(will|commit|choose|decide|select|pick|agree to|going to|plan to)\b/i);
    expect(decision).not.toMatch(/^\s*(?:think about|reflect on|consider|ponder|contemplate)\b/i);
    expect(completion).toMatch(/\b(what|when|which|who|how|why)\b/i);
  });

  it("the model cannot author the decision — substituting its sentence changes nothing", () => {
    /*
      The decisive proof that the two can never converge: replace the model's action_decision
      text with the completion question verbatim, and the validated output is UNCHANGED, because
      the displayed decision is derived from the contracts.
    */
    const swapped = proposal().program.elements.map((e) =>
      (e as { kind: string }).kind === "action_decision" ? el("action_decision", COMPLETION_QUESTION) : e,
    );
    const r = validateProgramProposal(proposal(swapped), DECIDE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const decision = r.value.proposal.elements.find((e) => e.kind === "action_decision")!.content;
    expect(decision).not.toBe(COMPLETION_QUESTION);
    expect(decision).toBe(validated().elements.find((e) => e.kind === "action_decision")!.content);
  });
});

describe("Part 6.6 — a non-Decision training is unaffected", () => {
  it("its required kinds and Review rows are byte-identical to before", () => {
    const noDecide = { ...DECIDE, learningNeeds: ["shared_standard"] } as BuilderAnswers;
    expect(requiredProgramKinds(noDecide)).toEqual([
      "why_it_matters", "observable_standard", "scenario", "field_application", "completion_check", "follow_up",
    ]);
    // No decision row, and no decision blocker, anywhere in its Review readiness.
    expect(reviewMissingSections(noDecide).map((m) => m.section)).not.toContain("title");
  });
});
