"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/components/foundry/event-rooms/copy";

/**
 * THE LEARNER'S QUIZ — one panel, every material type.
 *
 * A quiz can be attached to a video, a PDF or a text training, so the panel that serves it
 * belongs to none of them. It was previously inlined in the video room only, which meant a quiz
 * on a PDF or a text training would have been created by the Host and never shown to anyone.
 *
 * ANSWER-KEY SAFETY IS THE SERVER'S, NOT THIS FILE'S. `GET /quiz` returns questions and choices
 * only (`learnerQuizPayload`); the correct answers arrive for the first time in the SUBMIT
 * response, after the attempt is durable. This component therefore cannot leak a key it was
 * never sent.
 */

export type LearnerQuiz = {
  questions: { id: string; text: string; choices: { id: string; label: string }[]; position: number }[];
};

type QuizResult = {
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  questions: {
    id: string;
    text: string;
    choices: { id: string; label: string }[];
    selectedChoiceId: string | null;
    correctChoiceId: string;
    explanation: string | null;
  }[];
};

const COPY = {
  en: {
    eyebrow: "QUICK QUIZ",
    resultEyebrow: "QUIZ RESULT",
    heading: "Check what you learned",
    correct: (n: number) => `${n}% correct`,
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    noAnswer: "No answer",
    submit: "Submit quiz",
    saving: "Saving…",
    failed: "Your quiz could not be saved. Please try again.",
    continue: "Continue",
  },
  ko: {
    eyebrow: "퀴즈",
    resultEyebrow: "퀴즈 결과",
    heading: "배운 내용을 확인해 보세요",
    correct: (n: number) => `정답률 ${n}%`,
    yourAnswer: "내 답",
    correctAnswer: "정답",
    noAnswer: "답하지 않음",
    submit: "퀴즈 제출",
    saving: "저장 중…",
    failed: "퀴즈를 저장하지 못했습니다. 다시 시도해 주세요.",
    continue: "계속하기",
  },
} as const;

const api = (token: string, path = "") => `/api/bty/foundry/public/${encodeURIComponent(token)}${path}`;

/** Best-effort device IANA tz for the follow-up due-date resolution. Capture-only. */
function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * Does this room have a quiz for THIS learner, and have they already submitted it?
 *
 *   null  — still resolving. Render nothing quiz-shaped yet.
 *   false — no quiz, or already submitted: the room's own completion surface applies.
 *   quiz  — show the quiz instead of the written completion check.
 *
 * `active` is the caller's own "the learner has reached the completion step" predicate, so each
 * room keeps its own notion of when that is rather than this hook guessing at four stages.
 */
export function useLearnerQuiz(token: string, active: boolean): LearnerQuiz | false | null {
  const [quiz, setQuiz] = useState<LearnerQuiz | false | null>(null);
  useEffect(() => {
    if (!active) {
      setQuiz(null);
      return;
    }
    let cancelled = false;
    void fetch(api(token, "/quiz"), { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setQuiz(data?.submitted ? false : data?.quiz?.questions ? (data.quiz as LearnerQuiz) : false);
      })
      .catch(() => {
        if (!cancelled) setQuiz(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, token]);
  return quiz;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{children}</span>
  );
}

export function LearnerQuizPanel({
  token,
  quiz,
  locale,
  onSubmitted,
}: {
  token: string;
  quiz: LearnerQuiz;
  locale: Locale;
  /** Fired once the attempt is durable, so the room can refresh its own completion state. */
  onSubmitted?: () => void;
}) {
  const t = COPY[locale];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api(token, "/quiz/submit"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: quiz.questions.map((q) => ({ questionId: q.id, choiceId: answers[q.id] ?? null })),
          tz: deviceTz(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(t.failed);
        return;
      }
      setResult(data.result as QuizResult);
      onSubmitted?.();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }, [answers, busy, onSubmitted, quiz.questions, t.failed, token]);

  if (result) {
    return (
      <div className="btyFadeIn flex flex-1 flex-col justify-center gap-5" data-testid="quiz-result">
        <Eyebrow>{t.resultEyebrow}</Eyebrow>
        <h1 className="text-2xl font-semibold text-white">
          {result.correctCount} / {result.totalCount}
        </h1>
        <p className="text-lg text-[#C9A66B]">{t.correct(result.scorePercent)}</p>
        {result.questions.map((q, index) => {
          const correct = q.choices.find((c) => c.id === q.correctChoiceId)?.label;
          const selected = q.choices.find((c) => c.id === q.selectedChoiceId)?.label ?? t.noAnswer;
          return (
            <section key={q.id} className="rounded-xl border border-white/15 p-4">
              <p className="font-medium text-white">
                {index + 1}. {q.text}
              </p>
              <p className="mt-2 text-sm text-white/65">
                {t.yourAnswer}: {selected}
              </p>
              <p className="mt-1 text-sm text-[#C9A66B]">
                {t.correctAnswer}: {correct}
              </p>
              {q.explanation ? <p className="mt-2 text-sm text-white/60">{q.explanation}</p> : null}
            </section>
          );
        })}
        <a
          href={`/f/${encodeURIComponent(token)}`}
          className="rounded-xl bg-[#C9A66B] px-5 py-3.5 text-center text-base font-semibold text-[#0B1F3A]"
        >
          {t.continue}
        </a>
      </div>
    );
  }

  return (
    <div className="btyFadeIn flex flex-1 flex-col justify-center gap-5" data-testid="quiz-panel">
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <h1 className="text-xl font-semibold text-white">{t.heading}</h1>
      {quiz.questions.map((q, index) => (
        <fieldset key={q.id} className="rounded-xl border border-white/15 p-4">
          <legend className="px-1 text-base font-medium text-white">
            {index + 1}. {q.text}
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            {q.choices.map((choice) => (
              <label key={choice.id} className="flex cursor-pointer items-center gap-3 text-sm text-white/80">
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === choice.id}
                  onChange={() => setAnswers((old) => ({ ...old, [q.id]: choice.id }))}
                />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        data-testid="quiz-submit"
        className="rounded-xl bg-[#C9A66B] px-5 py-3.5 text-base font-semibold text-[#0B1F3A] disabled:opacity-60"
      >
        {busy ? t.saving : t.submit}
      </button>
    </div>
  );
}
