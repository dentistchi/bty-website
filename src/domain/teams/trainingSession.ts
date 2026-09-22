/**
 * Teams chat-native training — the sequential workflow's state machine. PURE.
 * Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. A learner answering five questions in a chat needs the server
 * to remember which question they are on between taps. That is all this decides. It is TRANSIENT
 * workflow state: the canonical result is the single immutable `foundry_event_quiz_attempts` row
 * written once at the end, and the canonical Foundry progress row.
 *
 * NO CORRECTNESS LIVES HERE. The session holds the learner's own chosen choice ids and an index.
 * Whether an answer is right is decided at the end, by the existing Quiz V1 scoring domain, from
 * the immutable event quiz. There is no second scoring engine and nothing here could serve as one.
 *
 * REPLAY IS ORDINARY, NOT AN ATTACK. A chat card stays on screen; a learner can tap `Next` twice,
 * or tap an older card. So an answer names the question it believed it was answering, and a tap
 * that does not match the session's current position is INERT rather than an error — it re-renders
 * where the learner actually is.
 */

export type TeamsSessionState = "READING" | "QUIZ" | "COMPLETED";

export type TeamsTrainingSession = {
  state: TeamsSessionState;
  currentQuestionIndex: number;
  /** The learner's own answers, in question order. Never a correct answer, never a score. */
  answers: { questionId: string; choiceId: string }[];
};

export const newTeamsSession = (): TeamsTrainingSession => ({
  state: "READING",
  currentQuestionIndex: 0,
  answers: [],
});

/** The acknowledgement moves a fresh session into the quiz; an already-started one is unchanged. */
export function sessionAfterRead(session: TeamsTrainingSession): TeamsTrainingSession {
  if (session.state !== "READING") return session;
  return { ...session, state: "QUIZ", currentQuestionIndex: 0 };
}

export type AnswerOutcome =
  /** The answer advanced the learner; `session` is where they now are. */
  | { kind: "advanced"; session: TeamsTrainingSession }
  /** That was the last question; `session` holds every answer, ready for canonical scoring. */
  | { kind: "final"; session: TeamsTrainingSession }
  /** A stale or duplicate tap. Nothing changes; show the learner where they actually are. */
  | { kind: "replay" }
  /** The session is not answering questions (not yet read, or already finished). */
  | { kind: "not_in_quiz" };

/**
 * Apply one answer.
 *
 * `expectedIndex` is what the CARD thought it was showing. It must equal the session's own index,
 * which is what makes an out-of-order or re-tapped card inert rather than able to overwrite an
 * answer the learner already gave.
 */
export function sessionAfterAnswer(
  session: TeamsTrainingSession,
  input: { expectedIndex: number; questionId: string; choiceId: string; totalQuestions: number },
): AnswerOutcome {
  if (session.state === "COMPLETED") return { kind: "replay" };
  if (session.state !== "QUIZ") return { kind: "not_in_quiz" };
  if (input.totalQuestions < 1) return { kind: "not_in_quiz" };
  if (input.expectedIndex !== session.currentQuestionIndex) return { kind: "replay" };

  const answers = [
    ...session.answers.slice(0, session.currentQuestionIndex),
    { questionId: input.questionId, choiceId: input.choiceId },
  ];
  const nextIndex = session.currentQuestionIndex + 1;

  if (nextIndex >= input.totalQuestions) {
    return { kind: "final", session: { state: "COMPLETED", currentQuestionIndex: input.totalQuestions, answers } };
  }
  return { kind: "advanced", session: { state: "QUIZ", currentQuestionIndex: nextIndex, answers } };
}

/**
 * Which card should this learner be shown right now?
 *
 * One place decides, so a read, a resume and a replayed answer all land on the same surface rather
 * than three callers each re-deriving it slightly differently.
 */
export function sessionSurface(
  session: TeamsTrainingSession,
  totalQuestions: number,
): { kind: "read" } | { kind: "question"; index: number } | { kind: "complete" } {
  if (session.state === "READING") return { kind: "read" };
  if (session.state === "COMPLETED") return { kind: "complete" };
  if (session.currentQuestionIndex >= totalQuestions) return { kind: "complete" };
  return { kind: "question", index: session.currentQuestionIndex };
}
