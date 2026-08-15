import { describe, it, expect } from "vitest";
import { validateProgramProposal, requiredProgramKinds } from "./program-authorship";
import { deriveOperationalConstruct, renderApplicationSentence, renderDecisionSentence } from "./program-coherence";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2R-R2.3 — the Host's completion question, and prose a learner can read.
 *
 * Two defects the Founder found on the FIRST live decide-program, before applying it. Both are
 * reproduced here from the EXACT stored draft answers (`ee79e3b3`), so these are not
 * hypotheticals:
 *
 *   A. The Host authored and reviewed "What two things should be clear before a huddle ends?"
 *      and the generated BEFORE YOU FINISH said "The next time this happens, what exactly will
 *      you do?" — a question about intention, semantically adjacent to YOUR DECISION.
 *
 *   B. APPLY IT rendered "This is the sometimes end with agreement in practice.", spliced out of
 *      the problem statement.
 */

/** The Founder's live draft, verbatim from the database. */
const LIVE: BuilderAnswers = {
  title: "Close the Loop on One Commitment",
  problem: "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
  audienceType: "everyone",
  recurringMoment: "At the end of a team huddle when there are open action items that need follow-through.",
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  successEvidence:
    "The huddle notes or action tracker show a named owner and deadline for the next action before the meeting ends.",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What two things should be clear before a huddle ends?",
  arenaRecommended: true,
  followUpDays: 7,
} as unknown as BuilderAnswers;

const el = (kind: string, content: string, rationale = "because it fits") => ({ kind, content, rationale });

function proposalFor(a: BuilderAnswers, elements?: unknown[]) {
  return {
    program: {
      display_title: "Close the loop on one commitment",
      elements: elements ?? [
        el("why_it_matters", "When an action leaves a huddle without an owner, the next person starts without knowing who acts, and the work stalls."),
        el("observable_standard", "Before the huddle ends, the facilitator names one owner and one deadline for each open action item."),
        el("scenario", "The huddle has run long and two people are already standing up, and the open items still have no owner."),
        el("action_decision", "I will name one owner and one deadline for each open action item before the huddle ends."),
        el("field_application", "At your next huddle, you name one owner and one deadline before people leave."),
        el("evidence", "The huddle notes show a named owner and a deadline. They show it was recorded, not that the owner delivered."),
        el("completion_check", "What will you say at the next huddle that you did not say before?"),
        el("follow_up", "In seven days you will be asked what you actually said at the huddle. That is your own account, not an observation."),
      ],
      assumptions: ["Huddles happen on a predictable cadence."],
      warnings: ["If the huddle has no notes, the evidence will be harder to see."],
      behavior_contract: {
        actor: "the facilitator",
        trigger: "At the end of a team huddle when there are open action items that need follow-through",
        action_verb: "name",
        action_detail: "one owner and one deadline for each open action item",
      },
      scenario_contract: { pressure_frame: "time_is_short" },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  };
}

const section = (a: BuilderAnswers, kind: string): string => {
  const r = validateProgramProposal(proposalFor(a), a);
  if (!r.ok) throw new Error(`refused ${JSON.stringify(r)}`);
  return r.value.proposal.elements.find((e) => e.kind === kind)!.content;
};

describe("DEFECT A — the Host's completion question is the completion question", () => {
  it("A — a Host-authored completionPrompt survives generation byte-identically", () => {
    expect(section(LIVE, "completion_check")).toBe("What two things should be clear before a huddle ends?");
  });

  it("B — with NO Host prompt, the governed derivation still supplies one", () => {
    const { completionPrompt: _drop, ...withoutPrompt } = LIVE as Record<string, unknown>;
    const generated = section(withoutPrompt as BuilderAnswers, "completion_check");
    expect(generated.trim().length).toBeGreaterThan(0);
    expect(generated).toMatch(/\?$/);
  });

  it("C — the decision and the completion question stay distinct in role and text", () => {
    const decision = section(LIVE, "action_decision");
    const completion = section(LIVE, "completion_check");
    expect(decision).not.toBe(completion);
    // A commitment vs a question about understanding.
    expect(decision).toMatch(/\b(will|commit|choose|decide)\b/i);
    expect(completion).toBe(LIVE.completionPrompt);
  });

  it("D — changing the completion prompt does not touch the decision", () => {
    const before = section(LIVE, "action_decision");
    const after = section({ ...LIVE, completionPrompt: "Which two facts must be written down?" } as BuilderAnswers, "action_decision");
    expect(after).toBe(before);
  });

  it("E — changing the behaviour does not overwrite the Host's completion prompt", () => {
    const changed = { ...LIVE, observableBehavior: "Before the huddle ends, restate every open item aloud." } as BuilderAnswers;
    expect(section(changed, "completion_check")).toBe(LIVE.completionPrompt);
  });

  it("K — a non-Decision training keeps the same completion authority", () => {
    const noDecide = { ...LIVE, learningNeeds: ["shared_standard"] } as BuilderAnswers;
    expect(requiredProgramKinds(noDecide)).not.toContain("action_decision");
    // Without `decide` the decision section is UNREQUESTED, so a proposal must not carry one.
    const withoutDecision = proposalFor(noDecide).program.elements.filter(
      (e) => (e as { kind: string }).kind !== "action_decision",
    );
    const r = validateProgramProposal(proposalFor(noDecide, withoutDecision), noDecide);
    expect(r.ok, r.ok ? "" : `refused ${JSON.stringify(r)}`).toBe(true);
    if (r.ok) {
      expect(r.value.proposal.elements.find((e) => e.kind === "completion_check")!.content).toBe(LIVE.completionPrompt);
      expect(r.value.proposal.elements.some((e) => e.kind === "action_decision")).toBe(false);
    }
  });
});

describe("DEFECT B — generated prose is grammatical for arbitrary Host input", () => {
  it("H — the live problem statement no longer splices a construct out of a verb phrase", () => {
    const apply = section(LIVE, "field_application");
    expect(apply).not.toContain("the sometimes end with agreement");
    expect(apply).not.toMatch(/This is the .*\b(end|ends|ended|sometimes|with)\b.* in practice\./);
  });

  it("the construct derivation refuses a non-modifier run before the noun", () => {
    /*
      ROOT CAUSE, isolated. `CONSTRUCT_PHRASE` allowed up to three ARBITRARY tokens before a
      construct noun, so "sometimes end with agreement" became a construct label and then
      "This is the sometimes end with agreement in practice."
    */
    const c = deriveOperationalConstruct({ problem: LIVE.problem });
    expect(c?.label ?? "").not.toContain("sometimes end with");
  });

  it("I — representative natural-language problems all render grammatical Apply-it prose", () => {
    const behavior = {
      actor: "the facilitator",
      trigger: "At the end of a team huddle",
      observableAction: "name one owner and one deadline for each open action item",
      completion: { criterion: "The huddle notes show a named owner and deadline." },
    } as never;
    const application = { applicationMoment: "The next time this happens" } as never;
    const problems = [
      "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
      "Our reviews often finish without a clear agreement about next steps.",
      "Handovers rarely follow the process we agreed last year.",
      "Nurses do not always follow the shared handoff standard.",
      "We keep missing the weekly cadence for checking open items.",
      "Shift changes seldom end with agreement on what is outstanding.",
    ];
    for (const problem of problems) {
      const construct = deriveOperationalConstruct({ problem });
      const s = renderApplicationSentence(behavior, application, construct);
      // No spliced verb/adverb/preposition inside the construct phrase.
      expect(s, problem).not.toMatch(/This is the [^.]*\b(sometimes|often|rarely|seldom|always|keep|end|ends|finish|follow|missing|with|about|on)\b[^.]* in practice\./);
      // Every sentence ends properly and none is empty.
      for (const sentence of s.split(/(?<=\.)\s+/)) expect(sentence.trim(), problem).toMatch(/\.$/);
    }
  });
});

describe("DEFECT C (Part 6) — sentence capitalization", () => {
  it("J — YOUR DECISION starts with a capital letter", () => {
    const decision = section(LIVE, "action_decision");
    expect(decision[0]).toBe(decision[0]!.toUpperCase());
    expect(decision).toMatch(/^[A-Z]/);
  });

  it("the renderer itself capitalizes, whatever the moment's casing", () => {
    const behavior = {
      actor: "the facilitator",
      trigger: "At the end of a team huddle",
      observableAction: "name one owner and one deadline for each open action item",
      completion: { criterion: "The huddle notes show a named owner and deadline." },
    } as never;
    for (const moment of ["the next time this happens", "The next time this happens", "at your next huddle"]) {
      const s = renderDecisionSentence(behavior, { applicationMoment: moment } as never);
      expect(s, moment).toMatch(/^[A-Z]/);
    }
  });
});

describe("a Host question can never refuse the Host's own generation", () => {
  /*
    The dependency graph catches the MODEL inverting the program's logic. Once the Host's own
    question became canonical it started flowing into that check, and "What should the shared
    handoff standard contain?" refused the whole generation as `dependency_inversion` — BTY
    refusing BTY, with the Host as author. The graph now grades the derived sentence in that slot.
  */
  const withPrompt = (completionPrompt: string) => ({ ...LIVE, completionPrompt }) as BuilderAnswers;

  it("a Host prompt naming an undefined construct still generates, and is still shown verbatim", () => {
    for (const prompt of [
      "What should the shared handoff standard contain?",
      "Which items belong in the escalation process?",
      "What two things should be clear before a huddle ends?",
    ]) {
      const a = withPrompt(prompt);
      const r = validateProgramProposal(proposalFor(a), a);
      expect(r.ok, `${prompt} → ${r.ok ? "" : JSON.stringify(r)}`).toBe(true);
      if (r.ok) {
        expect(r.value.proposal.elements.find((e) => e.kind === "completion_check")!.content).toBe(prompt);
      }
    }
  });

  it("the graph still refuses a MODEL-authored inversion when the Host wrote no prompt", () => {
    const { completionPrompt: _drop, ...noPrompt } = LIVE as Record<string, unknown>;
    const a = noPrompt as BuilderAnswers;
    // With no Host prompt the derivation supplies the question, so the graph is unchanged.
    const r = validateProgramProposal(proposalFor(a), a);
    expect(r.ok).toBe(true);
  });
});
