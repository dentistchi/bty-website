import { describe, it, expect } from "vitest";
import { AUDIENCE_POLICY, audienceAuthorityFor, audiencePromptLines } from "./audience-authority";
import { AUDIENCE_TYPES, type BuilderAnswers } from "./module-builder";
import {
  validateProgramProposal, requiredProgramKinds, groundingCorpus, isSemanticRepairableCode,
} from "./program-authorship";
import { CONTRACT_DEFECT_REASONS, CANONICAL_ACTOR, isInterrogativeAction } from "./program-coherence";

/** Split a whole action phrase into the v15 wire fields (Slice 3.2P-R3.7-R2). */
const splitAction = (action: string) => {
  const [verb, ...rest] = action.trim().split(/\s+/);
  return { action_verb: verb ?? "", action_detail: rest.join(" ") };
};

/**
 * SLICE 3.2P-R3.2-R1 — THREE ROLES, KEPT APART.
 *
 * W3 generated cleanly for a `leaders` draft and produced `actor: "a team member"` with
 * `confirmed_by: "the team lead"`. The source names team members only as the people who REPORT
 * problems and leave — the group the training is ABOUT — and never mentions a team lead. Its
 * evidence sentence is agentless.
 *
 * R3.2 blocked that by constraining the model's actor LABEL, and was still too permissive: it let
 * the AUDIENCE authorize a confirmer, so "the team lead" stayed legal for a `leaders` draft, and
 * it let any role word anywhere in the source authorize an actor.
 *
 * The repair separates the three roles. The LEARNER is server-written as `you` — the Host's
 * audience already decides who that is, so nothing the model writes can widen or narrow it. A
 * COUNTERPART is whoever the trained action itself involves. A CONFIRMER must be one of those, or
 * someone the Host's own words name; an audience never authorizes one.
 */
const PILOT = {
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?",
  recurringMoment: "During morning huddles",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const VERIFIED = ["education.pdf"];
const CORPUS = groundingCorpus(PILOT, VERIFIED);
const AUTH = audienceAuthorityFor(PILOT);

const CONTENT: Record<string, string> = {
  why_it_matters: "When a huddle ends without a named owner and a deadline, the problem that was raised stays exactly where it was.",
  observable_standard: "The huddle leader names one owner and one deadline for every agreed action before the group leaves.",
  scenario: "The huddle is running late and people are already standing to leave.",
  reflection: "In your own words, what is the most important standard from this training?",
  field_application: "At the next morning huddle, name one owner and one deadline for every agreed action and write them in the huddle note.",
  completion_check: "What exactly will you say at the next morning huddle to name the owner and the deadline?",
  follow_up: "In seven days you will be asked what you actually said at the huddle.",
};
const KINDS = requiredProgramKinds(PILOT);

// Base form, as the wire contract takes it after "must" (Slice 3.2P-R3.7-R2).
const ACTION = "name one owner and one deadline for every agreed action and write them in the huddle note";
/*
  ONE MODEL FIELD since Slice 3.2P-R3.6-R1 — the trigger joined the actor and the completion as
  Host/server authority. The overrides below still pass an `actor`, which is exactly how these
  tests prove the label reaches nothing.
*/
const GROUNDED = splitAction(ACTION);
/**
 * The exact W3 shape, MINUS the half v11 deleted (Slice 3.2P-R3.4-R1). W3 also returned
 * `completion: { confirmed_by: "the team lead", … }` for a source that never mentions one; the
 * schema has no field for it now, so what remains of the drift is the actor label.
 */
const DRIFTED = {
  ...GROUNDED,
  actor: "a team member",
  trigger: "every Tuesday at the quarterly review",
  action_verb: "confirm", action_detail: "the owner of each action and state the deadline",
};

const proposal = (contract: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  program: {
    display_title: "End every huddle with an owner and a deadline",
    elements: KINDS.map((k) => ({ kind: k, content: CONTENT[k], rationale: "grounded in the host's own answers" })),
    assumptions: ["the team holds a morning huddle"],
    warnings: ["a huddle nobody attends is an attendance problem, not a training one"],
    behavior_contract: contract,
    scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    ...over,
  },
});

const run = (c: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  validateProgramProposal(proposal(c, over), PILOT, VERIFIED);
const verdict = (c: Record<string, unknown>, over: Record<string, unknown> = {}) => {
  const r = run(c, over);
  return r.ok ? "PASS" : `${r.code}${r.contract ? ` [${r.contract.field}/${r.contract.reason}]` : ""}`;
};
const rendered = (c: Record<string, unknown>) => {
  const r = run(c);
  if (!r.ok) throw new Error(`expected PASS, got ${r.code}`);
  return Object.fromEntries(r.value.proposal.elements.map((e) => [e.kind, e.content])) as Record<string, string>;
};

describe("[R3.2-R1] A/B/F — the learner population cannot be redefined by the model", () => {
  it("A — the W3 actor never reaches a participant: the subject is server-written", () => {
    const out = rendered(DRIFTED);
    for (const kind of ["observable_standard", "scenario", "field_application"]) {
      expect(out[kind], kind).toContain(`, ${CANONICAL_ACTOR} must `);
      expect(out[kind].toLowerCase(), kind).not.toContain("a team member must");
    }
  });

  it("B — the subject no longer depends on the label at all", () => {
    const a = rendered(GROUNDED);
    const b = rendered({ ...GROUNDED, actor: "the shift supervisor" });
    const c = rendered({ ...GROUNDED, actor: "a team member" });
    expect(a.observable_standard).toBe(b.observable_standard);
    expect(a.observable_standard).toBe(c.observable_standard);
    expect(a.observable_standard).toMatch(/^During morning huddles, you must /);
  });

  it("F — a non-learner mentioned in the problem cannot become the subject", () => {
    expect(CORPUS).toContain("team members");
    expect(rendered(DRIFTED).observable_standard.toLowerCase())
      .not.toContain("team member");
  });

  it("C/D/E — no audience can be widened or narrowed, because none of them writes the subject", () => {
    for (const audienceType of AUDIENCE_TYPES) {
      const detail = audienceType === "job_group" || audienceType === "specific_role" ? "Marketing team" : undefined;
      const answers = { ...PILOT, audienceType, audienceDetail: detail } as unknown as BuilderAnswers;
      for (const actor of ["a team member", "the charge nurse", "front desk staff", "the regional director"]) {
        const r = validateProgramProposal(proposal({ ...GROUNDED, actor }), answers, VERIFIED);
        expect(r.ok, `${audienceType} / ${actor}`).toBe(true);
        if (!r.ok) continue;
        const std = r.value.proposal.elements.find((e) => e.kind === "observable_standard")!.content;
        expect(std, `${audienceType} / ${actor}`).toContain(`, ${CANONICAL_ACTOR} must `);
      }
    }
  });
});

/*
  G–I and the R3.2-R2 role-identity block are REMOVED (Slice 3.2P-R3.4-R1), with the function
  they tested.

  `confirmerAuthorized` was three gates deep and earned every one of them against real
  refusals — the relational counterpart that saved "the person taking over", the role-head rule
  that caught "the records manager" matching the host's VERB, the Korean particle stripping that
  let 담당자를 authorise 담당자. It refused W4 correctly.

  It is gone because the field it guarded is gone. v11 takes completion from the host's own
  `successEvidence`, so there is no confirmer for a model to invent and nothing for an authority
  check to be right about. Deleting the tests with the code is the honest move: a suite that
  still described a confirmer floor would say this product has one.

  What it protected is now asserted structurally instead — see `programCoherenceRefusal` (no
  completion field in the schema) and the preview's "no second person appears anywhere".
*/

describe("[R3.2-R1] J–P — everything else is unchanged", () => {
  it("J — Q: the W3 actor label reaches nothing, because the subject is server-written", () => {
    /*
      R3.2-R1's answer to a drifted actor was not to refuse it but to make it inert: every
      participant-facing subject is `CANONICAL_ACTOR`. So this PASSES, and the sentence it
      produces addresses the learner the Host chose — which is exactly what the confirmer half
      of W3 could not do, and why that half needed removing rather than policing.
    */
    const r = run(DRIFTED);
    expect(r.ok).toBe(true);
    const text = Object.values(rendered(DRIFTED)).join(" ");
    expect(text).not.toContain("a team member");
    expect(text).not.toContain("the team lead");
    // …and since R3.6-R1 a drifted MOMENT is inert for the same reason: the Host owns it.
    expect(text).not.toContain("quarterly review");
    expect(rendered(DRIFTED).observable_standard.startsWith(`During morning huddles, ${CANONICAL_ACTOR} must`)).toBe(true);
  });

  it("K — the fully grounded seven-kind proposal still PASSES", () => {
    expect(verdict(GROUNDED)).toBe("PASS");
  });

  it("L — scenario pressure still works and is still repairable", () => {
    const r = run(GROUNDED, { scenario_contract: { pressure_condition: "the team works hard every day", pressure_detail: null } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("scenario_without_pressure");
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(true);
  });

  it("M — the interrogative floor is unchanged", () => {
    expect(isInterrogativeAction(PILOT.observableBehavior as string)).toBe(true);
    expect(verdict({ ...GROUNDED, ...splitAction(PILOT.observableBehavior as string) }))
      .toBe("non_observable_standard [observableAction/interrogative_action]");
  });

  it("N — the filename material floor is unchanged", () => {
    const r = run(GROUNDED, {
      elements: KINDS.map((k) => ({
        kind: k,
        content: k === "reflection" ? "Which of the items the education.pdf checklist lists do you skip most often?" : CONTENT[k],
        rationale: "grounded",
      })),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("O — the evidence ceiling and follow-up semantics are unchanged", () => {
    const out = rendered(GROUNDED);
    expect(out.follow_up).toContain("7 days");
    expect(out.follow_up.toLowerCase()).toContain("not an observation");
  });

  it("the confirmer failure is NOT repairable", () => {
    expect(isSemanticRepairableCode("non_observable_standard")).toBe(false);
  });

  it("the closed vocabulary grows only by decision, and `actor_unauthorized` is not in it", () => {
    for (const r of ["missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation", "interrogative_action"]) {
      expect(CONTRACT_DEFECT_REASONS, r).toContain(r);
    }
    expect(CONTRACT_DEFECT_REASONS).toContain("confirmer_unauthorized");
    expect(CONTRACT_DEFECT_REASONS as readonly string[]).not.toContain("actor_unauthorized");
    expect(CONTRACT_DEFECT_REASONS).toHaveLength(9);
  });
});

describe("[R3.2-R1] prompt / validator / renderer parity", () => {
  it("every audience value has exactly one policy line", () => {
    expect(AUDIENCE_POLICY.map((p) => p.id).sort()).toEqual([...AUDIENCE_TYPES].sort());
  });

  it("the prompt states the rules the floor enforces, from the same authority", () => {
    const lines = audiencePromptLines(AUTH).join("\n");
    expect(lines).toContain(AUTH!.policy.promptLine);
    expect(lines).toMatch(/host decided this, not you/i);
    expect(lines).toMatch(/BTY writes the participant-facing subject itself, in the second person/i);
    expect(lines).toMatch(/is ABOUT\. It is not automatically who the training is FOR/);
    expect(lines).toMatch(/Do NOT appoint a manager, lead or reviewer the host never mentioned/i);
    expect(lines).toMatch(/leave it that way/i);
  });

  it("a detail-bearing audience puts the Host's own words in the prompt", () => {
    const a = audienceAuthorityFor({ ...PILOT, audienceType: "job_group", audienceDetail: "Marketing team" } as unknown as BuilderAnswers);
    expect(audiencePromptLines(a).join("\n")).toContain("Marketing team");
  });

  it("the renderer and the validator agree on the subject", () => {
    expect(CANONICAL_ACTOR).toBe("you");
    expect(rendered(GROUNDED).observable_standard).toContain("you must name one owner");
  });
});
