import { describe, it, expect } from "vitest";
import {
  AUDIENCE_POLICY, audienceAuthorityFor, actorAuthorized, confirmerAuthorized, audiencePromptLines,
} from "./audience-authority";
import { AUDIENCE_TYPES, type BuilderAnswers } from "./module-builder";
import {
  validateProgramProposal, requiredProgramKinds, groundingCorpus, isSemanticRepairableCode,
} from "./program-authorship";
import { CONTRACT_DEFECT_REASONS, isInterrogativeAction } from "./program-coherence";

/**
 * SLICE 3.2P-R3.2 — WHO THE TRAINING IS FOR IS THE HOST'S DECISION.
 *
 * W3 generated successfully for a `leaders` draft and produced `actor: "a team member"`,
 * `confirmed_by: "the team lead"`. The source names "team members" only as the people who
 * REPORT problems and leave without naming an owner — the population the training is ABOUT —
 * and never mentions a team lead. `audienceType` reached the prompt and no validator, so one
 * invented word rendered into all four derived instructional sections.
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

const GROUNDED = {
  actor: "the huddle leader",
  trigger: "at each morning huddle, before the group leaves",
  observable_action: "names one owner and one deadline for every agreed action and writes them in the huddle note",
  completion: { confirmed_by: "the named owner", confirmation_action: "repeat back the action and the deadline" },
};
/** The exact W3 shape. */
const DRIFTED = {
  ...GROUNDED,
  actor: "a team member",
  observable_action: "confirm the owner of each action and state the deadline",
  completion: { confirmed_by: "the team lead", confirmation_action: "record the owner and deadline in the huddle notes" },
};

const verdict = (c: Record<string, unknown>) => {
  const r = validateProgramProposal(proposal(c), PILOT, VERIFIED);
  return r.ok ? "PASS" : `${r.code}${r.contract ? ` [${r.contract.field}/${r.contract.reason}]` : ""}`;
};

describe("[3.2P-R3.2] A/E — the W3 drift is refused deterministically", () => {
  it("A — the actor alone", () => {
    expect(actorAuthorized("a team member", AUTH, CORPUS)).toEqual({ ok: false, reason: "audience_mismatch" });
  });

  it("E — and the whole seven-kind proposal never reaches success", () => {
    expect(verdict(DRIFTED)).toBe("non_observable_standard [actor/actor_unauthorized]");
  });

  it("the fault is NOT repairable — a wrong audience is not one sentence away from right", () => {
    expect(isSemanticRepairableCode("non_observable_standard")).toBe(false);
  });
});

describe("[3.2P-R3.2] B/D — the authoritative shapes still pass", () => {
  it("B — a leading role for a `leaders` audience", () => {
    for (const actor of ["the huddle leader", "the shift supervisor", "the team lead", "the charge nurse", "the manager on duty", "팀장"]) {
      expect(actorAuthorized(actor, AUTH, CORPUS).ok, actor).toBe(true);
    }
  });

  it("D — a confirmer the Host's own words name", () => {
    // "owner" is in the host's successEvidence and completionPrompt.
    expect(confirmerAuthorized("the named owner", AUTH, CORPUS).ok).toBe(true);
    expect(confirmerAuthorized("the action owner", AUTH, CORPUS).ok).toBe(true);
  });

  it("and the fully grounded proposal still PASSES end to end", () => {
    expect(verdict(GROUNDED)).toBe("PASS");
  });
});

describe("[3.2P-R3.2] C — the confirmer rule, and exactly how far it reaches", () => {
  it("for a DETAIL-BEARING audience, a confirmer from outside the named population is refused", () => {
    const jobGroup = { ...PILOT, audienceType: "job_group", audienceDetail: "Marketing team" } as unknown as BuilderAnswers;
    const auth = audienceAuthorityFor(jobGroup);
    expect(confirmerAuthorized("the compliance officer", auth, groundingCorpus(jobGroup, []))).toEqual({ ok: false, reason: "ungrounded_role" });
    expect(confirmerAuthorized("the marketing lead", auth, groundingCorpus(jobGroup, [])).ok).toBe(true);
  });

  it("MEASURED, AND WHY THE RULE IS NARROW: a broad audience keeps its generic counterpart", () => {
    /*
      The first version of this rule required EVERY confirmer to be grounded in the host's own
      words. It refused "the person taking over" — the confirmer in this repository's canonical
      fixture, and an honest one: the other party to a handover is not a role anybody invented.
      Forty-four existing assertions said so, so the rule now applies only where the host named
      exactly who the training is for. `everyone` and `leaders` are governed by the ACTOR rule,
      which is where W3's defect actually lived.
    */
    expect(confirmerAuthorized("the person taking over", audienceAuthorityFor({ ...PILOT, audienceType: "everyone" } as unknown as BuilderAnswers), CORPUS).ok).toBe(true);
    expect(confirmerAuthorized("the compliance officer", AUTH, CORPUS).ok, "leaders: not reached by this rule").toBe(true);
  });

  it("the host's own agentless artifact may still confirm — that is their sentence, not an invention", () => {
    // "The huddle note records one owner and one deadline" is the host's own evidence.
    expect(verdict({ ...GROUNDED, completion: { confirmed_by: "the huddle note", confirmation_action: "record the owner and the deadline" } }))
      .toBe("PASS");
  });
});

describe("[3.2P-R3.2] J — the authority works across every audience type, not just this one", () => {
  const withAudience = (audienceType: string, audienceDetail?: string) =>
    audienceAuthorityFor({ ...PILOT, audienceType, audienceDetail } as unknown as BuilderAnswers);

  it("every enum value has exactly one policy", () => {
    expect(AUDIENCE_POLICY.map((p) => p.id).sort()).toEqual([...AUDIENCE_TYPES].sort());
    for (const p of AUDIENCE_POLICY) {
      expect(p.promptLine.length, p.id).toBeGreaterThan(20);
      expect(p.example.length, p.id).toBeGreaterThan(3);
    }
  });

  it("`everyone` accepts any role — the Host named no narrower one", () => {
    const a = withAudience("everyone");
    for (const actor of ["a team member", "the night shift pharmacist", "each person on the team"]) {
      expect(actorAuthorized(actor, a, CORPUS).ok, actor).toBe(true);
    }
  });

  it("`job_group` is bound to the group the Host named", () => {
    const a = withAudience("job_group", "Marketing team");
    expect(actorAuthorized("the marketing coordinator", a, CORPUS).ok).toBe(true);
    expect(actorAuthorized("the night shift pharmacist", a, CORPUS).ok).toBe(false);
  });

  it("`specific_role` is bound to the role the Host named", () => {
    const a = withAudience("specific_role", "Assistant");
    expect(actorAuthorized("the assistant on duty", a, CORPUS).ok).toBe(true);
    expect(actorAuthorized("the regional director", a, CORPUS).ok).toBe(false);
  });

  it("a role the Host wrote anywhere in their own answers is authorized", () => {
    // Nothing in `leaders`' vocabulary covers this, but the Host's own problem text does.
    const answers = { ...PILOT, problem: "Our dispatchers close a job without recording who signed it off." } as unknown as BuilderAnswers;
    const corpus = groundingCorpus(answers, []);
    expect(actorAuthorized("the dispatcher", audienceAuthorityFor(answers), corpus).ok).toBe(true);
  });

  it("IDENTITY, not substring — the W3 drift cannot pass on shared filler words", () => {
    /*
      "team", "member", "people", "staff" appear all over the Host's problem statement while
      describing a DIFFERENT population. A naive corpus check would have accepted "a team
      member" for exactly that reason. These are stop words.
    */
    expect(CORPUS).toContain("team members");
    expect(actorAuthorized("a team member", AUTH, CORPUS).ok).toBe(false);
    expect(actorAuthorized("the people", AUTH, CORPUS).ok).toBe(false);
    expect(actorAuthorized("a staff member", AUTH, CORPUS).ok).toBe(false);
  });
});

describe("[3.2P-R3.2] F/G/H/I — nothing else moved", () => {
  it("F — scenario pressure still works and is still repairable", () => {
    expect(verdict({ ...GROUNDED })).toBe("PASS");
    const noPressure = validateProgramProposal(
      proposal(GROUNDED, { scenario_contract: { pressure_condition: "the team works hard every day", pressure_detail: null } }),
      PILOT, VERIFIED,
    );
    expect(noPressure.ok).toBe(false);
    if (!noPressure.ok) expect(noPressure.code).toBe("scenario_without_pressure");
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(true);
  });

  it("G — the interrogative floor is unchanged", () => {
    expect(isInterrogativeAction(PILOT.observableBehavior as string)).toBe(true);
    expect(verdict({ ...GROUNDED, observable_action: PILOT.observableBehavior as string }))
      .toBe("non_observable_standard [observableAction/interrogative_action]");
  });

  it("H — the filename material floor is unchanged", () => {
    const r = validateProgramProposal(
      proposal(GROUNDED, {
        elements: KINDS.map((k) => ({
          kind: k,
          content: k === "reflection" ? "Which of the items the education.pdf checklist lists do you skip most often?" : CONTENT[k],
          rationale: "grounded",
        })),
      }),
      PILOT, VERIFIED,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("I — the evidence ceiling and follow-up semantics are unchanged", () => {
    const r = validateProgramProposal(proposal(GROUNDED), PILOT, VERIFIED);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const followUp = r.value.proposal.elements.find((e) => e.kind === "follow_up")!;
    expect(followUp.content).toContain("7 days");
    expect(followUp.content.toLowerCase()).toContain("not an observation");
  });

  it("the closed reason vocabulary grew by exactly two, and lost nothing", () => {
    for (const r of ["missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation", "interrogative_action"]) {
      expect(CONTRACT_DEFECT_REASONS, r).toContain(r);
    }
    expect(CONTRACT_DEFECT_REASONS).toContain("actor_unauthorized");
    expect(CONTRACT_DEFECT_REASONS).toContain("confirmer_unauthorized");
    expect(CONTRACT_DEFECT_REASONS).toHaveLength(9);
  });
});

describe("[3.2P-R3.2] prompt / validator parity", () => {
  it("the prompt states the rule the floor enforces, from the same authority", () => {
    const lines = audiencePromptLines(AUTH).join("\n");
    expect(lines).toContain(AUTH!.policy.promptLine);
    expect(lines).toMatch(/host decided this, not you/i);
    expect(lines).toMatch(/is ABOUT — it is not automatically who the training is FOR/);
    expect(lines).toMatch(/Do NOT invent a new responsible person/i);
    expect(lines).toMatch(/leave it that way/i);
  });

  it("a detail-bearing audience puts the Host's own words in the prompt", () => {
    const a = audienceAuthorityFor({ ...PILOT, audienceType: "job_group", audienceDetail: "Marketing team" } as unknown as BuilderAnswers);
    expect(audiencePromptLines(a).join("\n")).toContain("Marketing team");
  });

  it("every policy's own example is authorized by its own audience", () => {
    for (const p of AUDIENCE_POLICY) {
      const detail = p.id === "job_group" || p.id === "specific_role" ? "the named group" : undefined;
      const a = audienceAuthorityFor({ ...PILOT, audienceType: p.id, audienceDetail: detail } as unknown as BuilderAnswers);
      expect(actorAuthorized(p.example, a, CORPUS).ok, `${p.id}: ${p.example}`).toBe(true);
    }
  });
});
