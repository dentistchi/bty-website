"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/lib/assessment/questions";
import type { AssessmentAnswers, Likert } from "@/lib/assessment/types";
import { scoreAssessment } from "@/lib/assessment";
import { saveResult } from "@/lib/assessment/storage";

const LIKERT: { v: Likert; label_en: string; label_ko: string }[] = [
  { v: 1, label_en: "Strongly disagree", label_ko: "거의 그렇지 않다" },
  { v: 2, label_en: "Disagree", label_ko: "그렇지 않다" },
  { v: 3, label_en: "Neutral", label_ko: "보통이다" },
  { v: 4, label_en: "Agree", label_ko: "그렇다" },
  { v: 5, label_en: "Strongly agree", label_ko: "매우 그렇다" },
];

/** CENTER_PAGE_IMPROVEMENT_SPEC §7: 한 문항(또는 소수)씩 스텝/페이지네이션, 질문 하나하나 정성 플로우 */
export default function AssessmentPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [lang, setLang] = useState<"en" | "ko">("en");
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = QUESTIONS.length;

  const currentQ = QUESTIONS[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const canGoNext = currentAnswer !== undefined;
  const isLast = currentIndex === total - 1;

  const onPick = (id: string, v: Likert) => setAnswers((prev) => ({ ...prev, [id]: v }));

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function goNext() {
    if (!canGoNext) return;
    if (isLast) {
      const final = { ...answers, [currentQ.id]: currentAnswer };
      const result = scoreAssessment(QUESTIONS, final);
      saveResult(result);
      router.push("/assessment/result");
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  const prevLabel = lang === "en" ? "Previous" : "이전";
  const nextLabel = lang === "en" ? "Next" : "다음";
  const seeResultLabel = lang === "en" ? "See result" : "결과 보기";
  const progressLabel = lang === "en" ? "Progress" : "진행";
  const hintLabel =
    lang === "en"
      ? "Pick the option that feels closest. There are no wrong answers."
      : "맞는 말에 가깝다고 느끼는 칸을 골라 주세요. 정답은 없어요.";

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)]">
          {lang === "en" ? "Self-Esteem Assessment (50)" : "Today-Me 자가 진단 (50문항)"}
        </h1>
        <button
          type="button"
          className="text-sm underline text-[var(--arena-text-soft)] hover:text-[var(--arena-text)]"
          onClick={() => setLang((l) => (l === "en" ? "ko" : "en"))}
        >
          {lang === "en" ? "한국어" : "English"}
        </button>
      </div>

      <div className="text-sm text-[var(--arena-text-soft)] mb-2" aria-live="polite">
        {progressLabel} {currentIndex + 1} / {total}
      </div>
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

      {/* §7: 한 문항씩 노출 — 정성 플로우 */}
      <div className="rounded-2xl border border-[var(--arena-text-soft)]/20 bg-white p-6 sm:p-8 shadow-sm">
        <p className="text-sm text-[var(--arena-text-soft)] mb-2">
          {lang === "en" ? `Question ${currentIndex + 1}` : `문항 ${currentIndex + 1}`}
        </p>
        <p className="text-lg sm:text-xl font-medium text-[var(--arena-text)] mb-6 leading-snug">
          {lang === "en" ? currentQ.text_en : currentQ.text_ko}
        </p>
        <p className="text-sm text-[var(--arena-text-soft)] mb-4">{hintLabel}</p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {LIKERT.map((opt) => {
            const active = currentAnswer === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => onPick(currentQ.id, opt.v)}
                className={
                  "rounded-xl px-3 py-3 sm:py-4 text-sm font-medium border-2 transition-colors " +
                  (active
                    ? "border-[var(--arena-accent)] bg-[var(--arena-accent)]/10 text-[var(--arena-text)]"
                    : "border-[var(--arena-text-soft)]/30 text-[var(--arena-text-soft)] hover:border-[var(--arena-accent)]/50 hover:text-[var(--arena-text)]")
                }
              >
                {lang === "en" ? opt.label_en : opt.label_ko}
              </button>
            );
          })}
        </div>
      </div>

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
        {lang === "en"
          ? "This is not a grade. It's an energy map."
          : "이건 성적표가 아니라 에너지 지도예요."}
      </p>
    </div>
  );
}
