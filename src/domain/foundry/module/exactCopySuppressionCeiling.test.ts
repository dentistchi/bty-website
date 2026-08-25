import { describe, it, expect } from "vitest";
import {
  classifyLearnerQuestion,
  copyLikeLearnerQuestions,
  questionIsCopyLike,
  isCopyLikeQuestion,
  EXACT_COPY_OVERLAP,
  QUESTION_OVERLAP_HIGH,
  BTY_SUGGESTED_SHARED_QUESTIONS,
} from "./learnerQuestionRole";
import { overlapRatio } from "./program-authorship";
import { journeyCopy } from "./journeyLocaleCopy";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE R4-R5C19A — AN EXACT COPY IS NOT REDEEMED BY ASKING FOR A DECISION.
 *
 * MEASURED ON ALL 50 LIVE BUILDER QUESTIONS, not on an argument. The advisory flagged 28 and
 * stayed silent on 8. Every one of the 8 sits at overlap 1.00 — the whole standard, token for
 * token, inside the question — and every one of the 8 is silenced by the same clause:
 *
 *     if (currentPracticeLike || applicationLike) return false;
 *
 * because the legacy template that produced them ends "…what is one thing you will apply this
 * week?", and `one thing` is an application stem. The overlap distribution is 8 at 1.00, 12
 * between 0.50 and 0.99, 4 between 0.33 and 0.49, 26 below — and the false negatives are the
 * entire top of it. The classifier was quietest exactly where the copying was total.
 *
 * WHY THE SUPPRESSION EXISTS AND STAYS. C12A's reasoning holds for every case it was written
 * for: a question that asks what the learner will do next has already given them something only
 * they can supply, so sharing vocabulary with the standard is subject matter rather than leakage.
 * That is true right up to the point where the question also PRINTS the answer. This adds a
 * ceiling above the suppression and changes nothing beneath it.
 *
 * WHY 1.00 AND NOT 0.9. `overlapRatio` divides by the SMALLER token set, so 1.00 does not mean
 * "similar" — it means one text contains every significant word of the other. It is an integer
 * quotient n/n, exact in IEEE-754, never an approximation. All 8 measured misses are at it; no
 * lower threshold is needed to reach them, and any lower one would start re-deciding the 12
 * partial-overlap questions this slice has no evidence about.
 *
 * NOT IN SCOPE (dispatch §8/§9): Korean morphology, the EN inflection weakness, and wiring
 * `isBtySuggestedCompletionPrompt`. A second detector in the same build would make it impossible
 * to know which repair closed the defect.
 */

const STANDARD =
  "An employee pauses to visually inspect the tray against a reference photo before handing it over.";

/** The live legacy template, by shape: the whole standard quoted, then an application ask. */
const legacyTemplate = (standard: string) =>
  `Thinking about "${standard}", what is one thing you will apply this week?`;

const EN_DECISION = journeyCopy("en").decision;
const KO_DECISION = journeyCopy("ko").decision;
const EN_BARRIER = journeyCopy("en").completionBarrier;
const KO_BARRIER = journeyCopy("ko").completionBarrier;

// ---------------------------------------------------------------------------
// T1-T5 · the ceiling
// ---------------------------------------------------------------------------

describe("[R4-R5C19A · T1-T5] an exact copy is flagged whatever else the question does", () => {
  it("T1 overlap 1.00 + applicationLike → copy-like", () => {
    const q = legacyTemplate(STANDARD);
    const shape = classifyLearnerQuestion(q, STANDARD);
    expect(overlapRatio(q, STANDARD)).toBe(1);
    expect(shape.applicationLike).toBe(true);
    expect(isCopyLikeQuestion(shape)).toBe(true);
  });

  it("T2 overlap 1.00 + currentPracticeLike → copy-like", () => {
    const q = `Right now, how do you handle this: ${STANDARD}`;
    const shape = classifyLearnerQuestion(q, STANDARD);
    expect(overlapRatio(q, STANDARD)).toBe(1);
    expect(shape.currentPracticeLike).toBe(true);
    expect(isCopyLikeQuestion(shape)).toBe(true);
  });

  it("T3 overlap 1.00 + recallLike → copy-like (it already was, and still is)", () => {
    const q = `In your own words, describe the standard: ${STANDARD}`;
    expect(overlapRatio(q, STANDARD)).toBe(1);
    expect(questionIsCopyLike(q, STANDARD)).toBe(true);
  });

  it("T4 the live legacy template is flagged, in either language", () => {
    expect(questionIsCopyLike(legacyTemplate(STANDARD), STANDARD)).toBe(true);
    const koStandard = "팀원에게 어떤 기준을 요구하기 전에, 내가 먼저 그 기준을 행동으로 보여주고 있는지 확인한다.";
    expect(questionIsCopyLike(`"${koStandard}" — 이번 주에 적용할 한 가지는 무엇인가요?`, koStandard)).toBe(true);
  });

  it("T5 the shape holds across differently-worded standards", () => {
    for (const s of [
      "The owner repeats the action and the deadline aloud before the huddle ends.",
      "Employees can accurately list the regulations relevant to their own bench.",
      "Before the next consultation, review the checklist and use the reference card.",
      "Better work ethics, better attitude, good manner to patient welcoming.",
      "감사함에 대해 문장으로 말하는걸 듣는다.",
    ]) {
      expect(questionIsCopyLike(legacyTemplate(s), s), s).toBe(true);
    }
  });

  it("the threshold is exactly the top of the scale, and it is not an approximation", () => {
    expect(EXACT_COPY_OVERLAP).toBe(1);
    expect(EXACT_COPY_OVERLAP).toBeGreaterThan(QUESTION_OVERLAP_HIGH);
  });
});

// ---------------------------------------------------------------------------
// T6-T10 · everything below the ceiling is untouched
// ---------------------------------------------------------------------------

describe("[R4-R5C19A · T6-T10] behaviour beneath the ceiling is unchanged", () => {
  it("T6 a partial-overlap application question is still suppressed", () => {
    // Shares the standard's vocabulary without reproducing it, and asks for a decision.
    const q = "What is one thing you will do differently the next time you hand a tray over?";
    const ov = overlapRatio(q, STANDARD);
    expect(ov).toBeGreaterThan(0);
    expect(ov).toBeLessThan(EXACT_COPY_OVERLAP);
    expect(classifyLearnerQuestion(q, STANDARD).applicationLike).toBe(true);
    expect(questionIsCopyLike(q, STANDARD)).toBe(false);
  });

  it("T7 a genuine current-practice question stays unflagged", () => {
    for (const q of BTY_SUGGESTED_SHARED_QUESTIONS.slice(0, 2)) {
      expect(questionIsCopyLike(q, STANDARD), q).toBe(false);
    }
    expect(questionIsCopyLike("What usually happens when a tray comes back?", STANDARD)).toBe(false);
  });

  it("T8 the C16B barrier question is not flagged", () => {
    expect(questionIsCopyLike(EN_BARRIER, STANDARD)).toBe(false);
    expect(questionIsCopyLike(KO_BARRIER, "팀원에게 어떤 기준을 요구하기 전에 내가 먼저 보여준다")).toBe(false);
  });

  it("T9 the C17A next-opportunity question is not flagged", () => {
    expect(questionIsCopyLike(EN_DECISION, STANDARD)).toBe(false);
    expect(questionIsCopyLike(KO_DECISION, "팀원에게 어떤 기준을 요구하기 전에 내가 먼저 보여준다")).toBe(false);
  });

  it("T10 a plain recall question is flagged exactly as before", () => {
    expect(questionIsCopyLike("In your own words, what is the most important standard from this training?", STANDARD)).toBe(true);
    expect(questionIsCopyLike("이 교육에서 가장 중요한 행동 기준을 자신의 말로 설명해 주세요.", STANDARD)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T11-T15 · scope, shape and blast radius
// ---------------------------------------------------------------------------

describe("[R4-R5C19A · T11-T15] the advisory's scope and shape do not move", () => {
  it("T11/T12 both Builder fields reach the ceiling, and nothing else is read", () => {
    const answers = {
      observableBehavior: STANDARD,
      completionPrompt: legacyTemplate(STANDARD),
      sharedQuestion: legacyTemplate(STANDARD),
    } as BuilderAnswers;
    expect(copyLikeLearnerQuestions(answers).sort()).toEqual(["completionPrompt", "sharedQuestion"]);
    // An untouched field is still nothing to advise about.
    expect(copyLikeLearnerQuestions({ observableBehavior: STANDARD } as BuilderAnswers)).toEqual([]);
  });

  it("T13 the classifier still only describes — it refuses and rewrites nothing", () => {
    const out = copyLikeLearnerQuestions({
      observableBehavior: STANDARD,
      completionPrompt: legacyTemplate(STANDARD),
    } as BuilderAnswers);
    // A list of field names is the whole output. No verdict, no replacement, no block.
    expect(out).toEqual(["completionPrompt"]);
    expect(typeof out[0]).toBe("string");
  });

  it("T14 Korean tokenisation is deliberately NOT repaired in this build", () => {
    // The measured morphology gap: an inflected near-copy still scores below the high threshold.
    const std = "팀원에게 어떤 기준을 요구하기 전에 확인한다";
    const inflected = "팀원에게 어떤 기준을 요구하게 될 때 무엇을 하겠습니까";
    expect(overlapRatio(inflected, std)).toBeLessThan(QUESTION_OVERLAP_HIGH);
    expect(questionIsCopyLike(inflected, std)).toBe(false);
  });

  it("T15 derived questions remain outside the advisory's scope", () => {
    // `copyLikeLearnerQuestions` reads two Builder fields. YOUR DECISION is neither, so a draft
    // that carries only BTY's derived questions has nothing for the advisory to say.
    expect(copyLikeLearnerQuestions({ observableBehavior: STANDARD } as BuilderAnswers)).toEqual([]);
    expect(Object.keys({ completionPrompt: 1, sharedQuestion: 1 })).toHaveLength(2);
  });
});
