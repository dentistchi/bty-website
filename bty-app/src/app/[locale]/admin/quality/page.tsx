"use client";

import { useState, useEffect, useCallback } from "react";

import { useParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { LoadingFallback } from "@/components/bty-arena";

type Severity = { low: number; medium: number; high: number };
type BreakdownItem = { key: string; count: number };
type QualitySummary = {
  window: string;
  top_signatures: string[];
  issue_frequencies: BreakdownItem[];
  severity: Severity;
  avg_css: number | null;
  total_events: number;
  breakdown: { role: BreakdownItem[]; route: BreakdownItem[]; intent: BreakdownItem[] };
  error?: string;
};
type QualityHealth = {
  db_ok: boolean;
  total_events_30d: number;
  latest_event_at: string | null;
  error?: string;
};

function SeverityBadge({ level, count }: { level: string; count: number }) {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    low: "bg-neutral-100 text-neutral-600 border-neutral-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[level] ?? colors.low}`}>
      {level === "high" ? "High" : level === "medium" ? "Medium" : "Low"}: {count}
    </span>
  );
}

export default function AdminQualityPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const t = getMessages(locale).adminQuality;
  const a = `/${locale}/admin`;

  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [health, setHealth] = useState<QualityHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, healthRes] = await Promise.all([
        fetch("/api/admin/quality/summary", { cache: "no-store" }),
        fetch("/api/admin/quality/health", { cache: "no-store" }),
      ]);
      const sumData = await sumRes.json() as QualitySummary;
      const healthData = await healthRes.json() as QualityHealth;
      if (sumData.error && !sumRes.ok) {
        setError(sumData.error);
      }
      setSummary(sumData);
      setHealth(healthData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8" aria-label={t.mainRegionAria}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Admin Quality</h1>
          <p className="mt-1 text-sm text-neutral-600">Quality Events 대시보드</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            새로고침
          </button>

        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingFallback icon="📋" message="품질 데이터 로드 중..." withSkeleton style={{ padding: "32px 20px" }} />
      ) : (
        <div className="space-y-6">
          {/* Health status */}
          {health && (
            <div className="flex items-center gap-3 rounded border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${health.db_ok ? "bg-emerald-500" : "bg-red-400"}`} />
              <span className="text-sm text-neutral-700">
                DB: {health.db_ok ? "정상" : "연결 안됨"}
              </span>
              <span className="text-sm text-neutral-400">|</span>
              <span className="text-sm text-neutral-700">
                30일 이벤트: <strong>{health.total_events_30d}</strong>
              </span>
              {health.latest_event_at && (
                <>
                  <span className="text-sm text-neutral-400">|</span>
                  <span className="text-xs text-neutral-500">
                    마지막: {new Date(health.latest_event_at).toLocaleString("ko-KR")}
                  </span>
                </>
              )}
              {health.error && (
                <span className="ml-auto text-xs text-amber-600">{health.error}</span>
              )}
            </div>
          )}

          {/* Summary overview */}
          <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-900">이벤트 요약</h2>
              {summary?.window && (
                <span className="text-xs text-neutral-400">기간: {summary.window}</span>
              )}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-neutral-700 font-medium">
                총 이벤트: <strong>{summary?.total_events ?? 0}</strong>
              </span>
              {summary?.avg_css != null && (
                <span className="text-sm text-neutral-500">
                  평균 CSS: {(summary.avg_css * 100).toFixed(1)}%
                </span>
              )}
            </div>

            {summary?.severity && (
              <div className="flex flex-wrap gap-2">
                <SeverityBadge level="high" count={summary.severity.high} />
                <SeverityBadge level="medium" count={summary.severity.medium} />
                <SeverityBadge level="low" count={summary.severity.low} />
              </div>
            )}

            {(summary?.total_events ?? 0) === 0 && (
              <p className="mt-4 text-sm text-neutral-400">
                이벤트 데이터가 없습니다. bty-ai-core 백엔드 연동 후 표시됩니다.
              </p>
            )}
          </div>

          {/* Top signatures */}
          {(summary?.top_signatures?.length ?? 0) > 0 && (
            <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-medium text-neutral-900">주요 이슈 시그니처</h2>
              <ul className="space-y-1">
                {summary!.top_signatures.map((sig, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="text-xs text-neutral-400 tabular-nums w-4">{i + 1}.</span>
                    <code className="rounded bg-neutral-50 px-1.5 py-0.5 text-xs">{sig}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Breakdown tables */}
          {summary && ["route", "role", "intent"].map((key) => {
            const items = summary.breakdown[key as keyof typeof summary.breakdown] ?? [];
            if (items.length === 0) return null;
            const labels: Record<string, string> = { route: "라우트별", role: "역할별", intent: "의도별" };
            return (
              <div key={key} className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-medium text-neutral-900">{labels[key]} 분포</h2>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-neutral-100">
                    {items.map((item) => (
                      <tr key={item.key} className="hover:bg-neutral-50">
                        <td className="py-2 pr-4 text-neutral-700 font-mono text-xs">{item.key}</td>
                        <td className="py-2 text-right tabular-nums text-neutral-700">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}


    </main>
  );
}
