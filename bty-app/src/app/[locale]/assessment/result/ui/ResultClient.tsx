"use client";

import questionsKo from "@/content/assessment/questions.ko.json";
import questionsEn from "@/content/assessment/questions.en.json";
import { detectPattern, scoreAnswers } from "@/lib/assessment/score";
import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CardSkeleton, EmptyState } from "@/components/bty-arena";
import HubTopNav from "@/components/bty/HubTopNav";
import { getMessages, type Locale } from "@/lib/i18n";

type ApiResult = {
  submissionId?: string | null;
  scores: Record<string, number>;
  pattern: string;
  recommendedTrack: string;
};

type SubmissionHistoryItem = {
  id: string;
  scores: Record<string, number> | null;
  pattern: string | null;
  track: string | null;
  createdAt: string;
};

/** Pure-SVG radar (spider) chart. No external libs. */
function RadarChart({
  scores,
  prevScores,
  labels,
  isEn,
}: {
  scores: Record<string, number>;
  prevScores?: Record<string, number> | null;
  labels: Record<string, string>;
  isEn: boolean;
}) {
  const keys = Object.keys(scores);
  const n = keys.length;
  if (n < 3) return null;

  const W = 500, H = 420, cx = 250, cy = 210, R = 120;
  const step = (2 * Math.PI) / n;

  const pt = (i: number, pct: number): [number, number] => {
    const a = step * i - Math.PI / 2;
    const r = (Math.min(Math.max(pct, 0), 100) / 100) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const poly = (s: Record<string, number>) =>
    keys.map((k, i) => pt(i, s[k] ?? 0).join(",")).join(" ");

  return (
    <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%" }}
        role="img"
        aria-label={isEn ? "Score radar chart" : "점수 레이더 차트"}
      >
        {/* guide rings */}
        {[25, 50, 75, 100].map((pct) => (
          <polygon
            key={pct}
            points={keys.map((_, i) => pt(i, pct).join(",")).join(" ")}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={pct === 100 ? 1.2 : 0.6}
          />
        ))}

        {/* axes */}
        {keys.map((_, i) => {
          const [x2, y2] = pt(i, 100);
          return (
            <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth={0.6} />
          );
        })}

        {/* previous polygon (comparison) */}
        {prevScores && (
          <polygon
            points={poly(prevScores)}
            fill="rgba(156,163,175,0.12)"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
        )}

        {/* current polygon */}
        <polygon
          points={poly(scores)}
          fill="rgba(59,130,246,0.18)"
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* dots */}
        {keys.map((k, i) => {
          const [px, py] = pt(i, scores[k] ?? 0);
          return <circle key={k} cx={px} cy={py} r={3} fill="#3b82f6" />;
        })}

        {/* labels */}
        {keys.map((k, i) => {
          const a = step * i - Math.PI / 2;
          const lr = R + 30;
          const lx = cx + lr * Math.cos(a);
          const ly = cy + lr * Math.sin(a);
          const anchor =
            Math.abs(Math.cos(a)) < 0.15
              ? "middle"
              : Math.cos(a) > 0
                ? "start"
                : "end";
          return (
            <text
              key={k}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize={11}
              fill="#4b5563"
            >
              {labels[k] ?? k}
            </text>
          );
        })}
      </svg>

      {/* legend (shown only when comparison is active) */}
      {prevScores && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 20,
            marginTop: 4,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={4}>
              <line x1={0} y1={2} x2={20} y2={2} stroke="#3b82f6" strokeWidth={2} />
            </svg>
            {isEn ? "Current" : "현재"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={4}>
              <line
                x1={0}
                y1={2}
                x2={20}
                y2={2}
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            </svg>
            {isEn ? "Previous" : "이전"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ResultClient({ locale = "ko" }: { locale?: string }) {
  const isEn = locale === "en";

  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/assessment/submissions", { credentials: "include" });
      const data: { submissions?: SubmissionHistoryItem[]; error?: string } = await res.json().catch(() => ({}));
      if (data.error) { setHistoryError(data.error); return; }
      setHistory(data.submissions ?? []);
    } catch {
      setHistoryError(isEn ? "Failed to load history." : "이력을 불러올 수 없어요.");
    } finally {
      setHistoryLoading(false);
    }
  }, [isEn]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const computed = useMemo(() => {
    const questionBank = (isEn ? questionsEn : questionsKo) as Parameters<typeof scoreAnswers>[0];

    const apiRaw = sessionStorage.getItem("assessment.result.v1");
    if (apiRaw) {
      try {
        const api = JSON.parse(apiRaw) as ApiResult;
        if (api.scores && api.pattern) {
          return {
            scores: api.scores,
            pattern: { track: api.recommendedTrack, reasons: [] as string[] },
            fromApi: true,
          };
        }
      } catch { /* fallback below */ }
    }

    const raw = sessionStorage.getItem("assessment.answers.v1");
    if (!raw) return null;
    const answers = JSON.parse(raw) as Record<number, number>;
    const scores = scoreAnswers(questionBank, answers);
    const pattern = detectPattern(scores);
    return { scores, pattern, fromApi: false };
  }, [isEn]);

  if (!computed) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10" role="main" aria-labelledby="assessment-no-result-heading">
        <div className="mb-6">
          <HubTopNav theme="dear" showLangSwitch />
        </div>
        <h1 id="assessment-no-result-heading" className="text-2xl font-semibold mb-2">
          {isEn ? "No result found" : "결과를 찾을 수 없습니다"}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {isEn ? "Please complete the questions first." : "문항 페이지에서 먼저 답변을 완료해 주세요."}
        </p>
        <Link className="underline" href="../assessment" aria-label={isEn ? "Go to assessment" : "진단하러 가기"}>
          {isEn ? "Go to assessment" : "진단하러 가기"}
        </Link>
      </div>
    );
  }

  const { scores, pattern } = computed;
  const loc = (isEn ? "en" : "ko") as Locale;
  const dojoT = getMessages(loc).dojoResult;
  const tAR = getMessages(loc).assessmentResult;
  const dimLabels = dojoT.dimensionLabels;
  const prevScores =
    !historyLoading && history.length >= 2 && history[1]?.scores
      ? history[1].scores
      : null;

  return (
    <div
      className="max-w-3xl mx-auto px-6 py-10"
      role="main"
      aria-labelledby="assessment-result-heading"
    >
      <div className="mb-6">
        <HubTopNav theme="dear" showLangSwitch />
      </div>
      <h1 id="assessment-result-heading" className="text-2xl font-semibold mb-2">
        {isEn ? "Result summary" : "결과 요약"}
      </h1>
      <p className="text-sm text-gray-600 mb-6" role="note" aria-label={isEn ? "Result note" : "결과 안내"}>
        {isEn
          ? 'Scores are not a "grade" — they show your current energy map.'
          : "점수는 \"평가\"가 아니라 현재 에너지 지도를 보여주는 지표입니다."}
      </p>

      <section className="space-y-6" aria-label={tAR.mainContentRegionAria}>
      <div
        className="grid sm:grid-cols-2 gap-4"
        role="group"
        aria-label={isEn ? "Dimension scores" : "영역별 점수"}
      >
        {Object.entries(scores).map(([k, v]) => (
          <div key={k} className="border rounded-xl p-4 bg-white">
            <div className="text-sm text-gray-500 mb-1">{dimLabels[k] ?? k}</div>
            <div className="text-3xl font-semibold">{v}</div>
            <div className="h-2 bg-gray-200 rounded mt-3 overflow-hidden">
              <div className="h-2 bg-black" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── 레이더 차트 + 비교 ── */}
      <section className="mt-8" aria-labelledby="radar-heading">
        <h2 id="radar-heading" className="text-lg font-semibold mb-3">
          {isEn ? "Score overview" : "점수 한눈에 보기"}
        </h2>
        <RadarChart
          scores={scores}
          prevScores={prevScores}
          labels={dimLabels}
          isEn={isEn}
        />

        {prevScores && (
          <div className="mt-5" role="group" aria-label={isEn ? "Change from previous" : "이전 대비 변화"}>
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              {isEn ? "Change from previous" : "이전 대비 변화"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(scores).map(([k, v]) => {
                const curr = v;
                const prev = prevScores[k] ?? 0;
                const diff = curr - prev;
                return (
                  <div key={k} className="rounded-lg border p-2 bg-white text-center">
                    <div className="text-xs text-gray-500 truncate">{dimLabels[k] ?? k}</div>
                    <div className="text-sm font-semibold">{curr}</div>
                    <div
                      className={`text-xs font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}
                    >
                      {diff > 0 ? `+${diff}` : diff === 0 ? "—" : String(diff)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div
        className="mt-6 border rounded-2xl p-5 bg-white"
        role="region"
        aria-label={isEn ? "Recommended track" : "권장 트랙"}
      >
        <div className="text-sm text-gray-500 mb-1">{isEn ? "Recommended track" : "권장 트랙"}</div>
        <div className="text-xl font-semibold mb-2">{pattern.track}</div>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1" aria-label={isEn ? "Reasons" : "이유"}>
          {pattern.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>
      </section>

      <h2 id="assessment-result-cta-heading" className="sr-only">
        {tAR.ctaSrOnlyHeading}
      </h2>
      <div
        className="mt-8 flex flex-wrap gap-3"
        role="group"
        aria-labelledby="assessment-result-cta-heading"
        aria-label={tAR.nextStepsCtaGroupAria}
      >
        <Link
          href={`/${loc}/train/day/1`}
          className="px-5 py-2 rounded-lg bg-black text-white"
          aria-label={tAR.start28ProgramCta}
        >
          {tAR.start28ProgramCta}
        </Link>
        <Link
          href="../assessment"
          className="px-5 py-2 rounded-lg border"
          aria-label={tAR.retakeCta}
        >
          {tAR.retakeCta}
        </Link>
      </div>

      {/* ── 이전 진단 이력 ── */}
      <section className="mt-14" aria-labelledby="assessment-history-heading">
        <h2 id="assessment-history-heading" className="text-lg font-semibold mb-4">
          {isEn ? "Previous assessments" : "이전 진단 이력"}
        </h2>

        {historyLoading && (
          <div aria-busy="true" aria-label={isEn ? "Loading history…" : "이력을 불러오는 중…"}>
            <CardSkeleton showLabel={false} lines={3} style={{ padding: "16px 20px" }} />
          </div>
        )}

        {historyError && (
          <p className="text-red-600 text-sm" role="alert">
            {isEn ? "Failed to load history." : "이력을 불러올 수 없어요."}
          </p>
        )}

        {!historyLoading && !historyError && history.length === 0 && (
          <EmptyState
            icon="📋"
            message={isEn ? "No previous assessments yet." : "아직 진단 이력이 없어요."}
            style={{ padding: "24px 16px" }}
          />
        )}

        {!historyLoading && !historyError && history.length > 0 && (
          <ul className="space-y-3" role="list" aria-label={isEn ? "Previous assessment results" : "이전 진단 결과 목록"}>
            {history.map((item) => {
              const date = new Date(item.createdAt);
              const dateStr = date.toLocaleDateString(isEn ? "en-US" : "ko-KR", {
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <li key={item.id} className="border rounded-xl p-4 bg-white" aria-label={isEn ? `Assessment ${dateStr}${item.track ? `, ${item.track}` : ""}` : `진단 ${dateStr}${item.track ? `, ${item.track}` : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <time className="text-xs text-gray-500" dateTime={item.createdAt}>
                      {dateStr}
                    </time>
                    {item.track && (
                      <span className="text-xs font-medium text-gray-700">
                        {isEn ? "Track" : "트랙"}: {item.track}
                      </span>
                    )}
                  </div>
                  {item.pattern && (
                    <p className="text-sm text-gray-800 font-medium m-0">
                      {isEn ? "Pattern" : "패턴"}: {item.pattern}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
