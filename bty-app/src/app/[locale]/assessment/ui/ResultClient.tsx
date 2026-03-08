"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CardSkeleton } from "@/components/bty-arena";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/** API 응답 계약(UI 기대). API가 scores+mentorComment 또는 areaScores+drChiComment 반환. */
type AreaScore = { dimension: string; label?: string; score: number };
type DojoSubmitResponse = {
  areaScores?: AreaScore[];
  drChiComment?: string;
  /** API 실제 반환: 영역별 점수(Dojo 50 영역 ID). */
  scores?: Record<string, number>;
  mentorComment?: string;
  error?: string;
};

const STORAGE_KEY = "assessment.answers.v1";

/**
 * Dojo 50문항 결과 화면. 영역별 점수·Dr. Chi 코멘트 표시.
 * Render-only: sessionStorage answers → POST /api/dojo/submit → 응답 그대로 표시.
 */
export default function ResultClient({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).dojoResult;
  const [answers, setAnswers] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DojoSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : null;
    setAnswers(parsed);

    if (!parsed || Object.keys(parsed).length === 0) {
      setLoading(false);
      return;
    }

    const numeric: Record<number, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (!Number.isNaN(id) && typeof v === "number") numeric[id] = v;
    }

    fetch("/api/dojo/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: numeric }),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((body: DojoSubmitResponse) => {
        setData(body);
        if (body.error) setError(body.error);
      })
      .catch(() => setError(t.apiError))
      .finally(() => setLoading(false));
  }, [t.apiError]);

  if (loading) {
    return (
      <div
        className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
        aria-busy="true"
        aria-label={lang === "ko" ? "결과 불러오는 중" : "Loading result"}
      >
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)] mb-4">{t.title}</h1>
        <p className="text-[var(--arena-text-soft)] mb-4" aria-live="polite">
          {t.loading}
        </p>
        <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
      </div>
    );
  }

  if (!answers || Object.keys(answers).length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)] mb-4">{t.title}</h1>
        <p className="text-[var(--arena-text-soft)] mb-6">{t.noAnswers}</p>
        <Link
          href="../assessment"
          className="inline-block rounded-xl px-5 py-2.5 font-medium bg-[var(--arena-accent)] text-white hover:opacity-90"
        >
          {t.backToAssessment}
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)] mb-4">{t.title}</h1>
        <p className="text-red-600 mb-6">{error}</p>
        <Link
          href="../assessment"
          className="inline-block rounded-xl px-5 py-2.5 border border-[var(--arena-text-soft)]/40 text-[var(--arena-text)]"
        >
          {t.backToAssessment}
        </Link>
      </div>
    );
  }

  const areaScores: AreaScore[] =
    data?.areaScores?.length
      ? data.areaScores
      : data?.scores
        ? Object.entries(data.scores).map(([dimension, score]) => ({
            dimension,
            score: Number(score),
            label: t.dimensionLabels[dimension],
          }))
        : [];
  const drChiComment = data?.drChiComment ?? data?.mentorComment ?? "";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-xl sm:text-2xl font-semibold text-[var(--arena-text)] mb-6">{t.title}</h1>

      {areaScores.length > 0 && (
        <section className="mb-8" aria-labelledby="area-scores-heading">
          <h2 id="area-scores-heading" className="text-lg font-medium text-[var(--arena-text)] mb-3">
            {t.areaScoresTitle}
          </h2>
          <ul className="rounded-2xl border border-[var(--arena-text-soft)]/20 bg-white p-4 sm:p-6 shadow-sm space-y-3">
            {areaScores.map((item, i) => (
              <li
                key={item.dimension ?? i}
                className="flex items-center justify-between gap-4 py-2 border-b border-[var(--arena-text-soft)]/10 last:border-0"
              >
                <span className="text-[var(--arena-text)]">
                  {item.label ?? t.dimensionLabels[item.dimension] ?? item.dimension}
                </span>
                <span className="font-medium text-[var(--arena-accent)]" aria-label={`${item.score}`}>
                  {item.score}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drChiComment && (
        <section className="mb-8" aria-labelledby="drchi-comment-heading">
          <h2 id="drchi-comment-heading" className="text-lg font-medium text-[var(--arena-text)] mb-3">
            {t.drChiCommentTitle}
          </h2>
          <div className="rounded-2xl border border-[var(--arena-text-soft)]/20 bg-white p-4 sm:p-6 shadow-sm">
            <p className="text-[var(--arena-text)] leading-relaxed whitespace-pre-wrap">{drChiComment}</p>
          </div>
        </section>
      )}

      {areaScores.length === 0 && !drChiComment && data && !data.error && (
        <p className="text-[var(--arena-text-soft)] mb-6">
          {lang === "ko" ? "아직 결과가 반환되지 않았어요. API 구현 후 표시됩니다." : "Result will appear here once the API is ready."}
        </p>
      )}

      <Link
        href="../assessment"
        className="inline-block rounded-xl px-5 py-2.5 border border-[var(--arena-text-soft)]/40 text-[var(--arena-text)] hover:bg-[var(--arena-text-soft)]/5"
      >
        {t.backToAssessment}
      </Link>
    </div>
  );
}
