"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Dimension = "core" | "compassion" | "stability" | "growth" | "social";
type Question = { id: number; dimension: Dimension; text: string; reverse: boolean };

export default function AssessmentClient({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, number>>({}); // id -> 1..5
  const total = questions.length;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const canSubmit = answeredCount === total;

  function setAnswer(id: number, v: number) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  function onSubmit() {
    if (!canSubmit) return;
    // 결과 페이지로 answers를 넘기는 가장 단순한 방식: sessionStorage (서버 영향 없음)
    sessionStorage.setItem("assessment.answers.v1", JSON.stringify(answers));
    router.push("./result");
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-2">Today-Me 자가 진단 (50문항)</h1>
      <p className="text-sm text-gray-600 mb-6">
        각 문항을 1~5로 선택해 주세요. (1 거의 그렇지 않다 · 5 매우 그렇다) — {answeredCount}/{total}
      </p>

      <div className="space-y-6">
        {questions.map((q) => (
          <div key={q.id} className="border rounded-xl p-4 bg-white">
            <div className="text-sm text-gray-500 mb-1">Q{q.id} · {q.dimension}</div>
            <div className="text-base mb-3">{q.text}</div>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAnswer(q.id, v)}
                  className={`px-3 py-2 rounded-lg border ${
                    answers[q.id] === v ? "bg-black text-white" : "bg-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {canSubmit ? "완료되었습니다. 결과를 확인하세요." : "모든 문항에 답해야 결과를 볼 수 있어요."}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="px-5 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          결과 보기
        </button>
      </div>
    </div>
  );
}
