"use client";

/**
 * Dashboard — Team Integrity Index from `team_integrity_index` (server `getTeamTIISnapshot` via GET team-tii).
 * Team-level TII only; member_count is league roster size (no per-person scores).
 * Subscribes to Supabase Realtime `postgres_changes` on `team_integrity_index` for this team_id.
 */

import React from "react";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { CardSkeleton } from "@/components/bty-arena";

export type TIIWidgetProps = {
  /** League / team id (`league_id`). */
  teamId: string;
  locale: Locale | string;
};

type TeamTiiApi = {
  tii: number | null;
  avg_air: number | null;
  avg_mwd: number | null;
  tsp: number | null;
  last_calculated_at: string | null;
  member_count: number;
};

type TeamBenchmarkApi = {
  teamIntegrityRisk: boolean;
  consecutiveLowTiiWeeks: number;
  riskLevel: string;
  myPeerPercentile: number | null;
  myAir14d: number | null;
};

function tiiScorePercent(tii: number | null): number | null {
  if (tii == null || !Number.isFinite(tii)) return null;
  return Math.max(0, Math.min(100, Math.round(tii * 100)));
}

function bandColorForScore(scorePct: number): string {
  if (scorePct >= 80) return "#16a34a";
  if (scorePct >= 60) return "#ca8a04";
  return "#dc2626";
}

function TeamHealthBar({
  scorePct,
  ariaLabel,
  bandRed,
  bandYellow,
  bandGreen,
}: {
  scorePct: number;
  ariaLabel: string;
  bandRed: string;
  bandYellow: string;
  bandGreen: string;
}) {
  const pct = Math.max(0, Math.min(100, scorePct));
  const markerLeft = `${pct}%`;
  const indicatorColor = bandColorForScore(pct);

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={ariaLabel}
      style={{ position: "relative", width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          height: 14,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{ flex: "0 0 60%", background: "#fecaca" }}
          title={bandRed}
          aria-hidden
        />
        <div
          style={{ flex: "0 0 20%", background: "#fde047" }}
          title={bandYellow}
          aria-hidden
        />
        <div
          style={{ flex: "0 0 20%", background: "#86efac" }}
          title={bandGreen}
          aria-hidden
        />
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -2,
          bottom: -2,
          width: 3,
          marginLeft: -1.5,
          left: markerLeft,
          borderRadius: 2,
          background: indicatorColor,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.9)",
        }}
      />
    </div>
  );
}

export function TIIWidget({ teamId, locale }: TIIWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const [data, setData] = React.useState<TeamTiiApi | null>(null);
  const [benchmark, setBenchmark] = React.useState<TeamBenchmarkApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (showLoading = true) => {
      if (!teamId.trim()) {
        setData(null);
        setBenchmark(null);
        setError(b.tiiWidgetError);
        if (showLoading) setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const tid = encodeURIComponent(teamId.trim());
        const q = `/api/arena/leadership-engine/team-tii?teamId=${tid}`;
        const bq = `/api/arena/leadership-engine/team-benchmark?teamId=${tid}`;
        const [json, bench] = await Promise.all([
          arenaFetch<TeamTiiApi>(q),
          arenaFetch<TeamBenchmarkApi>(bq).catch(() => null),
        ]);
        setData(json);
        setBenchmark(bench);
      } catch {
        setError(b.tiiWidgetError);
        setData(null);
        setBenchmark(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [teamId, b.tiiWidgetError]
  );

  React.useEffect(() => {
    void load(true);
  }, [load]);

  React.useEffect(() => {
    if (!teamId.trim()) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`team_integrity_index:${teamId.trim()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_integrity_index",
          filter: `team_id=eq.${teamId.trim()}`,
        },
        () => {
          void load(false);
        }
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [teamId, load]);

  if (loading && !data) {
    return (
      <section role="status" aria-busy="true" aria-label={b.tiiWidgetLoading}>
        <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>{b.tiiWidgetTitle}</p>
        <CardSkeleton showLabel={false} lines={2} />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section role="region" aria-label={b.tiiWidgetRegionAria}>
        <p style={{ margin: 0, fontSize: 14, color: "#8b2e2e" }}>{error ?? b.tiiWidgetError}</p>
      </section>
    );
  }

  const scorePct = tiiScorePercent(data.tii);
  const hasSnapshot = scorePct != null;

  return (
    <section
      role="region"
      aria-label={b.tiiWidgetRegionAria}
      style={{
        display: "grid",
        gap: 12,
        padding: "16px",
        border: "1px solid #e8e3d8",
        borderRadius: 16,
        background: "var(--arena-card, #fff)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--arena-text, #1e2a38)" }}>
        {b.tiiWidgetTitle}
      </h2>

      {!hasSnapshot ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{b.tiiWidgetNoSnapshot}</p>
      ) : (
        <>
          <TeamHealthBar
            scorePct={scorePct!}
            ariaLabel={b.tiiWidgetHealthBarAria}
            bandRed={b.tiiWidgetBandRed}
            bandYellow={b.tiiWidgetBandYellow}
            bandGreen={b.tiiWidgetBandGreen}
          />
          <p
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: bandColorForScore(scorePct!),
            }}
          >
            {b.tiiWidgetScorePct.replace("{pct}", String(scorePct))}
          </p>
        </>
      )}

      {benchmark?.teamIntegrityRisk ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 13,
            background: "rgba(220, 38, 38, 0.08)",
            color: "#991b1b",
            border: "1px solid rgba(220, 38, 38, 0.25)",
          }}
        >
          {loc === "ko"
            ? `팀 무결성 주의: 주간 TII가 ${benchmark.consecutiveLowTiiWeeks}주 연속 60 미만 (${benchmark.riskLevel}).`
            : `Team integrity watch: weekly TII below 60 for ${benchmark.consecutiveLowTiiWeeks} consecutive weeks (${benchmark.riskLevel}).`}
        </p>
      ) : null}

      {benchmark?.myPeerPercentile != null && data.member_count > 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          {loc === "ko"
            ? `팀 내 AIR 순위: ${Math.round(benchmark.myPeerPercentile * data.member_count)} / ${data.member_count}`
            : `AIR rank in team: ${Math.round(benchmark.myPeerPercentile * data.member_count)} / ${data.member_count}`}
        </p>
      ) : null}

      <dl
        style={{
          margin: 0,
          display: "grid",
          gap: 8,
          fontSize: 13,
          color: "#475569",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ margin: 0 }}>{b.tiiWidgetMembersLabel}</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{data.member_count}</dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <dt style={{ margin: 0 }}>{b.tiiWidgetLastCalculated}</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {data.last_calculated_at
              ? new Date(data.last_calculated_at).toLocaleString(loc === "ko" ? "ko-KR" : "en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </dd>
        </div>
      </dl>

      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
        {b.tiiWidgetBandRed} · {b.tiiWidgetBandYellow} · {b.tiiWidgetBandGreen}
      </p>
    </section>
  );
}
