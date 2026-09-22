/**
 * The sequential quiz workflow's state machine. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * A chat card stays on screen, so replay is ORDINARY here rather than adversarial — and it must be
 * inert rather than able to overwrite an answer the learner already gave.
 */
import { describe, it, expect } from "vitest";
import {
  newTeamsSession,
  sessionAfterAnswer,
  sessionAfterRead,
  sessionSurface,
  type TeamsTrainingSession,
} from "./trainingSession";

const at = (index: number, answers: { questionId: string; choiceId: string }[] = []): TeamsTrainingSession => ({
  state: "QUIZ",
  currentQuestionIndex: index,
  answers,
});

describe("reading moves a fresh session into the quiz", () => {
  it("starts at READING with nothing answered", () => {
    expect(newTeamsSession()).toEqual({ state: "READING", currentQuestionIndex: 0, answers: [] });
  });

  it("the acknowledgement opens question one", () => {
    expect(sessionAfterRead(newTeamsSession())).toEqual({ state: "QUIZ", currentQuestionIndex: 0, answers: [] });
  });

  it("acknowledging again is inert — it never rewinds a quiz in progress", () => {
    const mid = at(3, [{ questionId: "q1", choiceId: "a" }]);
    expect(sessionAfterRead(mid)).toBe(mid);
    const done: TeamsTrainingSession = { state: "COMPLETED", currentQuestionIndex: 5, answers: [] };
    expect(sessionAfterRead(done)).toBe(done);
  });
});

describe("answering", () => {
  const input = (over: Partial<Parameters<typeof sessionAfterAnswer>[1]> = {}) => ({
    expectedIndex: 0, questionId: "q1", choiceId: "a", totalQuestions: 3, ...over,
  });

  it("advances and records the learner's own choice", () => {
    const out = sessionAfterAnswer(at(0), input());
    expect(out.kind).toBe("advanced");
    if (out.kind !== "advanced") return;
    expect(out.session).toEqual({ state: "QUIZ", currentQuestionIndex: 1, answers: [{ questionId: "q1", choiceId: "a" }] });
  });

  it("the LAST answer completes, carrying every answer for canonical scoring", () => {
    const session = at(2, [{ questionId: "q1", choiceId: "a" }, { questionId: "q2", choiceId: "b" }]);
    const out = sessionAfterAnswer(session, input({ expectedIndex: 2, questionId: "q3", choiceId: "c" }));
    expect(out.kind).toBe("final");
    if (out.kind !== "final") return;
    expect(out.session.state).toBe("COMPLETED");
    expect(out.session.answers.map((a) => a.choiceId)).toEqual(["a", "b", "c"]);
  });

  it("★ a stale card is REPLAY — inert, never an overwrite", () => {
    const session = at(2, [{ questionId: "q1", choiceId: "a" }, { questionId: "q2", choiceId: "b" }]);
    for (const expectedIndex of [0, 1, 3]) {
      expect(sessionAfterAnswer(session, input({ expectedIndex })).kind, String(expectedIndex)).toBe("replay");
    }
    // The already-given answers are untouched, because nothing was returned to write.
    expect(session.answers).toHaveLength(2);
  });

  it("★ double-tapping the SAME card answers once", () => {
    const first = sessionAfterAnswer(at(0), input());
    expect(first.kind).toBe("advanced");
    if (first.kind !== "advanced") return;
    // The second tap still says index 0, but the session has moved on.
    expect(sessionAfterAnswer(first.session, input()).kind).toBe("replay");
  });

  it("a finished session cannot be answered again", () => {
    const done: TeamsTrainingSession = { state: "COMPLETED", currentQuestionIndex: 3, answers: [] };
    expect(sessionAfterAnswer(done, input()).kind).toBe("replay");
  });

  it("a session that has not read yet is not answering questions", () => {
    expect(sessionAfterAnswer(newTeamsSession(), input()).kind).toBe("not_in_quiz");
    expect(sessionAfterAnswer(at(0), input({ totalQuestions: 0 })).kind).toBe("not_in_quiz");
  });

  it("re-answering an EARLIER question cannot truncate later ones by surprise", () => {
    // The only way to write is at the current index, so answers grow by exactly one each time.
    let s = at(0);
    for (let i = 0; i < 3; i += 1) {
      const out = sessionAfterAnswer(s, input({ expectedIndex: i, questionId: `q${i + 1}`, choiceId: "a" }));
      if (out.kind === "advanced" || out.kind === "final") s = out.session;
    }
    expect(s.answers).toHaveLength(3);
  });
});

describe("one place decides which card to show", () => {
  it("maps each state to its surface", () => {
    expect(sessionSurface(newTeamsSession(), 3)).toEqual({ kind: "read" });
    expect(sessionSurface(at(1), 3)).toEqual({ kind: "question", index: 1 });
    expect(sessionSurface({ state: "COMPLETED", currentQuestionIndex: 3, answers: [] }, 3)).toEqual({ kind: "complete" });
  });

  it("an index past the end reads as complete rather than a missing question", () => {
    expect(sessionSurface(at(5), 3)).toEqual({ kind: "complete" });
  });
});
