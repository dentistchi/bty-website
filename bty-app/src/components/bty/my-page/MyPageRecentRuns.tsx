"use client";

/**
 * GET /api/arena/runs — 목록·nextCursor 페이지네이션 render-only.
 *
 * **Run deeplinks (`/${locale}/bty-arena/run/:runId`)** — infrastructure / historical record navigation (stable URL per run).
 * Not “live Arena entry”: do not replace with session-router snapshot; “continue Arena now” is a separate product surface
 * (see {@link useArenaEntryResolution}). @see `arenaProductVsInfrastructure.ts`
 */
import Link from "next/link";
import React from "react";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { arenaRunStateDisplayLabelKey } from "@/domain/rules/arenaRunState";
import type { ArenaRunLifecyclePhase } from "@/domain/rules/arenaRunState";
import { arenaStableLabel, getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function phaseFromRunsApiStatus(status: string): ArenaRunLifecyclePhase {
  const u = status.trim().toUpperCase();
  if (u === "DONE" || u === "COMPLETED") return "completed";
  if (u === "ABORTED" || u === "CANCELLED") return "aborted";
  return "in_progress";
}

type RunRow = {
  run_id: string;
  scenario_id: string;
  locale?: string;
  started_at: string;
  status: string;
};

type RunsRes = {
  runs?: RunRow[];
  nextCursor?: string | null;
  viewerAnonymous?: boolean;
  message?: string;
};

const PAGE_LIMIT = 5;

export function MyPageRecentRuns({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).myPageStub;
  const [runs, setRuns] = React.useState<RunRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [anonymous, setAnonymous] = React.useState(false);

  const loadPage = React.useCallback(
    async (cursor: string | null, append: boolean) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(`/api/arena/runs?${params.toString()}`, {
        credentials: "include",
      });
      const d = (await r.json().catch(() => ({}))) as RunsRes;
      if (d.viewerAnonymous) {
        setAnonymous(true);
        setRuns([]);
        setNextCursor(null);
        return;
      }
      setAnonymous(false);
      const batch = Array.isArray(d.runs) ? d.runs : [];
      setRuns((prev) => (append ? [...prev, ...batch] : batch));
      setNextCursor(typeof d.nextCursor === "string" ? d.nextCursor : null);
    },
    [],
  );

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    loadPage(null, false)
      .catch(() => {
        if (alive) {
          setRuns([]);
          setNextCursor(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadPage]);

  async function onLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(nextCursor, true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <InfoCard title={t.recentRunsCardTitle}>
      {loading && (
        <p className="text-sm text-bty-muted" role="status">
          {t.recentRunsLoading}
        </p>
      )}
      {!loading && anonymous && (
        <p className="text-sm text-bty-secondary">{t.recentRunsAnonymous}</p>
      )}
      {!loading && !anonymous && runs.length === 0 && (
        <p className="text-sm text-bty-secondary">{t.recentRunsEmpty}</p>
      )}
      {!loading && !anonymous && runs.length > 0 && (
        <>
          <ul
            className="space-y-2"
            role="list"
            aria-label={t.recentRunsRegionAria}
          >
            {runs.map((r) => (
              <li
                key={r.run_id}
                className="rounded-lg border border-bty-border bg-bty-bg px-3 py-2 text-sm"
              >
                <div className="font-medium text-bty-text">
                  {t.recentRunsScenarioPrefix}: {r.scenario_id}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-bty-secondary">
                  <span>
                    {t.recentRunsStatusPrefix}:{" "}
                    {arenaStableLabel(
                      lang,
                      arenaRunStateDisplayLabelKey(phaseFromRunsApiStatus(r.status)),
                    )}{" "}
                    · {t.recentRunsStartedPrefix}:{" "}
                    {new Date(r.started_at).toLocaleString(
                      lang === "ko" ? "ko-KR" : "en-US",
                      { dateStyle: "short", timeStyle: "short" },
                    )}
                  </span>
                  <Link
                    href={`/${locale}/bty-arena/run/${encodeURIComponent(r.run_id)}`}
                    className="font-medium text-bty-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel"
                  >
                    {t.recentRunsOpenDetail} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                className="rounded-lg border border-bty-border bg-bty-bg px-4 py-2 text-sm font-medium text-bty-secondary transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel disabled:opacity-50"
              >
                {loadingMore ? t.recentRunsLoadingMore : t.recentRunsLoadMore}
              </button>
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-xs text-bty-muted">{t.recentRunsFootnote}</p>
    </InfoCard>
  );
}
