/**
 * Quick Training Quiz — domain (pure).
 *
 * The frozen quiz shape, its validity rules, and the server-side scoring that turns one
 * immutable attempt into a factual result. No DB, no I/O, no display strings.
 *
 * THE ANSWER KEY LIVES HERE AND ONLY HERE. `learnerQuizPayload` is the projection the learner
 * is allowed to see before they submit: questions, choices, order — and nothing that names the
 * correct answer or explains it. Every learner-facing read goes through it.
 */

export type QuizChoice = { id: string; label: string };

export type QuizQuestion = {
  id: string;
  text: string;
  choices: QuizChoice[];
  correctChoiceId: string;
  explanation?: string;
  /**
   * Generation-time grounding evidence: a verbatim substring of the source material the AI was
   * given. It is checked at generation and is NOT carried through the manager's editor, because
   * once a manager has edited the question it is no longer evidence of anything.
   */
  sourceEvidence?: string;
  position: number;
};

export type Quiz = { schemaVersion: 1; questions: QuizQuestion[] };

export type LearnerAnswer = { questionId: string; choiceId: string | null };

/**
 * HOW THIS QUIZ CAME TO EXIST, as stored on `foundry_event_quizzes.source_kind`.
 * Three authoring methods, three values, and the value must name the method that was actually
 * used — a quiz an AI drafted is `generated` even after a manager edited every word of it,
 * because the question of provenance is "where did this come from", not "who touched it last".
 */
export const QUIZ_SOURCE_KINDS = ["manual", "csv", "generated"] as const;
export type QuizSourceKind = (typeof QUIZ_SOURCE_KINDS)[number];

export function isQuizSourceKind(raw: unknown): raw is QuizSourceKind {
  return typeof raw === "string" && (QUIZ_SOURCE_KINDS as readonly string[]).includes(raw);
}

/** The bounds the DB check constraint also pins (`question_count between 1 and 20`). */
export const QUIZ_MIN_QUESTIONS = 1;
export const QUIZ_MAX_QUESTIONS = 20;
export const QUIZ_MIN_CHOICES = 2;
export const QUIZ_MAX_CHOICES = 4;

const clean = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** null when the quiz is storable; otherwise the first rule it breaks. */
export function validateQuiz(quiz: Quiz): string | null {
  if (
    !Array.isArray(quiz.questions) ||
    quiz.questions.length < QUIZ_MIN_QUESTIONS ||
    quiz.questions.length > QUIZ_MAX_QUESTIONS
  ) {
    return "question_count";
  }
  const ids = new Set<string>();
  for (const q of quiz.questions) {
    if (
      !q.id ||
      ids.has(q.id) ||
      !q.text.trim() ||
      q.choices.length < QUIZ_MIN_CHOICES ||
      q.choices.length > QUIZ_MAX_CHOICES
    ) {
      return "invalid_question";
    }
    ids.add(q.id);
    const options = new Set<string>();
    for (const c of q.choices) {
      const v = clean(c.label);
      if (!c.id || !v || options.has(v)) return "invalid_choice";
      options.add(v);
    }
    if (!q.choices.some((c) => c.id === q.correctChoiceId)) return "invalid_correct_choice";
  }
  return null;
}

export function scoreQuiz(quiz: Quiz, answers: LearnerAnswer[]) {
  const invalid = validateQuiz(quiz);
  if (invalid) return { ok: false as const, reason: invalid };
  const submitted = new Map<string, string | null>();
  for (const answer of answers) {
    if (submitted.has(answer.questionId)) return { ok: false as const, reason: "duplicate_answer" };
    const question = quiz.questions.find((q) => q.id === answer.questionId);
    if (!question) return { ok: false as const, reason: "unknown_question" };
    if (answer.choiceId !== null && !question.choices.some((c) => c.id === answer.choiceId)) {
      return { ok: false as const, reason: "unknown_choice" };
    }
    submitted.set(answer.questionId, answer.choiceId);
  }
  const correctCount = quiz.questions.filter((q) => submitted.get(q.id) === q.correctChoiceId).length;
  return {
    ok: true as const,
    correctCount,
    totalCount: quiz.questions.length,
    scorePercent: Math.round((correctCount * 100) / quiz.questions.length),
  };
}

/** The pre-submit learner projection. The answer key and the explanation are deliberately absent. */
export function learnerQuizPayload(quiz: Quiz) {
  return { questions: quiz.questions.map(({ id, text, choices, position }) => ({ id, text, choices, position })) };
}
