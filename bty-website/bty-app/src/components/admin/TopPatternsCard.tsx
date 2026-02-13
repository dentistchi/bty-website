"use client";

import { useState, useCallback } from "react";
import type { Summary, Trend } from "./types";

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">
      {label}
    </span>
  );
}

function buildPatchPrompt(signature: string, count: number, highCount: number): string {
  return `Focus on this failure pattern for patch suggestion:
Signature: ${signature}
Count: ${count}
High severity count: ${highCount}

Generate a patch suggestion targeting this specific pattern.`;
}

function PatternRow({
  row,
  rank,
  trends,
  loadingTrends,
  windowParam,
  onGeneratePatch,
  onCopyPrompt,
  generating,
  compact = false,
}: {
  row: Summary["top_signatures"][0];
  rank: number;
  trends: Trend[];
  loadingTrends: boolean;
  windowParam: string;
  onGeneratePatch: (sig: string) => void;
  onCopyPrompt: (text: string) => void;
  generating: string | null;
  compact?: boolean;
}) {
  const rowTrends = trends.filter((t) => t.issues_signature === row.issues_signature).sort((a, b) => a.day.localeCompare(b.day));
  const maxC = Math.max(...rowTrends.map((x) => x.count), 1);
  const promptText = buildPatchPrompt(row.issues_signature, row.count, row.high_severity_count);

  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-neutral-400">#{rank}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.issues_signature.split("|").map((s) => (
              <Chip key={s} label={s} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-600">
            <span>count: <strong>{row.count}</strong></span>
            <span>high: <strong>{row.high_severity_count}</strong></span>
            <span>avg_css: <strong>{row.avg_css ?? "—"}</strong></span>
            {row.top_routes && <span>routes: {row.top_routes}</span>}
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={() => onCopyPrompt(promptText)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Copy patch prompt
          </button>
          <button
            onClick={() => onGeneratePatch(row.issues_signature)}
            disabled={generating !== null}
            className="rounded bg-neutral-800 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {generating === row.issues_signature ? "Generating…" : "Generate Patch"}
          </button>
        </div>
      </div>
      {!compact && rowTrends.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-medium text-neutral-500">14-day trend</span>
          {loadingTrends ? (
            <div className="mt-1 h-10 animate-pulse rounded bg-neutral-100" />
          ) : (
            <div className="mt-1 flex h-10 items-end gap-0.5">
              {rowTrends.map((t) => (
                <div
                  key={t.day}
                  title={`${t.day}: ${t.count}`}
                  className="min-w-[4px] flex-1 rounded-t bg-neutral-400"
                  style={{
                    height: `${Math.max(6, (t.count / maxC) * 36)}px`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TopPatternsCard({
  summary,
  trends,
  loadingSummary,
  loadingTrends,
  windowParam,
  searchQuery,
  onRefresh,
}: {
  summary: Summary | null;
  trends: Trend[];
  loadingSummary: boolean;
  loadingTrends: boolean;
  windowParam: string;
  searchQuery?: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleGenerate = useCallback(
    async (sig: string) => {
      setGenerating(sig);
      try {
        const res = await fetch(
          `/api/admin/patch/generate?window=${windowParam}&focus=${encodeURIComponent(sig)}`,
          { method: "POST", credentials: "include" }
        );
        const data = await res.json();
        if (data.created) {
          onRefresh();
        }
      } finally {
        setGenerating(null);
      }
    },
    [windowParam, onRefresh]
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(null), 1500);
  }, []);

  const topSignatures = summary?.top_signatures ?? [];
  const filtered = searchQuery
    ? topSignatures.filter((r) =>
        r.issues_signature.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : topSignatures;
  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3, 10);

  if (loadingSummary) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-neutral-800">
          Top Failure Patterns
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-neutral-800">
          Top Failure Patterns
        </h3>
        <p className="mt-2 text-sm text-neutral-500">No patterns in window</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-800">
          What should I fix this week?
        </h3>
        {copyFeedback && (
          <span className="text-xs text-emerald-600">{copyFeedback}</span>
        )}
      </div>

      <div className="space-y-4">
        {top3.map((row, i) => (
          <PatternRow
            key={row.issues_signature}
            row={row}
            rank={i + 1}
            trends={trends}
            loadingTrends={loadingTrends}
            windowParam={windowParam}
            onGeneratePatch={handleGenerate}
            onCopyPrompt={handleCopy}
            generating={generating}
          />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800"
          >
            {expanded ? "Hide" : "Show"} all Top 10 ({rest.length} more)
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              {rest.map((row, i) => (
                <PatternRow
                  key={row.issues_signature}
                  row={row}
                  rank={4 + i}
                  trends={trends}
                  loadingTrends={loadingTrends}
                  windowParam={windowParam}
                  onGeneratePatch={handleGenerate}
                  onCopyPrompt={handleCopy}
                  generating={generating}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
