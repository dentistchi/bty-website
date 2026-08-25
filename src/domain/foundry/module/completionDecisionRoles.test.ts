import { describe, it, expect } from "vitest";
import { renderCompletionQuestion, renderDecisionSentence, renderStandardSentence, type BehaviorContract } from "./program-coherence";
import { contractsFromProposal, deriveInstructionalContent, requiredProgramKinds, resolveCompletionCheck } from "./program-authorship";
import { journeyCopy } from "./journeyLocaleCopy";
import type { BuilderAnswers } from "./module-builder";
import type { JourneyElementKind } from "./journey";

/**
 * SLICE R4-R5C16B — TWO ANSWER BOXES, TWO JOBS.
 *
 * FOUNDER-OBSERVED on a real learner, mid-training, in the Korean room:
 *
 *   YOUR DECISION       다음에 이런 상황이 생기면 무엇을 다르게 해보겠습니까?
 *   BEFORE YOU FINISH   다음에 팀원에게 어떤 기준을 요구하게 될 때, 당신이 먼저 행동으로
 *                       보여줄 한 가지는 무엇입니까?
 *
 * Two free-text boxes, four lines apart, asking for the same commitment — and the two fields are
 * validated independently, so one sentence pasted twice satisfies the product truthfully. That is
 * R4-R5C12A's defect arriving from the other side: not copying the answer off the screen, but
 * writing the same answer twice.
 *
 * MEASURED BEFORE CHANGING ANYTHING: `decision_response_text` is the canonical Reality commitment
 * and the sole trigger for the Apply window; `response_text` is required for completion but has no
 * downstream consumer of its TEXT — only of its existence. So neither field moves. The QUESTION
 * moves.
 */

const CONTRACT: BehaviorContract = {
  actor: "you",
  trigger: "Whenever you ask the team for a standard",
  observableAction: "check that you already do what you ask for",
  completion: { criterion: "A team member can name a recent time you did it first." },
};
const COMPLETION = { verificationTarget: "the_behaviour", responseMode: "name_the_moment" } as never;
const APP = { applicationMoment: CONTRACT.trigger };

const ANSWERS = {
  problem: "Leaders ask for a standard they do not hold themselves.",
  audienceType: "leaders",
  recurringMoment: CONTRACT.trigger,
  observableBehavior: "Check that you are already doing what you are about to ask for.",
  successEvidence: "A team member can name a recent time you did it first.",
  followUpDays: 7,
  materialIntent: "written",
} as unknown as BuilderAnswers;

const withDecision = { ...ANSWERS, learningNeeds: ["decide"] } as unknown as BuilderAnswers;
const withoutDecision = { ...ANSWERS, learningNeeds: ["shared_standard"] } as unknown as BuilderAnswers;

const contractsFor = (hasDecision: boolean, completionPrompt: string | null = null, loc: "en" | "ko" = "ko") =>
  contractsFromProposal(
    {
      displayTitle: "t",
      elements: [
        { kind: "observable_standard" as JourneyElementKind, content: "x", rationale: "" },
        ...(hasDecision ? [{ kind: "action_decision" as JourneyElementKind, content: "x", rationale: "" }] : []),
      ],
      behaviorContract: CONTRACT,
      scenarioContract: null,
      applicationContract: APP,
      completionContract: COMPLETION,
      followUpContract: null,
      operationalConstruct: null,
    } as never,
    7, ANSWERS.problem as string, completionPrompt, ANSWERS as never, [], loc,
  )!;

// ---------------------------------------------------------------------------
// T1-T4 · the two questions stop being the same question
// ---------------------------------------------------------------------------

describe("[R4-R5C16B · T1-T4] BEFORE YOU FINISH asks what is hard, not what you will do", () => {
  it("T1 with a decision section, it asks about the barrier — in both languages", () => {
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "ko", true))
      .toBe("실제 업무에서 이것을 행동으로 옮기기 어렵게 만드는 것은 무엇일까요?");
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "en", true))
      .toBe("What might make this difficult to do in real work?");
  });

  it("T2 YOUR DECISION still asks for the learner's own commitment", () => {
    /*
      RETARGETED BY R4-R5C17A, not weakened. The property this test owns — YOUR DECISION asks the
      learner for a commitment rather than supplying one — is unchanged and still asserted exactly.
      The sentence moved because a real learner proved the old one was answerable by copying THE
      STANDARD; it now asks for their own next opportunity as well. See
      `decisionOpportunityAnchor.test.ts` for the copy-resistance property itself.
    */
    expect(renderDecisionSentence(CONTRACT, APP, "ko")).toBe("이것을 가장 먼저 해볼 상황은 언제인가요? 그때 무엇을 하겠어요?");
    expect(renderDecisionSentence(CONTRACT, APP, "en")).toBe("When is the next time this will come up for you, and what will you do then?");
  });

  it("T3 the two are not the same mental operation", () => {
    for (const loc of ["en", "ko"] as const) {
      const before = renderCompletionQuestion(CONTRACT, COMPLETION, loc, true)!;
      const decision = renderDecisionSentence(CONTRACT, APP, loc);
      expect(before).not.toBe(decision);
      // One asks what will happen to you; the other asks what you will do.
      expect(decision, loc).toMatch(loc === "ko" ? /무엇을\s*하겠/ : /what will you do/i);
      expect(before, loc).toMatch(loc === "ko" ? /어렵게 만드는 것/ : /make this difficult/);
      expect(before, loc).not.toMatch(loc === "ko" ? /하시겠습니까|해보겠습니까/ : /what will you do/i);
    }
  });

  it("T4 one sentence cannot be the obvious honest answer to both", () => {
    /*
      A commitment ("I will check my own behaviour first") answers YOUR DECISION and does not
      answer "what makes this hard". A barrier ("I forget when the meeting runs late") answers
      BEFORE YOU FINISH and is not a decision. The questions no longer accept each other's answer.
    */
    const before = renderCompletionQuestion(CONTRACT, COMPLETION, "en", true)!;
    const decision = renderDecisionSentence(CONTRACT, APP, "en");
    /*
      Written to catch the SHIPPED defect, not a paraphrase of it: the pre-C16B question was
      "The next time this happens, what exactly will you do?" / "…정확히 무엇을 하시겠습니까?",
      so the predicate has to recognise those too or the differential proves nothing.
    */
    const asksForACommitment = (q: string) =>
      /what (exactly )?will you do|무엇을\s*(하|다르게)|하시겠습니까|해보겠습니까/i.test(q);
    expect(asksForACommitment(decision)).toBe(true);
    expect(asksForACommitment(before)).toBe(false);
    // …and neither is answerable by repeating THE STANDARD.
    const standard = renderStandardSentence(CONTRACT);
    expect(before).not.toContain(standard.slice(0, 20));
  });

  it("the three sections are three different jobs", () => {
    const standard = "Check that you are already doing what you are about to ask for.";
    const before = renderCompletionQuestion(CONTRACT, COMPLETION, "en", true)!;
    const decision = renderDecisionSentence(CONTRACT, APP, "en");
    expect(new Set([standard, before, decision]).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// T5/T6 · what must NOT change
// ---------------------------------------------------------------------------

describe("[R4-R5C16B · T5-T6] Host authority and the no-decision case are untouched", () => {
  it("T5 a Host's own completion question still wins", () => {
    const hostQuestion = "체크리스트를 어떻게 쓰실 계획입니까?";
    const c = contractsFor(true, hostQuestion);
    expect(deriveInstructionalContent("completion_check", c)).toBe(hostQuestion);
    // …and the resolver is what decides that, before BTY renders anything.
    expect(resolveCompletionCheck(hostQuestion, renderCompletionQuestion(CONTRACT, COMPLETION, "ko", true))).toBe(hostQuestion);
  });

  it("T6 with no decision section, the completion question is unchanged", () => {
    expect(requiredProgramKinds(withoutDecision)).not.toContain("action_decision");
    const c = contractsFor(false);
    expect(deriveInstructionalContent("completion_check", c)).toBe("다음에 이런 상황이 생기면 정확히 무엇을 하시겠습니까?");
    // Byte-identical to what it rendered before this slice.
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "ko")).toBe("다음에 이런 상황이 생기면 정확히 무엇을 하시겠습니까?");
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "en")).toBe("The next time this happens, what exactly will you do?");
  });

  it("the condition is the program's shape, not a flag someone remembers to pass", () => {
    expect(requiredProgramKinds(withDecision)).toContain("action_decision");
    expect(contractsFor(true).hasActionDecision).toBe(true);
    expect(contractsFor(false).hasActionDecision).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T10/T11 · both languages, and the copy tables stay in step
// ---------------------------------------------------------------------------

describe("[R4-R5C16B · T10-T11] the barrier question exists in both languages", () => {
  it("T10/T11 KO is Korean, EN is English, and neither leaks the other", () => {
    expect(journeyCopy("ko").completionBarrier).toMatch(/[가-힣]/);
    expect(journeyCopy("ko").completionBarrier).not.toMatch(/[A-Za-z]{3,}/);
    expect(journeyCopy("en").completionBarrier).not.toMatch(/[가-힣]/);
    expect(journeyCopy(undefined).completionBarrier).toBe(journeyCopy("en").completionBarrier);
  });

  it("it is answerable from the learner's own work, not from the material", () => {
    for (const loc of ["en", "ko"] as const) {
      const q = journeyCopy(loc).completionBarrier;
      expect(q).toMatch(/\?$/);
      // Names no behaviour, no criterion and no moment — nothing to copy.
      expect(q).not.toContain(CONTRACT.observableAction);
      expect(q).not.toContain(CONTRACT.trigger);
      expect(q).not.toContain(CONTRACT.completion.criterion);
    }
  });
});
