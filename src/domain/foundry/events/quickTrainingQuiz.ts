export type QuizChoice = { id: string; label: string };
export type QuizQuestion = { id: string; text: string; choices: QuizChoice[]; correctChoiceId: string; explanation?: string; sourceEvidence?: string; position: number };
export type Quiz = { schemaVersion: 1; questions: QuizQuestion[] };
export type LearnerAnswer = { questionId: string; choiceId: string | null };

const clean = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function validateQuiz(quiz: Quiz): string | null {
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1 || quiz.questions.length > 20) return "question_count";
  const ids = new Set<string>();
  for (const q of quiz.questions) {
    if (!q.id || ids.has(q.id) || !q.text.trim() || q.choices.length < 2 || q.choices.length > 4) return "invalid_question";
    ids.add(q.id);
    const options = new Set<string>();
    for (const c of q.choices) { const v = clean(c.label); if (!c.id || !v || options.has(v)) return "invalid_choice"; options.add(v); }
    if (!q.choices.some((c) => c.id === q.correctChoiceId)) return "invalid_correct_choice";
  }
  return null;
}

export function scoreQuiz(quiz: Quiz, answers: LearnerAnswer[]) {
  const invalid = validateQuiz(quiz); if (invalid) return { ok: false as const, reason: invalid };
  const submitted = new Map<string, string | null>();
  for (const answer of answers) {
    if (submitted.has(answer.questionId)) return { ok: false as const, reason: "duplicate_answer" };
    const question = quiz.questions.find((q) => q.id === answer.questionId);
    if (!question) return { ok: false as const, reason: "unknown_question" };
    if (answer.choiceId !== null && !question.choices.some((c) => c.id === answer.choiceId)) return { ok: false as const, reason: "unknown_choice" };
    submitted.set(answer.questionId, answer.choiceId);
  }
  const correctCount = quiz.questions.filter((q) => submitted.get(q.id) === q.correctChoiceId).length;
  return { ok: true as const, correctCount, totalCount: quiz.questions.length, scorePercent: Math.round((correctCount * 100) / quiz.questions.length) };
}

export function learnerQuizPayload(quiz: Quiz) {
  return { questions: quiz.questions.map(({ id, text, choices, position }) => ({ id, text, choices, position })) };
}
