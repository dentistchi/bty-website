"use client";

import type { Summary } from "./types";

export function IssueFrequencyCard({
  summary,
  loading,
  searchQuery,
  maxItems = 10,
}: {
  summary: Summary | null;
  loading: boolean;
  searchQuery?: string;
  maxItems?: number;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-neutral-800">
          Issue Frequency
        </h3>
        <div className="h-48 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  const freqs = summary?.issue_frequencies ?? [];
  const filtered = searchQuery
    ? freqs.filter((f) =>
        f.issue.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : freqs;
  const display = filtered.slice(0, maxItems);
  const maxCount = Math.max(...display.map((f) => f.count), 1);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-neutral-800">
        Issue Frequency (top {maxItems})
      </h3>
      {display.length ? (
        <div className="space-y-3">
          {display.map((f) => (
            <div key={f.issue} className="flex items-center gap-3">
              <span
                className="min-w-0 flex-1 truncate text-sm text-neutral-700"
                title={f.issue}
              >
                {f.issue}
              </span>
              <div className="h-5 w-24 flex-shrink-0 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-neutral-500"
                  style={{ width: `${(f.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-16 flex-shrink-0 text-right text-xs text-neutral-500">
                {f.count}
                {f.high_ratio > 0 ? ` (${(f.high_ratio * 100).toFixed(0)}% high)` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No issue data</p>
      )}
    </div>
  );
}
