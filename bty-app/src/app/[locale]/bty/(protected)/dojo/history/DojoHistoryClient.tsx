"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CardSkeleton, EmptyState } from "@/components/bty-arena";
import type { DojoSubmissionRow, DojoSubmissionsResponse } from "@/lib/bty/foundry/dojoSubmitService";

const SUMMARY_LABELS_KO: Record<string, string> = {
  high: "우수",
  mid: "발전 중",
  low: "집중 필요",
};
const SUMMARY_LABELS_EN: Record<string, string> = {
  high: "Strong",
  mid: "Developing",
  low: "Needs focus",
};

export default function DojoHistoryClient({ locale = "ko" }: { locale?: string }) {
  const isEn = locale === "en";
  const [submissions, setSubmissions] = useState<DojoSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dojo/submissions", { credentials: "include" })
      .then((res) => res.json())
      .then((data: DojoSubmissionsResponse | { error: string }) => {
        if (cancelled) return;
        if ("error" in data && data.error) {
          setError(data.error);
          return;
        }
        setSubmissions("submissions" in data ? (data.submissions ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setError(isEn ? "Failed to load." : "불러오지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isEn]);

  const summaryLabels = isEn ? SUMMARY_LABELS_EN : SUMMARY_LABELS_KO;

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString(
      isEn ? "en-US" : "ko-KR",
      { year: "numeric", month: "short", day: "numeric" },
    );
  }

  const title = isEn ? "Past Dojo results" : "과거 진단 이력";
  const backLabel = isEn ? "Back to result" : "결과로 돌아가기";

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10" role="main" aria-labelledby="dojo-history-heading">
        <h1 id="dojo-history-heading" className="text-2xl font-semibold mb-4">{title}</h1>
        <div aria-busy="true" aria-label={isEn ? "Loading…" : "불러오는 중…"}>
          <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
          <div className="mt-3">
            <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
          </div>
        </div>
        <div className="mt-6">
          <Link href="../result" className="text-sm underline text-gray-600 hover:text-gray-900" aria-label={backLabel}>
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10" role="main" aria-labelledby="dojo-history-heading">
        <h1 id="dojo-history-heading" className="text-2xl font-semibold mb-4">{title}</h1>
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
        <Link href="../result" className="text-sm underline text-gray-600 hover:text-gray-900" aria-label={backLabel}>
          {backLabel}
        </Link>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10" role="main" aria-labelledby="dojo-history-heading">
        <h1 id="dojo-history-heading" className="text-2xl font-semibold mb-4">{title}</h1>
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
          <EmptyState
            icon="📋"
            message={isEn ? "No past results yet." : "아직 과거 진단 이력이 없어요."}
            hint={isEn ? "Complete the 50-item assessment to see results here." : "50문항 진단을 완료하면 여기에 표시돼요."}
            cta={
              <Link href="../dojo" className="text-sm font-medium text-indigo-600 hover:underline" aria-label={isEn ? "Go to assessment" : "진단하러 가기"}>
                {isEn ? "Go to assessment" : "진단하러 가기"}
              </Link>
            }
          />
        </div>
        <div className="mt-6">
          <Link href="../result" className="text-sm underline text-gray-600 hover:text-gray-900" aria-label={backLabel}>
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const retakeLabel = isEn ? "Retake" : "다시 진단하기";

  return (
    <div className="max-w-xl mx-auto px-6 py-10" role="main" aria-labelledby="dojo-history-heading">
      <h1 id="dojo-history-heading" className="text-2xl font-semibold mb-4">{title}</h1>
      <ul className="list-none p-0 m-0 space-y-3" role="list" aria-label={title}>
        {submissions.map((row) => {
          const label = summaryLabels[row.summary_key] ?? row.summary_key;
          const avg =
            row.scores_json && typeof row.scores_json === "object"
              ? Math.round(
                  Object.values(row.scores_json).reduce((a, b) => a + b, 0) /
                    Object.keys(row.scores_json).length,
                )
              : null;
          return (
            <li
              key={row.id}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              aria-label={isEn ? `Result ${fmtDate(row.created_at)}, ${label}` : `결과 ${fmtDate(row.created_at)}, ${label}`}
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-xs text-gray-500 shrink-0">{fmtDate(row.created_at)}</span>
              </div>
              {avg !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  {isEn ? `Average score: ${avg}` : `평균 점수: ${avg}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex gap-4">
        <Link href="../result" className="text-sm underline text-gray-600 hover:text-gray-900" aria-label={backLabel}>
          {backLabel}
        </Link>
        <Link href="../dojo" className="text-sm underline text-gray-600 hover:text-gray-900" aria-label={retakeLabel}>
          {retakeLabel}
        </Link>
      </div>
    </div>
  );
}
