import { describe, expect, it } from "vitest";
import { followUpDraft, missedQuestions } from "./quizFollowUp";
import type { Quiz } from "./quickTrainingQuiz";

const q = (id: string, position: number, correct: string, explanation?: string) => ({
  id,
  text: `Question ${id}`,
  choices: [
    { id: `${id}a`, label: `A for ${id}` },
    { id: `${id}b`, label: `B for ${id}` },
  ],
  correctChoiceId: correct,
  position,
  ...(explanation ? { explanation } : {}),
});

const quiz = (...questions: ReturnType<typeof q>[]): Quiz =>
  ({ schemaVersion: 1, questions }) as unknown as Quiz;

describe("missedQuestions", () => {
  it("returns nothing when every answer is correct", () => {
    const subject = quiz(q("1", 1, "1a"), q("2", 2, "2b"));
    expect(missedQuestions(subject, [
      { questionId: "1", choiceId: "1a" },
      { questionId: "2", choiceId: "2b" },
    ] as never)).toEqual([]);
  });

  it("returns only the missed question, never the correct ones", () => {
    const subject = quiz(q("1", 1, "1a"), q("2", 2, "2b"), q("3", 3, "3a"));
    const missed = missedQuestions(subject, [
      { questionId: "1", choiceId: "1a" },
      { questionId: "2", choiceId: "2a" },
      { questionId: "3", choiceId: "3a" },
    ] as never);
    expect(missed.map((m) => m.questionId)).toEqual(["2"]);
  });

  it("carries what the learner chose and what was correct, as labels", () => {
    const subject = quiz(q("1", 1, "1b"));
    const [missed] = missedQuestions(subject, [{ questionId: "1", choiceId: "1a" }] as never);
    expect(missed.selectedLabel).toBe("A for 1");
    expect(missed.correctLabel).toBe("B for 1");
  });

  it("carries the explanation when the author wrote one, and null when they did not", () => {
    const withText = quiz(q("1", 1, "1b", "Because the door is locked."));
    const without = quiz(q("1", 1, "1b"));
    expect(missedQuestions(withText, [{ questionId: "1", choiceId: "1a" }] as never)[0].explanation)
      .toBe("Because the door is locked.");
    expect(missedQuestions(without, [{ questionId: "1", choiceId: "1a" }] as never)[0].explanation)
      .toBeNull();
  });

  it("counts an UNANSWERED question as missed, with a null selection", () => {
    const subject = quiz(q("1", 1, "1a"), q("2", 2, "2a"));
    const missed = missedQuestions(subject, [{ questionId: "1", choiceId: "1a" }] as never);
    expect(missed).toHaveLength(1);
    expect(missed[0].questionId).toBe("2");
    expect(missed[0].selectedLabel).toBeNull();
  });

  it("orders by the quiz's own position, not by answer order", () => {
    const subject = quiz(q("1", 3, "1a"), q("2", 1, "2a"), q("3", 2, "3a"));
    const missed = missedQuestions(subject, [
      { questionId: "1", choiceId: "1b" },
      { questionId: "2", choiceId: "2b" },
      { questionId: "3", choiceId: "3b" },
    ] as never);
    expect(missed.map((m) => m.position)).toEqual([1, 2, 3]);
  });

  it("drops a malformed question whose correct choice is not among its choices", () => {
    const subject = quiz({ ...q("1", 1, "nowhere") });
    expect(missedQuestions(subject, [{ questionId: "1", choiceId: "1a" }] as never)).toEqual([]);
  });

  it("survives a missing or malformed answers array", () => {
    const subject = quiz(q("1", 1, "1a"));
    expect(missedQuestions(subject, undefined as never)).toHaveLength(1);
    expect(missedQuestions(subject, [null, { questionId: 5 }] as never)).toHaveLength(1);
  });
});

describe("followUpDraft", () => {
  it("names the training and proposes looking at one item together", () => {
    expect(followUpDraft("Morning Office Opening", "ko"))
      .toBe("Morning Office Opening에서 한 항목을 같이 확인하고 싶어요.");
    expect(followUpDraft("Morning Office Opening", "en"))
      .toBe("I'd like to go over one item from Morning Office Opening together.");
  });

  it("falls back to a title-free sentence rather than an empty reference", () => {
    expect(followUpDraft("   ", "ko")).toBe("최근 교육에서 한 항목을 같이 확인하고 싶어요.");
    expect(followUpDraft("", "en")).toBe("I'd like to go over one item from your recent training together.");
  });

  it("never names a question, an answer, or a score", () => {
    const draft = followUpDraft("Morning Office Opening", "en");
    expect(draft).not.toMatch(/\d\s*\/\s*\d|%|wrong|incorrect|question/i);
  });
});
