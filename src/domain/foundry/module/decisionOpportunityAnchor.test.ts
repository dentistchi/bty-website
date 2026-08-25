import { describe, it, expect } from "vitest";
import { renderCompletionQuestion, renderDecisionSentence, type BehaviorContract } from "./program-coherence";
import { contractsFromProposal, deriveInstructionalContent, requiredProgramKinds, resolveCompletionCheck } from "./program-authorship";
import { journeyCopy } from "./journeyLocaleCopy";
import type { BuilderAnswers } from "./module-builder";
import type { JourneyElementKind } from "./journey";

/**
 * SLICE R4-R5C17A — YOUR DECISION ASKS FOR THE LEARNER'S OWN NEXT OPPORTUNITY.
 *
 * REAL LEARNER, REAL TRAINING, REAL ANSWER. A learner completed "리더십 신뢰 구축을 위한 행동 변화"
 * naturally and was asked V11 — "위에 나온 내용을 그대로 베끼거나 조금만 바꿔서 답할 수 있었나요?" — and
 * said YES. That is the only gate in R4-R5C a human has failed.
 *
 * WHERE IT LEAKED. Measured on the frozen snapshot, not inferred:
 *
 *   THE STANDARD    팀원에게 어떤 기준을 요구하기 전에, 내가 먼저 그 기준을 행동으로 보여주고
 *                   있는지 확인한다. …
 *   YOUR DECISION   다음에 이런 상황이 생기면 무엇을 다르게 해보겠습니까?   ← immediately below it
 *
 * R4-R5C11 already removed the ANSWER from this section — it used to render the standard back in
 * the first person. What it did not remove is the answer's availability: the standard is still
 * printed one section up, it prescribes exactly what to do differently, and the learner-side
 * validation is `response.trim().length < 1`. So one sentence, copied, is a complete and truthful
 * answer.
 *
 * WHAT CHANGES. The question now asks for something the training cannot print: the learner's own
 * next real opportunity. THE STANDARD may still supply the action — that is correct, it is the
 * program's job — but it can no longer constitute the whole answer.
 *
 * THE PROXY THESE TESTS USE, stated plainly because it is a proxy. "Cannot be answered by copying"
 * is not mechanically decidable. What IS decidable is whether the question demands an occasion and
 * whether any sentence above names one, so that is what is asserted: the question carries an
 * occasion demand, and no Host or BTY sentence in the journey carries an occasion. A learner who
 * pastes THE STANDARD leaves half the question unanswered.
 *
 * NOT IN SCOPE, deliberately (dispatch §9/§10): the advisory's blindness to derived questions, the
 * Korean weakness in `overlapRatio`, and the `host_statement` stamp on a BTY-composed
 * completion_check. All three are measured and recorded as debt; none is repaired here.
 */

// The Host's own two sentences from the completed training, verbatim.
const HOST_STANDARD =
  "팀원에게 어떤 기준을 요구하기 전에, 내가 먼저 그 기준을 행동으로 보여주고 있는지 확인한다. " +
  "말한 것은 행동으로 지키고, 지키지 못하게 되면 먼저 알리고 책임 있게 다시 약속한다.";
const HOST_EVIDENCE =
  "팀원이 최근의 구체적인 사례를 들어 “이 리더는 자신이 요구한 기준을 먼저 행동으로 보여줬다”고 말할 수 있다.";

const CONTRACT: BehaviorContract = {
  actor: "you",
  trigger: "Whenever you are about to ask the team for a standard",
  observableAction: "check that you already do what you are asking for",
  completion: { criterion: "A team member can name a recent time you did it first." },
};
const COMPLETION = { verificationTarget: "the_behaviour", responseMode: "name_the_moment" } as never;
const APP = { applicationMoment: CONTRACT.trigger };

const ANSWERS = {
  problem: "리더의 말과 실제 행동이 다르면 아무리 좋은 말을 해도 신뢰가 생기지 않는다.",
  audienceType: "leaders",
  recurringMoment: CONTRACT.trigger,
  observableBehavior: HOST_STANDARD,
  successEvidence: HOST_EVIDENCE,
  followUpDays: 7,
  materialIntent: "live_discussion",
  learningNeeds: ["shared_standard", "decide"],
} as unknown as BuilderAnswers;

const contractsFor = (loc: "en" | "ko", completionPrompt: string | null = null) =>
  contractsFromProposal(
    {
      displayTitle: "t",
      elements: [
        { kind: "observable_standard" as JourneyElementKind, content: "x", rationale: "" },
        { kind: "action_decision" as JourneyElementKind, content: "x", rationale: "" },
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

/**
 * The two halves of the new question. `asksForAction` deliberately recognises the PRE-FIX wording
 * too — "무엇을 다르게 해보겠습니까" and "what will you do differently" — because a predicate that
 * only matched the new copy would prove nothing about what changed.
 */
const asksForAction = (q: string, loc: "en" | "ko"): boolean =>
  loc === "ko" ? /무엇을\s*(하|다르게)/.test(q) : /what will you do/i.test(q);
/** The half the training cannot supply: WHICH real occasion, and when. */
const asksForOccasion = (q: string, loc: "en" | "ko"): boolean =>
  loc === "ko" ? /언제/.test(q) : /\bwhen\b/i.test(q);

const LOCALES = ["en", "ko"] as const;

// ---------------------------------------------------------------------------
// T1-T3 · the question BTY derives
// ---------------------------------------------------------------------------

describe("[R4-R5C17A · T1-T3] YOUR DECISION anchors on the learner's next opportunity", () => {
  it("T1 a grounded action_decision derives the next-opportunity question", () => {
    for (const loc of LOCALES) {
      const derived = deriveInstructionalContent("action_decision", contractsFor(loc));
      expect(derived, loc).toBe(renderDecisionSentence(CONTRACT, APP, loc));
      expect(derived, loc).not.toBeNull();
      expect(asksForOccasion(derived!, loc), loc).toBe(true);
      expect(asksForAction(derived!, loc), loc).toBe(true);
    }
    expect(requiredProgramKinds(ANSWERS)).toContain("action_decision");
  });

  it("T2 KO carries both halves of the contract", () => {
    const ko = renderDecisionSentence(CONTRACT, APP, "ko");
    expect(ko).toBe("이것을 가장 먼저 해볼 상황은 언제인가요? 그때 무엇을 하겠어요?");
    expect(asksForOccasion(ko, "ko")).toBe(true);
    expect(asksForAction(ko, "ko")).toBe(true);
  });

  it("T3 EN carries the same two halves", () => {
    const en = renderDecisionSentence(CONTRACT, APP, "en");
    expect(en).toBe("When is the next time this will come up for you, and what will you do then?");
    expect(asksForOccasion(en, "en")).toBe(true);
    expect(asksForAction(en, "en")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T4-T7 · the copy-resistance property itself
// ---------------------------------------------------------------------------

describe("[R4-R5C17A · T4-T7] THE STANDARD can no longer be the whole answer", () => {
  it("T4 observableBehavior alone leaves the occasion unanswered", () => {
    /*
      The pre-fix differential. THE STANDARD prescribes the action — "내가 먼저 그 기준을 행동으로
      보여주고 있는지 확인한다" — so against the OLD question, which asked only for an action, the
      Host's sentence was a complete honest answer. It names no occasion, and the new question
      demands one.
    */
    expect(asksForOccasion(HOST_STANDARD, "ko")).toBe(false);
    const ko = renderDecisionSentence(CONTRACT, APP, "ko");
    expect(asksForOccasion(ko, "ko")).toBe(true);
    // Nothing of the question is lifted from the Host's sentence either.
    expect(ko).not.toContain(CONTRACT.observableAction);
    expect(ko).not.toContain(CONTRACT.trigger);
  });

  it("T5 successEvidence alone leaves it unanswered too", () => {
    expect(asksForOccasion(HOST_EVIDENCE, "ko")).toBe(false);
    expect(renderDecisionSentence(CONTRACT, APP, "ko")).not.toContain(CONTRACT.completion.criterion);
  });

  it("T6 no sentence anywhere in the derived journey supplies the occasion", () => {
    for (const loc of LOCALES) {
      const c = contractsFor(loc);
      const host = loc === "ko" ? [HOST_STANDARD, HOST_EVIDENCE] : [];
      const derivedElsewhere = requiredProgramKinds(ANSWERS)
        .filter((k) => k !== "action_decision")
        .map((k) => deriveInstructionalContent(k, c))
        .filter((s): s is string => typeof s === "string" && s.length > 0);
      for (const text of [...host, ...derivedElsewhere]) {
        expect(asksForOccasion(text, loc), `${loc}: ${text}`).toBe(false);
      }
    }
  });

  it("T7 it stays a question a person answers in a sentence or two", () => {
    // Two clauses, one occasion and one action — not an essay prompt, and no BTY vocabulary.
    expect(renderDecisionSentence(CONTRACT, APP, "ko").length).toBeLessThanOrEqual(48);
    expect(renderDecisionSentence(CONTRACT, APP, "en").length).toBeLessThanOrEqual(96);
    for (const loc of LOCALES) {
      const q = renderDecisionSentence(CONTRACT, APP, loc);
      expect(q.trimEnd().endsWith("?"), loc).toBe(true);
      expect((q.match(/\?/g) ?? []).length, loc).toBeLessThanOrEqual(2);
      expect(q, loc).not.toMatch(/standard|behaviour|behavior|기준|행동 기준/i);
    }
  });
});

// ---------------------------------------------------------------------------
// T8-T12 · what this slice must NOT move
// ---------------------------------------------------------------------------

describe("[R4-R5C17A · T8-T12] containment", () => {
  it("T8 the C16B barrier question is byte-identical", () => {
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "ko", true))
      .toBe("실제 업무에서 이것을 행동으로 옮기기 어렵게 만드는 것은 무엇일까요?");
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "en", true))
      .toBe("What might make this difficult to do in real work?");
    // …and the no-decision branch is untouched as well.
    expect(renderCompletionQuestion(CONTRACT, COMPLETION, "en")).toBe("The next time this happens, what exactly will you do?");
  });

  it("T9 the two boxes remain two different jobs", () => {
    for (const loc of LOCALES) {
      const before = renderCompletionQuestion(CONTRACT, COMPLETION, loc, true)!;
      const decision = renderDecisionSentence(CONTRACT, APP, loc);
      expect(before, loc).not.toBe(decision);
      // BEFORE YOU FINISH asks what gets in the way; YOUR DECISION asks when and what.
      expect(asksForOccasion(before, loc), loc).toBe(false);
      expect(asksForAction(before, loc), loc).toBe(false);
      expect(asksForOccasion(decision, loc), loc).toBe(true);
    }
  });

  it("T10 the renderer is pure copy — it reads no contract text and no learner field", () => {
    // Same sentence for any behaviour and any moment: nothing about the learner's answer, the
    // Host's prose or `decision_response_text` is consulted here.
    const other: BehaviorContract = {
      actor: "the shift lead",
      trigger: "During the weekly scheduling review",
      observableAction: "read the dosage back before signing",
      completion: { criterion: "The huddle note records it." },
    };
    for (const loc of LOCALES) {
      expect(renderDecisionSentence(other, { applicationMoment: other.trigger }, loc))
        .toBe(renderDecisionSentence(CONTRACT, APP, loc));
      expect(renderDecisionSentence(CONTRACT, APP, loc)).toBe(journeyCopy(loc).decision);
    }
  });

  it("T11 a Host's own completion question still outranks everything BTY renders", () => {
    const hostQuestion = "체크리스트를 어떻게 쓰실 계획입니까?";
    expect(deriveInstructionalContent("completion_check", contractsFor("ko", hostQuestion))).toBe(hostQuestion);
    expect(resolveCompletionCheck(hostQuestion, renderCompletionQuestion(CONTRACT, COMPLETION, "ko", true))).toBe(hostQuestion);
  });

  it("T12 the Host's two sentences still reach the learner untouched", () => {
    const c = contractsFor("ko");
    // R4-R5C14A: BTY renders nothing for these, so the Host's words are what publish freezes.
    expect(deriveInstructionalContent("observable_standard", c)).toBeNull();
    expect(deriveInstructionalContent("evidence", c)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T13-T14 · locale parity and the C11 repetition budget
// ---------------------------------------------------------------------------

describe("[R4-R5C17A · T13-T14] both languages, and no behaviour repeated", () => {
  it("T13 KO is Korean, EN is English, neither leaks the other, undefined falls back to EN", () => {
    expect(journeyCopy("ko").decision).toMatch(/[가-힣]/);
    expect(journeyCopy("ko").decision).not.toMatch(/[A-Za-z]{3,}/);
    expect(journeyCopy("en").decision).not.toMatch(/[가-힣]/);
    expect(journeyCopy(undefined).decision).toBe(journeyCopy("en").decision);
    expect(journeyCopy("ko").decision).not.toBe(journeyCopy("en").decision);
  });

  it("T14 the question still states no behaviour of its own (C11)", () => {
    for (const loc of LOCALES) {
      const q = renderDecisionSentence(CONTRACT, APP, loc);
      expect(q, loc).not.toContain(CONTRACT.observableAction);
      expect(q, loc).not.toContain(CONTRACT.completion.criterion);
      expect(q, loc).not.toContain(CONTRACT.actor === "you" ? "zzz-never" : CONTRACT.actor);
      expect(q, loc).not.toContain(HOST_STANDARD.slice(0, 20));
    }
  });
});
