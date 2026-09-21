"use client";

import { useMemo } from "react";
import {
  QUIZ_MAX_CHOICES,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_CHOICES,
} from "@/domain/foundry/events/quickTrainingQuiz";
import {
  addQuizChoice,
  addQuizQuestion,
  quizDraftErrors,
  removeQuizChoice,
  removeQuizQuestion,
  setQuizChoiceLabel,
  setQuizCorrectChoice,
  setQuizExplanation,
  setQuizQuestionText,
  type QuizDraft,
  type QuizDraftError,
} from "@/domain/foundry/events/quickTrainingQuizDraft";
import type { EventRoomsCopy } from "./copy";

/**
 * THE ONE QUIZ EDITOR.
 *
 * Manual authoring, CSV import and AI generation all land here — the editor never learns which,
 * because what a manager may fix must not depend on how the quiz arrived. It renders a
 * `QuizDraft` and reports the next `QuizDraft`; every change is a pure function from
 * `quickTrainingQuizDraft`, so the rules (2–4 choices, exactly one correct answer, at most 20
 * questions) live in one testable place and this file only shows them.
 *
 * NOTHING HERE PUBLISHES. The draft becomes a quiz only when the manager creates the training,
 * and the server re-validates it then.
 */
export function QuizEditor({
  draft,
  onChange,
  t,
  showErrors,
}: {
  draft: QuizDraft;
  onChange: (next: QuizDraft) => void;
  t: EventRoomsCopy;
  /** Problems are named only once the manager has tried to create — not while they are typing. */
  showErrors: boolean;
}) {
  const errors = useMemo(() => (showErrors ? quizDraftErrors(draft) : []), [draft, showErrors]);
  const messageFor = (questionId: string): string | null => {
    const codes = new Set(errors.filter((e: QuizDraftError) => e.questionId === questionId).map((e) => e.code));
    if (codes.has("question_text_required")) return t.quizQuestionTextError;
    if (codes.has("choice_label_required")) return t.quizChoiceLabelError;
    if (codes.has("duplicate_choice")) return t.quizDuplicateChoiceError;
    if (codes.has("correct_choice_required")) return t.quizCorrectChoiceError;
    return null;
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/[0.1] p-4" data-testid="quiz-editor">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-white/80">{t.quizEditorHeading}</span>
        <span className="text-xs text-white/45" data-testid="quiz-editor-count">
          {t.quizEditorCount(draft.questions.length, QUIZ_MAX_QUESTIONS)}
        </span>
      </div>
      <p className="text-xs leading-5 text-white/50">{t.quizEditorLead}</p>

      {draft.questions.map((question, index) => {
        const message = messageFor(question.id);
        return (
          <fieldset
            key={question.id}
            className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
            data-testid="quiz-editor-question"
          >
            <legend className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-white/45">
              {t.quizQuestionLabel(index + 1)}
            </legend>

            <input
              type="text"
              value={question.text}
              maxLength={300}
              onChange={(e) => onChange(setQuizQuestionText(draft, question.id, e.target.value))}
              placeholder={t.quizQuestionPlaceholder}
              aria-label={t.quizQuestionLabel(index + 1)}
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
            />

            <div className="flex flex-col gap-2">
              {question.choices.map((choice, choiceIndex) => (
                <div key={choice.id} className="flex items-center gap-2">
                  {/*
                    EXACTLY ONE CORRECT ANSWER, expressed as a radio group named for the question.
                    A checkbox would let a manager mark two, and the scorer has no meaning for that.
                  */}
                  <input
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={question.correctChoiceId === choice.id}
                    onChange={() => onChange(setQuizCorrectChoice(draft, question.id, choice.id))}
                    aria-label={`${t.quizCorrectLabel} — ${t.quizChoicePlaceholder(choiceIndex + 1)}`}
                    className="h-4 w-4 shrink-0 accent-[#C9A66B]"
                  />
                  <input
                    type="text"
                    value={choice.label}
                    maxLength={200}
                    onChange={(e) => onChange(setQuizChoiceLabel(draft, question.id, choice.id, e.target.value))}
                    placeholder={t.quizChoicePlaceholder(choiceIndex + 1)}
                    aria-label={t.quizChoicePlaceholder(choiceIndex + 1)}
                    className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
                  />
                  {question.choices.length > QUIZ_MIN_CHOICES ? (
                    <button
                      type="button"
                      onClick={() => onChange(removeQuizChoice(draft, question.id, choice.id))}
                      className="shrink-0 rounded-lg border border-white/[0.12] px-2 py-1.5 text-xs text-white/55 hover:text-white/90"
                    >
                      {t.quizRemoveChoice}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {question.choices.length < QUIZ_MAX_CHOICES ? (
                <button
                  type="button"
                  onClick={() => onChange(addQuizChoice(draft, question.id))}
                  className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/70 hover:text-white"
                >
                  {t.quizAddChoice}
                </button>
              ) : null}
              {draft.questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange(removeQuizQuestion(draft, question.id))}
                  className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-white/55 hover:text-white/90"
                >
                  {t.quizRemoveQuestion}
                </button>
              ) : null}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-white/50">{t.quizExplanationLabel}</span>
              <textarea
                rows={2}
                maxLength={500}
                value={question.explanation}
                onChange={(e) => onChange(setQuizExplanation(draft, question.id, e.target.value))}
                placeholder={t.quizExplanationPlaceholder}
                aria-label={t.quizExplanationLabel}
                className="w-full resize-none rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
              />
            </label>

            {message ? (
              <p className="text-xs text-red-300" data-testid="quiz-editor-question-error">
                {message}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      {draft.questions.length < QUIZ_MAX_QUESTIONS ? (
        <button
          type="button"
          onClick={() => onChange(addQuizQuestion(draft))}
          data-testid="quiz-editor-add-question"
          className="rounded-xl border border-[#C9A66B]/40 px-4 py-2.5 text-sm font-medium text-white/85 hover:border-[#C9A66B]/70"
        >
          {t.quizAddQuestion}
        </button>
      ) : null}
    </section>
  );
}
