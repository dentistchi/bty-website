"use client";

import { useMemo, useState } from "react";
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

export default function AssessmentPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [lang, setLang] = useState<"en" | "ko">("en");
  const total = QUESTIONS.length;

  const completed = useMemo(() => Object.keys(answers).length, [answers]);
  const canSubmit = total > 0 && completed === total;

  const onPick = (id: string, v: Likert) => setAnswers((prev) => ({ ...prev, [id]: v }));

  const onSubmit = () => {
    if (!canSubmit) return;
    const result = scoreAssessment(QUESTIONS, answers);
    saveResult(result);
    router.push("/assessment/result");
  };

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">
          {lang === "en" ? "Self-Esteem Assessment (50)" : "자존감 진단 테스트 (50문항)"}
        </h1>
        <button
          className="text-sm underline"
          onClick={() => setLang((l) => (l === "en" ? "ko" : "en"))}
        >
          {lang === "en" ? "한국어" : "English"}
        </button>
      </div>

      <div className="text-sm text-gray-600 mb-6">
        {lang === "en" ? `Progress: ${completed}/${total}` : `진행: ${completed}/${total}`}
      </div>

      <div className="space-y-6">
        {QUESTIONS.map((q, idx) => (
          <div key={q.id} className="border rounded-2xl p-4">
            <div className="text-sm text-gray-500 mb-1">
              {idx + 1} / {total}
            </div>
            <div className="font-medium mb-3">{lang === "en" ? q.text_en : q.text_ko}</div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {LIKERT.map((opt) => {
                const active = answers[q.id] === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => onPick(q.id, opt.v)}
                    className={
                      "border rounded-xl px-3 py-2 text-sm " +
                      (active ? "bg-black text-white" : "bg-white")
                    }
                  >
                    {lang === "en" ? opt.label_en : opt.label_ko}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {lang === "en"
            ? "This is not a grade. It's an energy map."
            : "이건 성적표가 아니라 에너지 지도예요."}
        </div>
        <button
          disabled={!canSubmit}
          onClick={onSubmit}
          className="rounded-xl px-5 py-2 bg-black text-white disabled:opacity-50"
        >
          {lang === "en" ? "See result" : "결과 보기"}
        </button>
      </div>
    </div>
  );
}
