import { describe, it, expect } from "vitest";
import { AUDIENCE_POLICY, audienceAuthorityFor, confirmerAuthorized, audiencePromptLines } from "./audience-authority";
import { AUDIENCE_TYPES, type BuilderAnswers } from "./module-builder";
import {
  validateProgramProposal, requiredProgramKinds, groundingCorpus, isSemanticRepairableCode,
} from "./program-authorship";
import { CONTRACT_DEFECT_REASONS, CANONICAL_ACTOR, isInterrogativeAction } from "./program-coherence";

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

const ACTION = "names one owner and one deadline for every agreed action and writes them in the huddle note";
const GROUNDED = {
  actor: "the huddle leader",
  trigger: "at each morning huddle, before the group leaves",
  observable_action: ACTION,
  completion: { confirmed_by: "the named owner", confirmation_action: "repeat back the action and the deadline" },
};
/** The exact W3 shape. */
const DRIFTED = {
  ...GROUNDED,
  actor: "a team member",
  observable_action: "confirm the owner of each action and state the deadline",
  completion: { confirmed_by: "the team lead", confirmation_action: "record the owner and deadline in the huddle notes" },
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
    const out = rendered({ ...DRIFTED, completion: GROUNDED.completion });
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
    expect(a.observable_standard).toMatch(/^At each morning huddle, before the group leaves, you must /);
  });

  it("F — a non-learner mentioned in the problem cannot become the subject", () => {
    expect(CORPUS).toContain("team members");
    expect(rendered({ ...DRIFTED, completion: GROUNDED.completion }).observable_standard.toLowerCase())
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

describe("[R3.2-R1] G/H/I — the confirmer has its own authority", () => {
  it("G — the W3 confirmer is refused: an audience does not appoint a record keeper", () => {
    expect(confirmerAuthorized("the team lead", DRIFTED.observable_action, AUTH, CORPUS))
      .toEqual({ ok: false, reason: "ungrounded_role" });
    expect(verdict(DRIFTED)).toBe("non_observable_standard [completionSignal/confirmer_unauthorized]");
  });

  it("and neither does a leading title of any other kind", () => {
    for (const invented of ["the manager on duty", "a supervisor", "the compliance officer"]) {
      expect(confirmerAuthorized(invented, ACTION, AUTH, CORPUS).ok, invented).toBe(false);
      expect(
        verdict({ ...GROUNDED, completion: { confirmed_by: invented, confirmation_action: "repeat back the action and the deadline" } }),
        invented,
      ).toBe("non_observable_standard [completionSignal/confirmer_unauthorized]");
    }
  });

  it("H — someone the Host's OWN words name is accepted", () => {
    expect(confirmerAuthorized("the named owner", ACTION, AUTH, CORPUS).ok).toBe(true);
    expect(verdict(GROUNDED)).toBe("PASS");
  });

  it("H — the Host's own agentless artifact stays an artifact, and acquires no keeper", () => {
    expect(verdict({ ...GROUNDED, completion: { confirmed_by: "the huddle note", confirmation_action: "record the owner and the deadline" } }))
      .toBe("PASS");
  });

  it("B — a host's VERB can no longer staff an organisation (R3.2-R2)", () => {
    /*
      "the records manager" was accepted while the rule compared every token: `records` shares a
      stem with the host's own sentence — "The huddle note RECORDS one owner and one deadline" —
      where it is a VERB. The role being named is `manager`, and nothing establishes one. The rule
      now decides on the phrase's HEAD, so a modifier can no longer smuggle in an office.
    */
    expect(confirmerAuthorized("the records manager", ACTION, AUTH, CORPUS)).toEqual({ ok: false, reason: "ungrounded_role" });
    expect(confirmerAuthorized("the records supervisor", ACTION, AUTH, CORPUS).ok).toBe(false);
    expect(verdict({ ...GROUNDED, completion: { confirmed_by: "the records manager", confirmation_action: "record the owner and the deadline" } }))
      .toBe("non_observable_standard [completionSignal/confirmer_unauthorized]");
  });

  it("I — 'the person taking over' is legitimate because the ACTION names them", () => {
    /*
      MEASURED on this repository's canonical fixture rather than judged by taste. Its trained
      action is "states each open item aloud TO THE PERSON TAKING OVER" — the confirmer is the
      direct object of the behaviour. Classification B: a relational counterpart entailed by the
      act. That is the general rule, and it needs no list of job titles.
    */
    const handover = "states each open item aloud to the person taking over";
    expect(confirmerAuthorized("the person taking over", handover, null, "").ok).toBe(true);
    /*
      And also where the action names the SAME counterpart in different words — "identifies its
      next owner". A counterpart entailed by an act cannot be recognised by word overlap alone,
      which is why the rule tests the RELATION ("taking over", "next", "receiving") rather than a
      list of job titles.
    */
    expect(confirmerAuthorized("the person taking over", "states each unfinished item and identifies its next owner", null, "").ok).toBe(true);
    // An OFFICE, by contrast, is refused however the action is worded.
    expect(confirmerAuthorized("the compliance officer", handover, AUTH, CORPUS).ok).toBe(false);
  });
});

describe("[R3.2-R2] F/G/H/I — role identity, in English and Korean", () => {
  it("F — an invented office sharing only a stem with source prose is refused", () => {
    for (const invented of ["the records manager", "the recording officer", "the deadline supervisor", "the action lead", "the owner's manager"]) {
      expect(confirmerAuthorized(invented, ACTION, AUTH, CORPUS).ok, invented).toBe(false);
    }
  });

  it("G — a human role the Host actually names is accepted", () => {
    const answers = { ...PILOT, successEvidence: "The duty pharmacist signs the huddle note for every agreed action." } as unknown as BuilderAnswers;
    const corpus = groundingCorpus(answers, []);
    expect(confirmerAuthorized("the duty pharmacist", ACTION, audienceAuthorityFor(answers), corpus).ok).toBe(true);
    // …and an office the host did NOT name is still refused against the same source.
    expect(confirmerAuthorized("the pharmacy manager", ACTION, audienceAuthorityFor(answers), corpus).ok).toBe(false);
  });

  it("H — a Korean role the Host names is accepted", () => {
    const answers = {
      ...PILOT,
      problem: "아침 허들에서 문제를 보고하지만 담당자를 정하지 않고 끝납니다.",
      successEvidence: "허들 기록에 담당자와 마감일이 남습니다.",
    } as unknown as BuilderAnswers;
    const corpus = groundingCorpus(answers, []);
    expect(confirmerAuthorized("담당자", ACTION, audienceAuthorityFor(answers), corpus).ok).toBe(true);
  });

  it("I — a Korean office invented from incidental overlap is refused", () => {
    const answers = {
      ...PILOT,
      problem: "아침 허들에서 문제를 보고하지만 담당자를 정하지 않고 끝납니다.",
      successEvidence: "허들 기록에 담당자와 마감일이 남습니다.",
    } as unknown as BuilderAnswers;
    const corpus = groundingCorpus(answers, []);
    // Korean is head-final too: "기록 관리자" names 관리자, which the source never establishes.
    expect(confirmerAuthorized("기록 관리자", ACTION, audienceAuthorityFor(answers), corpus)).toEqual({ ok: false, reason: "ungrounded_role" });
  });
});

describe("[R3.2-R1] J–P — everything else is unchanged", () => {
  it("J — the W3-shaped seven-kind proposal is refused", () => {
    expect(run(DRIFTED).ok).toBe(false);
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
    expect(verdict({ ...GROUNDED, observable_action: PILOT.observableBehavior as string }))
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

  it("the closed vocabulary gained exactly one reason, and `actor_unauthorized` is not in it", () => {
    for (const r of ["missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation", "interrogative_action"]) {
      expect(CONTRACT_DEFECT_REASONS, r).toContain(r);
    }
    expect(CONTRACT_DEFECT_REASONS).toContain("confirmer_unauthorized");
    expect(CONTRACT_DEFECT_REASONS as readonly string[]).not.toContain("actor_unauthorized");
    expect(CONTRACT_DEFECT_REASONS).toHaveLength(8);
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
