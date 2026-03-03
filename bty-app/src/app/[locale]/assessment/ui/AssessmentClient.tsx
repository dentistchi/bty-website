"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Dimension = "core" | "compassion" | "stability" | "growth" | "social";
type Question = { id: number; dimension: Dimension; text: string; reverse: boolean };

const LIKERT_KO = ["거의 그렇지 않다", "그렇지 않은 편이다", "보통이다", "그런 편이다", "매우 그렇다"];
const LIKERT_EN = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

/** CENTER_PAGE_IMPROVEMENT_SPEC §7: 한 문항씩 스텝/페이지네이션, 정성 플로우 */
export default function AssessmentClient({
  questions,
  locale = "ko",
}: {
  questions: Question[];
  locale?: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = questions.length;
  const isEn = locale === "en";
  const likertLabels = isEn ? LIKERT_EN : LIKERT_KO;

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const canGoNext = currentAnswer !== undefined;
  const isLast = currentIndex === total - 1;
  const canSubmit = answeredCount === total;

  function setAnswer(id: number, v: number) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function goNext() {
    if (!canGoNext) return;
    if (isLast) {
      const finalAnswers = { ...answers, [currentQuestion.id]: currentAnswer };
      sessionStorage.setItem("assessment.answers.v1", JSON.stringify(finalAnswers));
      router.push("./result");
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  const prevLabel = isEn ? "Previous" : "이전";
  const nextLabel = isEn ? "Next" : "다음";
  const seeResultLabel = isEn ? "See result" : "결과 보기";
  const progressLabel = isEn ? "Progress" : "진행";
  const hintLabel = isEn
    ? "Pick the option that feels closest. There are no wrong answers."
    : "맞는 말에 가깝다고 느끼는 칸을 골라 주세요. 정답은 없어요.";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)]">
          {isEn ? "Self-Esteem Assessment (50)" : "Today-Me 자가 진단 (50문항)"}
        </h1>
        <span className="text-sm text-[var(--arena-text-soft)]" aria-live="polite">
          {progressLabel} {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 bg-[var(--arena-text-soft)]/20 rounded-full overflow-hidden mb-8"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full bg-[var(--arena-accent)] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* §7: 한 문항씩 노출 — 질문 하나하나 정성 플로우 */}
      <section
        className="rounded-2xl border border-[var(--arena-text-soft)]/20 bg-white p-6 sm:p-8 shadow-sm"
        aria-label={isEn ? `Question ${currentIndex + 1} of ${total}` : `문항 ${currentIndex + 1} / ${total}`}
      >
        <p className="text-sm text-[var(--arena-text-soft)] mb-2">
          {isEn ? `Question ${currentIndex + 1}` : `문항 ${currentIndex + 1}`}
        </p>
        <p className="text-lg sm:text-xl font-medium text-[var(--arena-text)] mb-6 leading-snug">
          {currentQuestion.text}
        </p>
        <p className="text-sm text-[var(--arena-text-soft)] mb-4">{hintLabel}</p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAnswer(currentQuestion.id, v)}
              className={`rounded-xl px-3 py-3 sm:py-4 text-sm font-medium border-2 transition-colors ${
                currentAnswer === v
                  ? "border-[var(--arena-accent)] bg-[var(--arena-accent)]/10 text-[var(--arena-text)]"
                  : "border-[var(--arena-text-soft)]/30 text-[var(--arena-text-soft)] hover:border-[var(--arena-accent)]/50 hover:text-[var(--arena-text)]"
              }`}
            >
              {likertLabels[v - 1]}
            </button>
          ))}
        </div>
      </section>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="rounded-xl px-5 py-2.5 border border-[var(--arena-text-soft)]/40 text-[var(--arena-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--arena-text-soft)]/5 transition-colors"
        >
          {prevLabel}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className="rounded-xl px-5 py-2.5 font-medium bg-[var(--arena-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {isLast ? seeResultLabel : nextLabel}
        </button>
      </div>

      <p className="mt-6 text-xs text-center text-[var(--arena-text-soft)]">
        {isEn
          ? "This is not a grade. It's an energy map."
          : "이건 성적표가 아니라 에너지 지도예요."}
      </p>
    </div>
  );
}
