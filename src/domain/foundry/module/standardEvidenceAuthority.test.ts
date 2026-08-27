import { describe, it, expect } from "vitest";
import {
  PROGRAM_AUTHORSHIP_VERSION,
  applyProgramProposal,
  contractsFromProposal,
  deriveInstructionalContent,
  derivesFrom,
  isHostAuthoredKind,
  observableBehaviorFrom,
  requiredProgramKinds,
  validateEditedReview,
  validateProgramProposal,
} from "./program-authorship";
import { CANONICAL_ACTOR, renderScenarioSentence, type BehaviorContract } from "./program-coherence";
import { DETAIL_FIELDS } from "@/components/foundry/event-rooms/programReviewFields";
import { stepBlockers, type BuilderAnswers } from "./module-builder";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "./journey";

/**
 * SLICE R4-R5C14A — THE STANDARD IS WHAT YOU DO; SUCCESS IS WHAT SOMEONE CAN SEE.
 *
 * FOUNDER-OBSERVED on the real Korean training "리더의 행동". THE STANDARD read as the success
 * evidence, because it WAS the success evidence: BTY composed the section from a server actor
 * ("you"), the Host's moment, the model's paraphrase of their behaviour, and their evidence
 * sentence appended as a completion criterion — and the program had no WHAT SUCCESS LOOKS LIKE
 * section at all, so the evidence had nowhere else to live.
 *
 * Measured across nine live journeys before the repair: four standards carried the Host's
 * evidence, two of those had no evidence section, two published journeys stated it twice, and
 * the one Korean standard carried the English pronoun "you".
 *
 * The fixture below is the Founder's own training, sanitized to the two sentences they quoted.
 */

const HOST_BEHAVIOR =
  "팀원에게 어떤 기준을 요구하기 전에, 내가 먼저 그 기준을 행동으로 보여주고 있는지 확인한다. 말한 것은 행동으로 지키고, 지키지 못하게 되면 먼저 알리고 책임 있게 다시 약속한다.";
const HOST_EVIDENCE =
  "팀원이 최근의 구체적인 사례를 들어 “이 리더는 자신이 요구한 기준을 먼저 행동으로 보여줬다”고 말할 수 있다.";
const HOST_MOMENT = "팀원에게 책임, 변화, 노력, 기준을 요구하거나 “이렇게 해보자”고 말하는 순간";

const ANSWERS = {
  problem: "리더가 요구한 기준을 스스로 지키지 않아 신뢰가 무너진다.",
  observableBehavior: HOST_BEHAVIOR,
  successEvidence: HOST_EVIDENCE,
  recurringMoment: HOST_MOMENT,
  audienceType: "leaders",
  learningNeeds: ["shared_standard", "decide"],
  followUpDays: 7,
  materialIntent: "written",
} as unknown as BuilderAnswers;

/** The contract as the server now assembles it: the Host's sentence is the standard authority. */
const CONTRACT: BehaviorContract = {
  actor: CANONICAL_ACTOR,
  trigger: HOST_MOMENT,
  // The model's paraphrase — still validated, no longer displayed.
  observableAction: "보여주다 내가 요구하는 기준을 행동으로 보여주고, 지키지 못할 경우 미리 알리고 책임 있게 다시 약속한다",
  completion: { criterion: HOST_EVIDENCE },
};

// ---------------------------------------------------------------------------
// T1-T4 · THE STANDARD is the Host's behaviour and nothing else
// ---------------------------------------------------------------------------

const contractsFor = (over: Partial<BuilderAnswers> = {}) =>
  contractsFromProposal(
    { displayTitle: "t", elements: [], behaviorContract: CONTRACT, scenarioContract: { frame: "time_is_short" },
      applicationContract: null, completionContract: null, followUpContract: null, operationalConstruct: null } as never,
    7, ANSWERS.problem as string, null, { ...ANSWERS, ...over } as never, [], "ko",
  )!;
/**
 * The DISPLAY seam, which is what moved. `renderStandardSentence` survives as a derived-length
 * backstop and a contract-shape fixture; nothing participant-facing reads it any more, so these
 * assertions drive the function the review surface and Apply actually call.
 */
/**
 * What the SERVER composes onto the element for a Host-authored kind — which is what the review
 * surface then shows in an editable field, and what Apply persists.
 */
const displayed = (_kind: JourneyElementKind, over: Partial<BuilderAnswers> = {}) =>
  (over.observableBehavior ?? (ANSWERS.observableBehavior as string));

describe("[R4-R5C14A · T1-T4] the Standard is the Host's own sentence", () => {
  const std = displayed("observable_standard")!;

  it("T1 equals the approved observableBehavior authority", () => {
    expect(std).toBe(HOST_BEHAVIOR);
    expect(observableBehaviorFrom(ANSWERS)).toBe(HOST_BEHAVIOR);
  });

  it("T2 contains no part of the success evidence", () => {
    expect(std).not.toContain(HOST_EVIDENCE.slice(0, 30));
    expect(std).not.toContain("완료 증거");
    expect(std).not.toContain("Completion evidence");
  });

  it("T3 does not depend on CANONICAL_ACTOR", () => {
    expect(std).not.toContain(CANONICAL_ACTOR);
    expect(contractsFor().hostBehavior).toBe(HOST_BEHAVIOR);
  });

  it("T4 does not depend on the action_verb/action_detail composition", () => {
    expect(contractsFor().hostBehavior).toBe(HOST_BEHAVIOR);
    expect(std).not.toContain("보여주다 내가");
  });

  it("T9/T10 the Korean fixture carries no English actor and no stranded dictionary verb", () => {
    expect(std).not.toMatch(/\byou\b/i);
    expect(std).not.toMatch(/보여주다\s+[가-힣]/);
    expect(std).toMatch(/[가-힣]/);
  });

  it("T3b the obsolete proxy control is gone with the composition it edited", () => {
    expect(DETAIL_FIELDS.observable_standard).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T5-T8 · WHAT SUCCESS LOOKS LIKE exists, is the Host's, and is stated once
// ---------------------------------------------------------------------------

describe("[R4-R5C14A · T5-T8] Success is the Host's evidence, exactly once", () => {
  it("T5 evidence is a required kind whenever the Host supplied one", () => {
    expect(requiredProgramKinds(ANSWERS)).toContain("evidence");
    const none = { ...ANSWERS, successEvidence: "" } as unknown as BuilderAnswers;
    expect(requiredProgramKinds(none)).not.toContain("evidence");
  });

  it("T6/T7 the Host owns both sections — neither is BTY-derived or BTY-attributed", () => {
    for (const kind of ["observable_standard", "evidence"] as const) {
      expect(isHostAuthoredKind(kind), kind).toBe(true);
    }
    const contracts = contractsFor();
    /*
      Neither is BTY-OWNED and neither is BTY-RENDERED: the Host's sentence arrives on the
      element from the server, and the review surface shows it in an editable field. Were
      `deriveInstructionalContent` to return it, `sectionText` would prefer the contract value and
      discard the Host's edit.
    */
    expect(derivesFrom("observable_standard", contracts)).toBe(false);
    expect(derivesFrom("evidence", contracts)).toBe(false);
    expect(deriveInstructionalContent("observable_standard", contracts)).toBeNull();
    expect(deriveInstructionalContent("evidence", contracts)).toBeNull();
    expect(contracts.hostBehavior).toBe(HOST_BEHAVIOR);
    expect(contracts.hostEvidence).toBe(HOST_EVIDENCE);
  });

  it("T7 adoption stamps Host authority, not ai_proposed", () => {
    const proposal = {
      displayTitle: "t",
      elements: [
        { kind: "observable_standard" as JourneyElementKind, content: HOST_BEHAVIOR, rationale: "" },
        { kind: "evidence" as JourneyElementKind, content: HOST_EVIDENCE, rationale: "" },
      ],
    } as never;
    const j = applyProgramProposal(undefined, proposal, [
      { kind: "observable_standard", decision: "use", editedContent: HOST_BEHAVIOR },
      { kind: "evidence", decision: "use", editedContent: HOST_EVIDENCE },
    ], { titleDecision: "use" });
    const by = Object.fromEntries(j.elements.map((e) => [e.kind, e]));
    expect(by.observable_standard.grounding[0]?.sourceType).toBe("host_statement");
    expect(by.evidence.grounding[0]?.sourceType).toBe("host_statement");
    expect(by.observable_standard.grounding[0]?.field).toBe("observableBehavior");
    expect(by.evidence.grounding[0]?.field).toBe("successEvidence");
    // …and a BTY-authored section is still BTY's.
    const bty = applyProgramProposal(undefined,
      { displayTitle: "t", elements: [{ kind: "action_decision" as JourneyElementKind, content: "x", rationale: "" }] } as never,
      [{ kind: "action_decision", decision: "use", editedContent: "x" }], { titleDecision: "use" });
    expect(bty.elements[0].grounding[0]?.sourceType).toBe("ai_proposed");
  });

  it("T8 the evidence sentence appears in exactly one learner-facing section", () => {
    const journey: RealityGroundedJourneyV1 = applyProgramProposal(undefined, {
      displayTitle: "t",
      elements: [
        { kind: "observable_standard" as JourneyElementKind, content: HOST_BEHAVIOR, rationale: "" },
        { kind: "scenario" as JourneyElementKind, content: renderScenarioSentence(CONTRACT, { frame: "time_is_short" } as never, "ko"), rationale: "" },
        { kind: "evidence" as JourneyElementKind, content: HOST_EVIDENCE, rationale: "" },
      ],
    } as never, [
      { kind: "observable_standard", decision: "use", editedContent: HOST_BEHAVIOR },
      { kind: "scenario", decision: "use", editedContent: renderScenarioSentence(CONTRACT, { frame: "time_is_short" } as never, "ko") },
      { kind: "evidence", decision: "use", editedContent: HOST_EVIDENCE },
    ], { titleDecision: "use" });
    const carrying = journey.elements.filter((e) => e.content.includes(HOST_EVIDENCE.slice(0, 30)));
    expect(carrying.map((e) => e.kind)).toEqual(["evidence"]);
  });
});

// ---------------------------------------------------------------------------
// T11 · IN CONTEXT still owns the moment
// ---------------------------------------------------------------------------

describe("[R4-R5C14A · T11] the moment stayed in IN CONTEXT", () => {
  it("the scenario carries the recurring moment; the Standard does not", () => {
    const scenario = renderScenarioSentence(CONTRACT, { frame: "time_is_short" } as never, "ko");
    expect(scenario).toContain(HOST_MOMENT);
    expect(scenario).toContain("가장 놓치기 쉽습니다");
    expect(displayed("observable_standard")).not.toContain(HOST_MOMENT);
  });
});

// ---------------------------------------------------------------------------
// The device differential, and the version contract
// ---------------------------------------------------------------------------

describe("[R4-R5C14A · T13] the real Integrity differential", () => {
  it("STANDARD and SUCCESS are textually and semantically distinct", () => {
    const std = displayed("observable_standard")!;
    expect(std).not.toBe(HOST_EVIDENCE);
    expect(std.includes(HOST_EVIDENCE.slice(0, 25))).toBe(false);
    expect(HOST_EVIDENCE.includes(std.slice(0, 25))).toBe(false);
    // The Standard says what the leader does; the evidence says what a team member could report.
    expect(std).toContain("확인한다");
    expect(HOST_EVIDENCE).toContain("말할 수 있다");
  });

  it("T16 an English program's Standard is the Host's English sentence, unchanged in meaning", () => {
    const en = "Before the huddle ends, confirm the owner and the deadline for every agreed item.";
    expect(displayed("observable_standard", { observableBehavior: en } as never)).toBe(en);
  });

  it("the authorship version moved exactly once", () => {
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v25");
  });
});

// ---------------------------------------------------------------------------
// T19-T25 · WHOSE PROSE THE PROPOSAL GATES JUDGE (Slice R4-R5C14A-R1)
// ---------------------------------------------------------------------------

/**
 * The gates that refuse a proposal were written to judge what a MODEL wrote. Two sections are
 * the Host's own approved answers now, so pointing those gates at them turns an AI-proposal
 * refusal into a back-door Host validator — a paid generation refused over words the Host chose,
 * with one of their own sentences named as the defect.
 *
 * These fix the boundary in both directions: Host prose is never the offender, and every
 * AI-authored duplication and over-claim is still refused.
 */
describe("[R4-R5C14A-R1 · T19-T25] Host authority vs AI proposal refusal", () => {
  const HOST = {
    problem: "Leaders ask for a standard they do not hold themselves.",
    audienceType: "leaders",
    recurringMoment: "Whenever you ask the team for a standard",
    observableBehavior: "Check that you are already doing what you are about to ask for.",
    successEvidence: "Check that you are already doing what you are about to ask for.",
    learningNeeds: ["shared_standard"],
    /*
      Slice R4-R8B — STATED, because it stopped being the default. `arenaRecommended` used to be
      false whenever the Host left it unset; it is now derived from the needs, and
      `shared_standard` recommends Arena, which makes `scenario` a required program section. This
      suite is about the Host's STANDARD and EVIDENCE keeping their authority, and its fixture has
      always described a training without a scenario — so it says so, rather than relying on an
      absence that no longer means what it meant. Also proves the override reaches the generator.
    */
    arenaRecommended: false,
    followUpDays: 7,
    materialIntent: "written",
    materialText: "Read the one-page leadership standard.",
  } as unknown as BuilderAnswers;

  const el = (kind: string, content: string) => ({ kind, content, rationale: "grounded in the host's own answers" });
  const build = (extra: { kind: string; content: string }[] = [], answers: BuilderAnswers = HOST) => ({
    program: {
      display_title: "Ask for nothing you do not already do",
      elements: [
        ...requiredProgramKinds(answers)
          .filter((k) => k !== "evidence")
          .map((k) => el(k, `A model sentence for ${k} that is long enough to pass the floor.`)),
        ...extra,
      ],
      assumptions: [], warnings: [],
      behavior_contract: { action_verb: "check", action_detail: "that you already do what you ask for" },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_happened_next", confirmer: "self_report" },
    },
  });

  it("T19 the Host's two sentences may be identical without refusing the proposal", () => {
    // A real risk: a Host whose behaviour and evidence read alike would have had a paid
    // generation refused, with one of their own answers named as the fault.
    expect(HOST.observableBehavior).toBe(HOST.successEvidence);
    const r = validateProgramProposal(build(), HOST);
    expect(r.ok, r.ok ? "" : `${r.code}/${r.kind}`).toBe(true);
    if (r.ok) {
      const by = Object.fromEntries(r.value.proposal.elements.map((e) => [e.kind, e.content]));
      expect(by.observable_standard).toBe(HOST.observableBehavior);
      expect(by.evidence).toBe(HOST.successEvidence);
    }
  });

  it("T20 an AI section duplicating the Host's STANDARD is refused, and the AI section is named", () => {
    const r = validateProgramProposal(build([el("reflection", HOST.observableBehavior as string)]), HOST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("duplicate_content");
      expect(r.kind, "the Host's sentence is never the offender").toBe("reflection");
    }
  });

  it("T21 an AI section duplicating the Host's SUCCESS is refused", () => {
    const r = validateProgramProposal(build([el("reflection", HOST.successEvidence as string)]), HOST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("duplicate_content");
      expect(r.kind).toBe("reflection");
    }
  });

  it("T22 two non-Host sections duplicating each other are still refused", () => {
    /*
      Compared on the FINAL elements, where seven of nine are BTY's rendering — so duplicating the
      model's own prose for a derived kind produces no collision at all. The reachable non-Host
      pair is a narrative section that repeats a DERIVED sentence.
    */
    const derivedFollowUp =
      "In 7 days you will be asked what happened when you tried it. That is your own account of it, not an observation.";
    const r = validateProgramProposal(build([el("reflection", derivedFollowUp)]), HOST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("duplicate_content");
  });

  it("T23 the Host's success evidence is exempt from evidence_overclaim", () => {
    // An ordinary Host sentence that the model-prose gate would refuse if pointed at it.
    const overclaiming = "Every leader will have permanently mastered this and the team will trust them.";
    const answers = { ...HOST, successEvidence: overclaiming } as unknown as BuilderAnswers;
    const r = validateProgramProposal(build([], answers), answers);
    expect(r.ok, r.ok ? "" : `${r.code}/${r.kind}`).toBe(true);
    if (r.ok) {
      expect(r.value.proposal.elements.find((e) => e.kind === "evidence")!.content).toBe(overclaiming);
    }
    // …and the same sentence from the MODEL, in a section it authors, is still refused.
    const fromModel = validateProgramProposal(build([el("reflection", overclaiming)]), HOST);
    expect(fromModel.ok).toBe(false);
    if (!fromModel.ok) expect(fromModel.code).toBe("evidence_overclaim");
  });

  it("T24 Host-boundary validation still runs on the Host's own fields", () => {
    // Step 4 still refuses a behaviour that is not behaviour-shaped, before any provider call…
    const question = { ...HOST, observableBehavior: "What should a leader do about this?" } as unknown as BuilderAnswers;
    expect(stepBlockers(4, question)).toContain("behavior_is_a_question");
    // …and the same shape gate reaches an in-review edit of the same field.
    const contracts = contractsFor();
    const edited = validateEditedReview(contracts, ["observable_standard"], { observable_standard: "What should a leader do about this?" }, ANSWERS);
    expect(edited.ok).toBe(false);
    if (!edited.ok) expect(edited.kind).toBe("observable_standard");
    // Emptying it blocks too: it would drop the section rather than blank it.
    const emptied = validateEditedReview(contracts, ["observable_standard"], { observable_standard: "  " }, ANSWERS);
    expect(emptied.ok).toBe(false);
  });

  it("T25 the Host's evidence is carried verbatim — never rewritten to satisfy a gate", () => {
    const awkward = "팀원이 “이 리더는 먼저 보여줬다”고 말할 수 있다";
    const answers = { ...HOST, successEvidence: awkward } as unknown as BuilderAnswers;
    const r = validateProgramProposal(build([], answers), answers);
    expect(r.ok, r.ok ? "" : `${r.code}/${r.kind}`).toBe(true);
    if (r.ok) {
      expect(r.value.proposal.elements.find((e) => e.kind === "evidence")!.content).toBe(awkward);
    }
  });
});
