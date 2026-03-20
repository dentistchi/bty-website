"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CardSkeleton } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";

type DojoApiResult = {
  submissionId?: string | null;
  scores: Record<string, number>;
  summaryKey: string;
  mentorComment?: string;
};

function isDojoResult(v: unknown): v is DojoApiResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "scores" in v &&
    typeof (v as DojoApiResult).scores === "object" &&
    typeof (v as DojoApiResult).summaryKey === "string"
  );
}

const DIMENSION_LABELS_KO: Record<string, string> = {
  perspective_taking: "역지사지",
  communication: "소통·경청",
  leadership: "리더십·책임",
  conflict: "갈등·협상",
  teamwork: "팀·협업",
};

const DIMENSION_LABELS_EN: Record<string, string> = {
  perspective_taking: "Perspective-taking",
  communication: "Communication & listening",
  leadership: "Leadership & responsibility",
  conflict: "Conflict & negotiation",
  teamwork: "Teamwork & collaboration",
};

const MSG = {
  ko: {
    loading: "결과 불러오는 중…",
    noResult: "결과를 찾을 수 없습니다",
    noResultHint: "50문항을 먼저 완료해 주세요.",
    error: "결과를 불러오지 못했어요.",
    errorHint: "다시 진단을 진행해 주세요.",
    goToAssessment: "진단하러 가기",
    retry: "다시 진단하기",
  },
  en: {
    loading: "Loading result…",
    noResult: "No result found",
    noResultHint: "Please complete the 50 questions first.",
    error: "Failed to load result.",
    errorHint: "Please try the assessment again.",
    goToAssessment: "Go to assessment",
    retry: "Retake assessment",
  },
} as const;

export default function DojoResultClient({ locale = "ko" }: { locale?: string }) {
  const isEn = locale === "en";
  const dimLabels = isEn ? DIMENSION_LABELS_EN : DIMENSION_LABELS_KO;
  const t = isEn ? MSG.en : MSG.ko;
  const dojoT = getMessages(locale === "ko" ? "ko" : "en").dojoResult;

  const [result, setResult] = useState<DojoApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const raw = sessionStorage.getItem("dojo.result.v1");
    if (!raw) {
      if (!cancelled) setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!cancelled) {
        if (isDojoResult(parsed)) {
          setResult(parsed);
        } else {
          setError(true);
        }
        setLoading(false);
      }
    } catch {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="max-w-3xl mx-auto px-6 py-10"
        role="region"
        aria-busy="true"
        aria-label={t.loading}
      >
        <div className="mb-6">
          <CardSkeleton showLabel={true} lines={1} style={{ padding: "16px 20px", marginBottom: 12 }} />
          <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
        </div>
        <div className="space-y-4 mt-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "10px 20px", width: 120 }} />
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "10px 20px", width: 120 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10" role="alert">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">{t.error}</h1>
        <p className="text-sm text-gray-600 mb-6">{t.errorHint}</p>
        <Link
          href="../dojo"
          className="inline-block px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label={t.retry}
        >
          {t.retry}
        </Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10" role="region" aria-label={isEn ? "No result" : "결과 없음"}>
        <h1 className="text-2xl font-semibold mb-2">{t.noResult}</h1>
        <p className="text-sm text-gray-600 mb-6">{t.noResultHint}</p>
        <Link
          href="../dojo"
          className="inline-block px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label={t.goToAssessment}
        >
          {t.goToAssessment}
        </Link>
      </div>
    );
  }

  const { scores, summaryKey, mentorComment } = result;
  const scoreEntries = Object.entries(scores);

  const barColor = (v: number) =>
    v >= 70 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e";

  const summaryStyle: Record<string, { bg: string; border: string; badge: string; badgeText: string }> = {
    high:  { bg: "bg-green-50",  border: "border-green-200",  badge: "bg-green-100 text-green-800",  badgeText: isEn ? "Strong" : "우수" },
    mid:   { bg: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-800",  badgeText: isEn ? "Developing" : "발전 중" },
    low:   { bg: "bg-rose-50",   border: "border-rose-200",   badge: "bg-rose-100  text-rose-800",   badgeText: isEn ? "Needs focus" : "집중 필요" },
  };
  const sm = summaryStyle[summaryKey] ?? { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-700", badgeText: "" };

  return (
    <div
      className="max-w-3xl mx-auto px-6 py-10"
      role="region"
      aria-label={dojoT.dojoResultMainRegionAria}
    >
      <h1 id="dojo-result-heading" className="text-2xl font-semibold mb-2">
        {isEn ? "Dojo 50-Item Result" : "Dojo 역량 진단 결과"}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        {isEn
          ? "Scores are not grades — they show your current skill map."
          : "점수는 평가가 아니라 현재 역량 지도를 보여주는 지표입니다."}
      </p>

      {sm.badgeText && (
        <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full mb-6 ${sm.badge}`}>
          {sm.badgeText}
        </span>
      )}

      <section className="space-y-6" aria-label={dojoT.resultScoresInsightRegionAria}>
      <div className="space-y-4" role="group" aria-label={isEn ? "Score chart" : "점수 차트"}>
        {scoreEntries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-24 sm:w-32 text-sm text-gray-600 text-right shrink-0 truncate">
              {dimLabels[key] || key}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(value, 100)}%`, backgroundColor: barColor(value) }}
              />
            </div>
            <div className="w-10 text-right text-sm font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {mentorComment && (
        <div className={`rounded-2xl border p-5 ${sm.bg} ${sm.border}`} role="region" aria-label={isEn ? "Dr. Chi comment" : "Dr. Chi 코멘트"}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0" aria-hidden="true">🧑‍⚕️</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {isEn ? "Dr. Chi Comment" : "Dr. Chi 코멘트"}
              </div>
              <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap m-0">
                {mentorComment}
              </p>
            </div>
          </div>
        </div>
      )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3" role="group" aria-label={dojoT.resultActionsLabel}>
        <Link href="../dojo" className="px-5 py-2 rounded-lg border text-sm hover:bg-gray-50 transition-colors" aria-label={isEn ? "Retake assessment" : "다시 진단하기"}>
          {isEn ? "Retake" : "다시 진단하기"}
        </Link>
        <Link href="../history" className="px-5 py-2 rounded-lg border text-sm hover:bg-gray-50 transition-colors" aria-label={isEn ? "View past assessments" : "과거 진단 보기"}>
          {isEn ? "View past results" : "과거 진단 보기"}
        </Link>
      </div>
    </div>
  );
}
