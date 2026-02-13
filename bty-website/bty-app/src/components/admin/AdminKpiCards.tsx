"use client";

import type { Summary } from "./types";

function Card({ title, value, sub }: { title: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-800">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-neutral-500">{sub}</p>}
    </div>
  );
}

export function AdminKpiCards({ summary, loading }: { summary: Summary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const total = summary.total_events;
  const highRatio =
    total > 0 ? ((summary.severity.high / total) * 100).toFixed(1) : "0";
  const mostCommon =
    summary.issue_frequencies[0]?.issue ?? "—";
  const mostCommonCount = summary.issue_frequencies[0]?.count ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card title="Total events" value={total} sub={`in ${summary.window}`} />
      <Card
        title="Avg CSS"
        value={summary.avg_css != null ? summary.avg_css.toFixed(2) : "—"}
      />
      <Card
        title="High severity %"
        value={`${highRatio}%`}
        sub={`${summary.severity.high} / ${total}`}
      />
      <Card
        title="Most common issue"
        value={mostCommon}
        sub={mostCommonCount ? `${mostCommonCount} events` : undefined}
      />
    </div>
  );
}
