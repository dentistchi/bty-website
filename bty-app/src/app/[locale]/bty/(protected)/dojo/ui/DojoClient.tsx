"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CardSkeleton, EmptyState } from "@/components/bty-arena";

type DojoQuestion = {
  id: number;
  area: string;
  orderInArea: number;
  textKo: string;
  textEn: string;
  scaleType: string;
};

const LIKERT_KO = ["거의 그렇지 않다", "그렇지 않은 편이다", "보통이다", "그런 편이다", "매우 그렇다"];
const LIKERT_EN = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export default function DojoClient({ locale = "ko" }: { locale?: string }) {
  const router = useRouter();
  const isEn = locale === "en";
  const likertLabels = isEn ? LIKERT_EN : LIKERT_KO;

  const [questions, setQuestions] = useState<DojoQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/dojo/questions")
      .then((r) => r.json())
      .then((data) => {
        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions);
        } else {
          setError(isEn ? "Failed to load questions." : "문항을 불러오지 못했어요.");
        }
      })
      .catch(() => setError(isEn ? "Failed to load questions." : "문항을 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }, [isEn]);

  const total = questions.length;
  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const canGoNext = currentAnswer !== undefined;
  const isLast = currentIndex === total - 1;

  const setAnswer = useCallback((id: number, v: number) => {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }, []);

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  async function goNext() {
    if (!canGoNext || submitting) return;
    if (isLast) {
      const finalAnswers = { ...answers, [currentQ.id]: currentAnswer };
      setSubmitting(true);
      try {
        const res = await fetch("/api/dojo/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": locale,
          },
          body: JSON.stringify({ answers: finalAnswers }),
        });
        if (res.ok) {
          const data = await res.json();
          sessionStorage.setItem("dojo.result.v1", JSON.stringify(data));
          router.push("./dojo/result");
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || (isEn ? "Submission failed." : "제출에 실패했어요."));
        }
      } catch {
        setError(isEn ? "Submission failed." : "제출에 실패했어요.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  if (loading) {
    const loadLabel = isEn ? "Loading questions" : "문항 불러오는 중";
    return (
      <div
        className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
        aria-busy="true"
        aria-label={loadLabel}
      >
        <div className="mb-8" role="presentation">
          <div className="flex items-center justify-between mb-6">
            <CardSkeleton showLabel={false} lines={1} style={{ height: 28, width: 220, borderRadius: 8 }} />
            <CardSkeleton showLabel={false} lines={1} style={{ height: 20, width: 48, borderRadius: 6 }} />
          </div>
          <div className="h-1.5 bg-[var(--arena-text-soft)]/20 rounded-full overflow-hidden">
            <div className="h-full w-1/5 rounded-full bg-[var(--arena-text-soft)]/30 animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--arena-text-soft)]/20 bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <CardSkeleton showLabel={false} lines={1} style={{ height: 16, width: 72, borderRadius: 6 }} />
          <CardSkeleton showLabel={false} lines={2} style={{ padding: 0, marginTop: 8 }} />
          <CardSkeleton showLabel={false} lines={1} style={{ height: 14, width: "90%", borderRadius: 6, marginTop: 12 }} />
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} showLabel={false} lines={1} style={{ height: 44, borderRadius: 12 }} />
            ))}
          </div>
        </div>
        <div className="mt-8 flex items-center justify-between gap-4">
          <CardSkeleton showLabel={false} lines={1} style={{ height: 40, width: 80, borderRadius: 12 }} />
          <CardSkeleton showLabel={false} lines={1} style={{ height: 40, width: 80, borderRadius: 12 }} />
        </div>
        <p className="mt-4 text-xs text-center text-[var(--arena-text-soft)]" aria-hidden="true">
          {isEn ? "Loading…" : "불러오는 중…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center" role="alert">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="underline text-sm" aria-label={isEn ? "Retry" : "다시 시도"}>
          {isEn ? "Retry" : "다시 시도"}
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <EmptyState
          icon="📋"
          message={isEn ? "No questions found." : "문항이 없습니다."}
          cta={
            <button onClick={() => window.location.reload()} className="underline text-sm mt-2" aria-label={isEn ? "Retry" : "다시 시도"}>
              {isEn ? "Retry" : "다시 시도"}
            </button>
          }
        />
      </div>
    );
  }

  const questionText = isEn ? currentQ.textEn : currentQ.textKo;

  const stepLabel = isEn ? `Step ${currentIndex + 1} of ${total}` : `진단 문항 ${currentIndex + 1} / ${total}`;
  const progressRegionLabel = isEn ? "Assessment progress" : "진단 진행";
  const skipToQuestionLabel = isEn ? "Skip to current question" : "현재 문항으로 건너뛰기";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Screen reader: announce step when it changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" key={currentIndex}>
        {stepLabel}
      </div>
      <a
        href="#dojo-current-step"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:rounded focus:ring-2 focus:ring-[var(--arena-accent)] focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:[clip:auto] focus:whitespace-normal focus:border border-[var(--arena-text-soft)]/30"
      >
        {skipToQuestionLabel}
      </a>
      <div
        role="region"
        aria-label={progressRegionLabel}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)]">
            {isEn ? "Dojo 50-Item Assessment" : "Dojo 역량 진단 (50문항)"}
          </h1>
          <span
            className="text-sm text-[var(--arena-text-soft)]"
            aria-live="polite"
            aria-label={stepLabel}
          >
            {currentIndex + 1} / {total}
          </span>
        </div>

        <div
          className="h-1.5 bg-[var(--arena-text-soft)]/20 rounded-full overflow-hidden"
          role="progressbar"
          aria-label={stepLabel}
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuetext={stepLabel}
        >
          <div
            className="h-full bg-[var(--arena-accent)] transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <section
        id="dojo-current-step"
        tabIndex={-1}
        className="rounded-2xl border border-[var(--arena-text-soft)]/20 bg-white p-6 sm:p-8 shadow-sm"
        aria-current="step"
        aria-label={stepLabel}
      >
        <p className="text-sm text-[var(--arena-text-soft)] mb-2">
          {isEn ? `Question ${currentIndex + 1}` : `문항 ${currentIndex + 1}`}
        </p>
        <p className="text-lg sm:text-xl font-medium text-[var(--arena-text)] mb-6 leading-snug">
          {questionText}
        </p>
        <p className="text-sm text-[var(--arena-text-soft)] mb-4">
          {isEn
            ? "Pick the option that feels closest. There are no wrong answers."
            : "맞는 말에 가깝다고 느끼는 칸을 골라 주세요. 정답은 없어요."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2" role="group" aria-label={isEn ? "Rate your response" : "응답 선택"}>
          {[1, 2, 3, 4, 5].map((v) => {
            const label = likertLabels[v - 1];
            const isSelected = currentAnswer === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setAnswer(currentQ.id, v)}
                aria-label={isEn ? `${label}${isSelected ? ", selected" : ""}` : `${label}${isSelected ? ", 선택됨" : ""}`}
                aria-pressed={isSelected}
                className={`rounded-xl px-3 py-3 sm:py-4 text-sm font-medium border-2 transition-colors ${
                  isSelected
                    ? "border-[var(--arena-accent)] bg-[var(--arena-accent)]/10 text-[var(--arena-text)]"
                    : "border-[var(--arena-text-soft)]/30 text-[var(--arena-text-soft)] hover:border-[var(--arena-accent)]/50 hover:text-[var(--arena-text)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between gap-4" role="group" aria-label={isEn ? "Previous and next question" : "이전·다음 문항"}>
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="rounded-xl px-5 py-2.5 border border-[var(--arena-text-soft)]/40 text-[var(--arena-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--arena-text-soft)]/5 transition-colors"
          aria-label={isEn ? "Previous question" : "이전 문항"}
        >
          {isEn ? "Previous" : "이전"}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext || submitting}
          className="rounded-xl px-5 py-2.5 font-medium bg-[var(--arena-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          aria-label={isLast ? (isEn ? "See result" : "결과 보기") : isEn ? "Next question" : "다음 문항"}
        >
          {submitting
            ? (isEn ? "Submitting…" : "제출 중…")
            : isLast
              ? (isEn ? "See result" : "결과 보기")
              : (isEn ? "Next" : "다음")}
        </button>
      </div>
      {submitting && (
        <div className="mt-4" aria-busy="true" aria-label={isEn ? "Submitting" : "제출 중"}>
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      )}

      <p className="mt-4 text-xs text-center text-[var(--arena-text-soft)]">
        {isEn
          ? `Answered: ${answeredCount} / ${total}`
          : `응답 완료: ${answeredCount} / ${total}`}
      </p>
    </div>
  );
}
