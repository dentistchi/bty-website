"use client";

import questions from "@/content/assessment/questions.ko.json";
import { detectPattern, scoreAnswers } from "@/lib/assessment/score";
import { useMemo } from "react";
import Link from "next/link";

export default function ResultClient() {
  const computed = useMemo(() => {
    const raw = sessionStorage.getItem("assessment.answers.v1");
    if (!raw) return null;
    const answers = JSON.parse(raw) as Record<number, number>;
    const scores = scoreAnswers(questions as any, answers);
    const pattern = detectPattern(scores);
    return { scores, pattern };
  }, []);

  if (!computed) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-2">결과를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-600 mb-6">문항 페이지에서 먼저 답변을 완료해 주세요.</p>
        <Link className="underline" href="../assessment">진단하러 가기</Link>
      </div>
    );
  }

  const { scores, pattern } = computed;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-2">결과 요약</h1>
      <p className="text-sm text-gray-600 mb-6">
        점수는 &quot;평가&quot;가 아니라 현재 에너지 지도를 보여주는 지표입니다.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {Object.entries(scores).map(([k, v]) => (
          <div key={k} className="border rounded-xl p-4 bg-white">
            <div className="text-sm text-gray-500 mb-1">{k}</div>
            <div className="text-3xl font-semibold">{v}</div>
            <div className="h-2 bg-gray-200 rounded mt-3 overflow-hidden">
              <div className="h-2 bg-black" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border rounded-2xl p-5 bg-white">
        <div className="text-sm text-gray-500 mb-1">권장 트랙</div>
        <div className="text-xl font-semibold mb-2">{pattern.track}</div>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          {pattern.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      <div className="mt-8 flex gap-3">
        {/* 28일 프로그램 시작 버튼: 지금 existing route에 맞춰서 바꿔주면 됨 */}
        <Link href="/train/day/1" className="px-5 py-2 rounded-lg bg-black text-white">
          28일 프로그램 시작
        </Link>
        <Link href="../assessment" className="px-5 py-2 rounded-lg border">
          다시 검사하기
        </Link>
      </div>
    </div>
  );
}
