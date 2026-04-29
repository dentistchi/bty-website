"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadResult } from "@/lib/assessment/storage";

export default function AssessmentResultPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ko">("en");
  const r = useMemo(() => loadResult(), []);

  if (!r) {
    return (
      <div className="min-h-screen p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold mb-2">
          {lang === "en" ? "No result found" : "저장된 결과가 없어요"}
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          {lang === "en" ? "Please take the assessment first." : "먼저 진단을 진행해 주세요."}
        </p>
        <button
          className="rounded-xl px-4 py-2 bg-black text-white"
          onClick={() => router.push("/assessment")}
        >
          {lang === "en" ? "Go to assessment" : "진단하러 가기"}
        </button>
      </div>
    );
  }

  const title = lang === "en" ? r.summaryTitle_en : r.summaryTitle_ko;
  const body = lang === "en" ? r.summaryBody_en : r.summaryBody_ko;

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-end mb-4">
        <button
          className="text-sm underline"
          onClick={() => setLang((l) => (l === "en" ? "ko" : "en"))}
        >
          {lang === "en" ? "한국어" : "English"}
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-sm text-gray-700 whitespace-pre-line mb-6">{body}</p>

      <div className="border rounded-2xl p-4 mb-6">
        <div className="font-semibold mb-2">
          {lang === "en" ? "Scores (0–100)" : "점수 (0–100)"}
        </div>
        <ul className="text-sm space-y-1">
          <li>
            {lang === "en" ? "Core Self-Esteem" : "핵심 자존감"}: {r.scores.core_self_esteem}
          </li>
          <li>
            {lang === "en" ? "Self-Compassion" : "자기자비"}: {r.scores.self_compassion}
          </li>
          <li>
            {lang === "en" ? "Stability" : "안정성"}: {r.scores.self_esteem_stability}
          </li>
          <li>
            {lang === "en" ? "Growth Mindset" : "성장 마인드셋"}: {r.scores.growth_mindset}
          </li>
          <li>
            {lang === "en" ? "Social Self-Esteem" : "사회적 자존감"}: {r.scores.social_self_esteem}
          </li>
        </ul>
      </div>

      <div className="border rounded-2xl p-4 mb-6">
        <div className="font-semibold mb-1">
          {lang === "en" ? "Recommended Track" : "추천 트랙"}
        </div>
        <div className="text-sm text-gray-700">{r.recommendedTrack}</div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/en/train/start"
          className="rounded-xl px-5 py-2 bg-black text-white inline-block"
        >
          {lang === "en" ? "Start 28-Day Journey" : "28일 여정 시작하기"}
        </Link>
        <button
          type="button"
          className="rounded-xl px-5 py-2 border"
          onClick={() => router.push("/assessment")}
        >
          {lang === "en" ? "Retake" : "다시 하기"}
        </button>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        {lang === "en"
          ? "Next: we can add the pentagonal radar chart (Recharts) without touching auth."
          : "다음: 인증 없이 오각형 레이더 차트(Recharts)를 추가할 수 있어요."}
      </div>
    </div>
  );
}
