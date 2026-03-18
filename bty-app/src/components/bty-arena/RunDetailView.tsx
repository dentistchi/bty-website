"use client";

/**
 * GET /api/arena/run/[runId] — 단일 런 필드 표시만.
 */
import Link from "next/link";
import React from "react";
import { arenaRunLifecyclePhase, arenaRunStateDisplayLabelKey } from "@/domain/rules/arenaRunState";
import type { ArenaRunLifecyclePhase } from "@/domain/rules/arenaRunState";
import { arenaRunDetailDisplayLabel, arenaStableLabel, getMessages } from "@/lib/i18n";
import { arenaRunDetailSkeletonDisplayKey } from "@/domain/rules/arenaRunDetailDisplay";
import type { Locale } from "@/lib/i18n";

type Run = {
  run_id: string;
  scenario_id: string;
  locale?: string | null;
  started_at: string;
  status: string;
  completed_at?: string | null;
  difficulty?: string | null;
  meta?: unknown;
};

function runDetailStatusLabel(run: Run, loc: Locale): string {
  const phase = arenaRunLifecyclePhase({
    startedAt: run.started_at,
    completedAt: run.completed_at,
    abortedAt: undefined,
  });
  if (phase) {
    return arenaStableLabel(loc, arenaRunStateDisplayLabelKey(phase));
  }
  const fallback = phaseFromRunsApiStatus(run.status);
  return arenaStableLabel(loc, arenaRunStateDisplayLabelKey(fallback));
}

function phaseFromRunsApiStatus(status: string): ArenaRunLifecyclePhase {
  const u = status.trim().toUpperCase();
  if (u === "DONE" || u === "COMPLETED") return "completed";
  if (u === "ABORTED" || u === "CANCELLED") return "aborted";
  return "in_progress";
}

export function RunDetailView({ locale, runId }: { locale: string; runId: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).myPageStub;
  const base = `/${locale}`;
  const [run, setRun] = React.useState<Run | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<"auth" | "notfound" | "other" | null>(null);

  React.useEffect(() => {
    let alive = true;
    const id = encodeURIComponent(runId);
    setLoading(true);
    setErr(null);
    fetch(`/api/arena/run/${id}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.status === 401) {
          setErr("auth");
          setRun(null);
          return;
        }
        if (r.status === 404) {
          setErr("notfound");
          setRun(null);
          return;
        }
        if (!r.ok) {
          setErr("other");
          setRun(null);
          return;
        }
        const row = j?.run as Run | undefined;
        if (row && typeof row.run_id === "string") {
          setRun(row);
        } else {
          setErr("other");
        }
      })
      .catch(() => {
        if (alive) {
          setErr("other");
          setRun(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [runId]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <section className="mt-4" role="region" aria-label={t.runDetailRegionAria}>
      <Link
        href={`${base}/my-page`}
        className="text-sm font-medium text-bty-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel"
      >
        ← {t.runDetailBackMyPage}
      </Link>

      {loading && (
        <p className="mt-4 text-sm text-bty-muted" role="status" aria-busy="true">
          {t.runDetailLoading}
        </p>
      )}

      {!loading && err === "auth" && (
        <p className="mt-4 text-sm text-bty-secondary" role="status">
          {t.runDetailSignIn}
        </p>
      )}
      {!loading && err === "notfound" && (
        <p className="mt-4 text-sm text-bty-secondary" role="status">
          {arenaRunDetailDisplayLabel(lang, arenaRunDetailSkeletonDisplayKey("empty"))}
        </p>
      )}
      {!loading && err === "other" && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {t.runDetailError}
        </p>
      )}

      {!loading && run && (
        <dl className="mt-4 space-y-3 rounded-xl border border-bty-border bg-bty-bg p-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-bty-muted">
              {t.runDetailScenarioId}
            </dt>
            <dd className="mt-0.5 font-medium text-bty-text">{run.scenario_id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-bty-muted">
              {t.runDetailStatus}
            </dt>
            <dd className="mt-0.5 text-bty-text">{runDetailStatusLabel(run, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-bty-muted">
              {t.runDetailStartedAt}
            </dt>
            <dd className="mt-0.5 tabular-nums text-bty-text">{fmt(run.started_at)}</dd>
          </div>
          {run.completed_at && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-bty-muted">
                {t.runDetailCompletedAt}
              </dt>
              <dd className="mt-0.5 tabular-nums text-bty-text">{fmt(run.completed_at)}</dd>
            </div>
          )}
          {run.locale != null && run.locale !== "" && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-bty-muted">
                {t.runDetailLocaleLabel}
              </dt>
              <dd className="mt-0.5 text-bty-text">{run.locale}</dd>
            </div>
          )}
          {run.difficulty != null && run.difficulty !== "" && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-bty-muted">
                {t.runDetailDifficulty}
              </dt>
              <dd className="mt-0.5 text-bty-text">{run.difficulty}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
