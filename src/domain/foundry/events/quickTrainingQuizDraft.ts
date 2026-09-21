/**
 * Quick Training Quiz — the shared EDITOR's draft model (pure).
 *
 * WHY THIS EXISTS. Three authoring methods reach the same place: Manual, CSV upload, and
 * "Generate from study content". Before this module each of them had its own half-editor —
 * CSV could only rename questions, generation could not be corrected at all, and Manual did
 * not exist — so what a manager could fix depended on how the quiz arrived. That is the defect
 * this removes: all three now produce a `QuizDraft`, and the editor edits a `QuizDraft`.
 *
 * A DRAFT IS NOT A QUIZ. A draft may be incomplete (a blank question, no correct answer chosen)
 * because a manager types in the order that suits them; a `Quiz` may not, because it is what the
 * learner is served and what the server scores. `quizFromDraft` is the one crossing between the
 * two, and it refuses rather than repairs.
 *
 * NOTHING HERE PERSISTS, VALIDATES SERVER-SIDE, OR TALKS TO A PROVIDER. The server re-validates
 * every quiz it is handed (`validateQuiz`) — this exists so the manager is told what is missing
 * before they submit, not so the server can trust the client.
 */

import {
  QUIZ_MAX_CHOICES,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_CHOICES,
  type Quiz,
  type QuizQuestion,
} from "./quickTrainingQuiz";

export type QuizDraftChoice = { id: string; label: string };

export type QuizDraftQuestion = {
  id: string;
  text: string;
  /** Always 2..4 once the editor has finished with it; a draft may briefly hold blanks. */
  choices: QuizDraftChoice[];
  /** "" while the manager has not yet chosen one. Exactly one choice is correct. */
  correctChoiceId: string;
  /** "" means the manager wrote no explanation; the stored quiz then omits the field. */
  explanation: string;
};

export type QuizDraft = { questions: QuizDraftQuestion[] };

/**
 * A draft problem, addressed to a specific question wherever one is to blame. `questionId` is
 * null only for whole-draft problems (no questions at all / more than the ceiling).
 */
export type QuizDraftError = {
  questionId: string | null;
  code:
    | "no_questions"
    | "too_many_questions"
    | "question_text_required"
    | "too_few_choices"
    | "too_many_choices"
    | "choice_label_required"
    | "duplicate_choice"
    | "correct_choice_required";
};

/*
  IDENTIFIERS ARE ALLOCATED, NEVER INVENTED. `Date.now()`/`Math.random()` would make this module
  impure and its output untestable, and a CSV import already arrives carrying its own ids
  ("q1…", "a"/"b"/"c"/"d"). So both allocators pick the first free name from a fixed, bounded
  pool — deterministic, collision-free against whatever ids are already in the draft, and large
  enough for the ceilings this quiz format has (20 questions, 4 choices).
*/
const CHOICE_ID_POOL = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

function freeQuestionId(draft: QuizDraft): string {
  const taken = new Set(draft.questions.map((q) => q.id));
  for (let n = 1; n <= QUIZ_MAX_QUESTIONS * 2; n += 1) {
    const candidate = `q${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `q${draft.questions.length + 1}`;
}

function freeChoiceId(question: QuizDraftQuestion): string {
  const taken = new Set(question.choices.map((c) => c.id));
  for (const candidate of CHOICE_ID_POOL) if (!taken.has(candidate)) return candidate;
  return `c${question.choices.length + 1}`;
}

function blankQuestion(id: string): QuizDraftQuestion {
  return {
    id,
    text: "",
    choices: [
      { id: "a", label: "" },
      { id: "b", label: "" },
    ],
    correctChoiceId: "",
    explanation: "",
  };
}

/** The editor's starting point for Manual authoring: one empty question with two empty choices. */
export function blankQuizDraft(): QuizDraft {
  return { questions: [blankQuestion("q1")] };
}

/**
 * Load an existing quiz into the editor. Used by CSV import and by AI generation — which is the
 * whole point: neither publishes, both land here.
 *
 * `sourceEvidence` is deliberately NOT carried across. It is a claim that a question is grounded
 * in a verbatim span of the supplied source, checked at generation time; the moment a manager can
 * rewrite the question it stops being that, and a stale claim is worse than no claim.
 */
export function draftFromQuiz(quiz: Quiz): QuizDraft {
  return {
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      choices: q.choices.map((c) => ({ id: c.id, label: c.label })),
      correctChoiceId: q.correctChoiceId,
      explanation: q.explanation ?? "",
    })),
  };
}

export function addQuizQuestion(draft: QuizDraft): QuizDraft {
  if (draft.questions.length >= QUIZ_MAX_QUESTIONS) return draft;
  return { questions: [...draft.questions, blankQuestion(freeQuestionId(draft))] };
}

/** Removing the last question is refused: a quiz with no questions is not a quiz. */
export function removeQuizQuestion(draft: QuizDraft, questionId: string): QuizDraft {
  if (draft.questions.length <= 1) return draft;
  const next = draft.questions.filter((q) => q.id !== questionId);
  return next.length === draft.questions.length ? draft : { questions: next };
}

function mapQuestion(
  draft: QuizDraft,
  questionId: string,
  fn: (q: QuizDraftQuestion) => QuizDraftQuestion,
): QuizDraft {
  return { questions: draft.questions.map((q) => (q.id === questionId ? fn(q) : q)) };
}

export function setQuizQuestionText(draft: QuizDraft, questionId: string, text: string): QuizDraft {
  return mapQuestion(draft, questionId, (q) => ({ ...q, text }));
}

export function setQuizExplanation(draft: QuizDraft, questionId: string, explanation: string): QuizDraft {
  return mapQuestion(draft, questionId, (q) => ({ ...q, explanation }));
}

export function setQuizChoiceLabel(
  draft: QuizDraft,
  questionId: string,
  choiceId: string,
  label: string,
): QuizDraft {
  return mapQuestion(draft, questionId, (q) => ({
    ...q,
    choices: q.choices.map((c) => (c.id === choiceId ? { ...c, label } : c)),
  }));
}

export function addQuizChoice(draft: QuizDraft, questionId: string): QuizDraft {
  return mapQuestion(draft, questionId, (q) =>
    q.choices.length >= QUIZ_MAX_CHOICES ? q : { ...q, choices: [...q.choices, { id: freeChoiceId(q), label: "" }] },
  );
}

/**
 * Remove a choice, never below two. Removing the CORRECT one clears the answer rather than
 * silently promoting a neighbour — the manager chose that answer and must choose again.
 */
export function removeQuizChoice(draft: QuizDraft, questionId: string, choiceId: string): QuizDraft {
  return mapQuestion(draft, questionId, (q) => {
    if (q.choices.length <= QUIZ_MIN_CHOICES) return q;
    const choices = q.choices.filter((c) => c.id !== choiceId);
    if (choices.length === q.choices.length) return q;
    return { ...q, choices, correctChoiceId: q.correctChoiceId === choiceId ? "" : q.correctChoiceId };
  });
}

/** Exactly one correct answer per question — selecting one replaces whatever was selected before. */
export function setQuizCorrectChoice(draft: QuizDraft, questionId: string, choiceId: string): QuizDraft {
  return mapQuestion(draft, questionId, (q) =>
    q.choices.some((c) => c.id === choiceId) ? { ...q, correctChoiceId: choiceId } : q,
  );
}

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Every reason this draft is not yet a storable quiz. Empty = ready. */
export function quizDraftErrors(draft: QuizDraft): QuizDraftError[] {
  const errors: QuizDraftError[] = [];
  if (draft.questions.length < 1) errors.push({ questionId: null, code: "no_questions" });
  if (draft.questions.length > QUIZ_MAX_QUESTIONS) errors.push({ questionId: null, code: "too_many_questions" });
  for (const q of draft.questions) {
    if (!q.text.trim()) errors.push({ questionId: q.id, code: "question_text_required" });
    if (q.choices.length < QUIZ_MIN_CHOICES) errors.push({ questionId: q.id, code: "too_few_choices" });
    if (q.choices.length > QUIZ_MAX_CHOICES) errors.push({ questionId: q.id, code: "too_many_choices" });
    if (q.choices.some((c) => !c.label.trim())) errors.push({ questionId: q.id, code: "choice_label_required" });
    const seen = new Set<string>();
    for (const c of q.choices) {
      const key = normalize(c.label);
      if (!key) continue;
      if (seen.has(key)) {
        errors.push({ questionId: q.id, code: "duplicate_choice" });
        break;
      }
      seen.add(key);
    }
    if (!q.choices.some((c) => c.id === q.correctChoiceId)) {
      errors.push({ questionId: q.id, code: "correct_choice_required" });
    }
  }
  return errors;
}

/**
 * The one crossing from draft to storable quiz. Positions are RENUMBERED from the editor's
 * order, so the learner is served the questions in the order the manager arranged them, and a
 * blank explanation becomes an absent field rather than an empty string.
 */
export function quizFromDraft(draft: QuizDraft): { ok: true; quiz: Quiz } | { ok: false; errors: QuizDraftError[] } {
  const errors = quizDraftErrors(draft);
  if (errors.length > 0) return { ok: false, errors };
  const questions: QuizQuestion[] = draft.questions.map((q, index) => {
    const explanation = q.explanation.trim();
    return {
      id: q.id,
      text: q.text.trim(),
      position: index + 1,
      choices: q.choices.map((c) => ({ id: c.id, label: c.label.trim() })),
      correctChoiceId: q.correctChoiceId,
      ...(explanation ? { explanation } : {}),
    };
  });
  return { ok: true, quiz: { schemaVersion: 1, questions } };
}
