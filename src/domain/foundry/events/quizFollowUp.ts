import type { LearnerAnswer, Quiz } from "./quickTrainingQuiz";

/**
 * WHERE CLARIFICATION IS NEEDED — the missed half of a quiz result, and the sentence a Host
 * starts a conversation with. PURE. Slice Training Result → Human Teams Chat V1.
 *
 * ★ THE PRODUCT RULE THIS FILE ENCODES. A score is not the destination. `4 / 5` tells a Host that
 * something did not land but not what, so it cannot be acted on. What can be acted on is the ONE
 * question that was missed, and the answer the learner actually chose — that is a specific thing
 * two people can talk about.
 *
 * ★ ONLY THE OBJECTIVE QUIZ. Everything here is derived from the immutable event quiz and the
 * learner's own multiple-choice selections. There is no free text in either, which is why this
 * projection is safe for a Host to read at all: Private Reflection and Shared Understanding live
 * in different columns entirely and are never in scope here. A caller passing something else in
 * would be a different bug; this function simply has no field to leak.
 */

export type MissedQuestion = {
  questionId: string;
  position: number;
  text: string;
  /** What the learner chose. Null when they somehow answered nothing for this question. */
  selectedLabel: string | null;
  correctLabel: string;
  explanation: string | null;
};

/**
 * The questions this learner got wrong, in the quiz's own order.
 *
 * CORRECT ANSWERS ARE OMITTED, not marked. A Host opening this surface is deciding whether to
 * start a conversation, and a list of everything that went right is noise in that decision. An
 * unanswered question counts as missed — the learner did not demonstrate it either way.
 */
export function missedQuestions(quiz: Quiz, answers: LearnerAnswer[]): MissedQuestion[] {
  const chosen = new Map<string, string>();
  for (const answer of Array.isArray(answers) ? answers : []) {
    if (answer && typeof answer.questionId === "string" && typeof answer.choiceId === "string") {
      chosen.set(answer.questionId, answer.choiceId);
    }
  }

  const missed: MissedQuestion[] = [];
  for (const question of quiz.questions) {
    const selectedId = chosen.get(question.id) ?? null;
    if (selectedId === question.correctChoiceId) continue;

    const label = (id: string | null) =>
      id === null ? null : (question.choices.find((choice) => choice.id === id)?.label ?? null);
    const correctLabel = label(question.correctChoiceId);
    // A quiz whose correct choice is not among its own choices is malformed; there is nothing
    // truthful to show a Host about it, so it is left out rather than rendered as a blank.
    if (!correctLabel) continue;

    missed.push({
      questionId: question.id,
      position: question.position,
      text: question.text,
      selectedLabel: label(selectedId),
      correctLabel,
      explanation: question.explanation ?? null,
    });
  }
  return missed.sort((a, b) => a.position - b.position);
}

/**
 * The draft the Host is handed — NOT a message BTY sends.
 *
 * ★ IT IS DELIBERATELY UNDER-SPECIFIED. It names the training and proposes looking at one item
 * together, and stops there. It does not say which question, does not quote the wrong answer, and
 * does not evaluate the person: the Host is about to open a chat window where they can see all of
 * that themselves, and a draft that pre-judges the conversation is worse than a short one.
 *
 * ★ IT IS NEVER AUTO-SENT. The Host remains the sender and edits freely before sending; this text
 * only pre-populates the compose box.
 */
export function followUpDraft(trainingTitle: string, locale: "en" | "ko"): string {
  const title = (trainingTitle ?? "").trim().slice(0, 120);
  if (!title) {
    return locale === "ko"
      ? "최근 교육에서 한 항목을 같이 확인하고 싶어요."
      : "I'd like to go over one item from your recent training together.";
  }
  return locale === "ko"
    ? `${title}에서 한 항목을 같이 확인하고 싶어요.`
    : `I'd like to go over one item from ${title} together.`;
}
