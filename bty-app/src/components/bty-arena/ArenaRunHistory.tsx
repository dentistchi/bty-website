"use client";

import React, { useState, useEffect } from "react";
import type { Locale } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import { CardSkeleton } from "./CardSkeleton";
import { EmptyState } from "./EmptyState";

type RunItem = {
  run_id: string;
  scenario_id: string;
  locale: string;
  started_at: string;
  status: string;
  /** Present when API is enriched with XP totals */
  total_xp?: number;
  /** Present when API is enriched with reflection text */
  reflection_summary?: string;
};

export type ArenaRunHistoryProps = {
  locale: Locale | string;
};

const HEADING_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  margin: "0 0 12px",
};
const HEADING: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: "var(--arena-text)",
};

export function ArenaRunHistory({ locale }: ArenaRunHistoryProps) {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionHint, setSessionHint] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  /** §4 기본 노출, 접기 가능 */
  const [collapsed, setCollapsed] = useState(false);
  const lang = locale === "ko" ? "ko" : "en";
  const t = getMessages(lang).arenaRun;
  const isKo = locale === "ko";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    arenaFetch<{ runs: RunItem[]; viewerAnonymous?: boolean }>("/api/arena/runs?limit=20")
      .then((data) => {
        if (cancelled) return;
        setRuns(data.runs ?? []);
        setSessionHint(Boolean(data.viewerAnonymous));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryCount]);

  function scenarioTitle(scenarioId: string): string {
    const sc = SCENARIOS.find((s) => s.scenarioId === scenarioId);
    if (!sc) return scenarioId;
    return isKo && sc.titleKo ? sc.titleKo : sc.title;
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString(
      isKo ? "ko-KR" : "en-US",
      { year: "numeric", month: "short", day: "numeric" },
    );
  }

  function statusLabel(status: string): string {
    if (status === "DONE" || status === "completed") return t.completed;
    if (status === "in_progress") return t.inProgress;
    return status;
  }

  const toggleButton = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? t.pastScenariosExpand : t.pastScenariosCollapse}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        color: "var(--arena-text-soft)",
        background: "transparent",
        border: "1px solid #ddd",
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      {collapsed ? t.pastScenariosExpand : t.pastScenariosCollapse}
    </button>
  );

  if (loading) {
    return (
      <section style={{ marginTop: 28 }} aria-labelledby="arena-run-history-heading">
        <div style={HEADING_ROW}>
          <h3 id="arena-run-history-heading" style={HEADING}>{t.pastScenariosHeading}</h3>
          {toggleButton}
        </div>
        <div aria-busy="true" aria-label={t.loadingHistory}>
          <p
            style={{
              margin: 0,
              padding: "12px 0 8px",
              fontSize: 13,
              color: "var(--arena-text-soft)",
              opacity: 0.9,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            aria-live="polite"
          >
            <span aria-hidden style={{ fontSize: 18 }}>📋</span>
            {t.loadingHistory}
          </p>
          <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
          <div style={{ marginTop: 8 }}>
            <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ marginTop: 28 }} aria-labelledby="arena-run-history-heading">
        <div style={HEADING_ROW}>
          <h3 id="arena-run-history-heading" style={HEADING}>{t.pastScenariosHeading}</h3>
          {toggleButton}
        </div>
        <div role="alert" style={{ padding: "12px 16px", border: "1px solid #f1c0c0", borderRadius: 12, background: "#fff7f7" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#8b2e2e" }}>{t.couldNotLoadHistory}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setRetryCount((c) => c + 1);
            }}
            aria-label={t.retryLoadHistory}
            style={{
              marginTop: 10,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #c0a0a0",
              background: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
        </div>
      </section>
    );
  }

  if (runs.length === 0) {
    return (
      <section style={{ marginTop: 28 }} aria-labelledby="arena-run-history-heading">
        <div style={HEADING_ROW}>
          <h3 id="arena-run-history-heading" style={HEADING}>{t.pastScenariosHeading}</h3>
          {toggleButton}
        </div>
        {sessionHint ? (
          <div
            role="status"
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #e8d4a8",
              background: "#fffbeb",
              fontSize: 14,
              color: "#713f12",
            }}
          >
            {t.pastScenariosSessionHint}
          </div>
        ) : (
          <div style={{ border: "1px solid #eee", borderRadius: 14, background: "var(--arena-card)" }}>
            <EmptyState icon="📋" message={t.noCompletedScenarios} hint={t.startFirstScenario} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section style={{ marginTop: 28 }} aria-labelledby="arena-run-history-heading">
      <div style={HEADING_ROW}>
        <h3 id="arena-run-history-heading" style={HEADING}>{t.pastScenariosHeading}</h3>
        {toggleButton}
      </div>
      {!collapsed && (
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {runs.map((run) => (
          <li
            key={run.run_id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "12px 16px",
              background: "var(--arena-card, #FAFAF8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--arena-text)", minWidth: 0 }}>
                {scenarioTitle(run.scenario_id)}
              </span>
              <span style={{ fontSize: 12, color: "var(--arena-text-soft, #999)", flexShrink: 0 }}>
                {fmtDate(run.started_at)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: "var(--arena-text-soft, #999)" }}>
                {statusLabel(run.status)}
              </span>
              {typeof run.total_xp === "number" && (
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--arena-accent, #6366f1)" }}>
                  XP +{run.total_xp}
                </span>
              )}
            </div>

            {run.reflection_summary && (
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--arena-text)", opacity: 0.85 }}>
                {run.reflection_summary}
              </p>
            )}
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
