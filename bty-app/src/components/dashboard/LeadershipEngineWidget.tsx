"use client";

/**
 * Foundry dashboard — single GET {@link getIntegrityDashboard} via `/api/bty/dashboard/integrity`.
 * Integrity score card from `getIntegrityScoreCard` (same engine as GET `/api/bty/center/integrity-scorecard`).
 * AIR sparkline ({@link AirTrendSparkline}), LRI + promotion_blocked, TII health band, Certified countdown,
 * Elite Spec PENDING/APPROVED, weekly streak/completion, Realtime `certified_leader_grants` + `elite_spec_nominations`.
 */

import React from "react";
import { AirTrendSparkline } from "@/components/dashboard/AirTrendSparkline";
import { CardSkeleton } from "@/components/bty-arena";
import type { IntegrityDashboard } from "@/engine/integrity/integrity-dashboard.service";
import { ELITE_SPEC_READINESS_THRESHOLD } from "@/engine/integration/elite-spec-flow";
import type { AIRTrendDirection } from "@/engine/integrity/air-trend.service";
import { getSupabase } from "@/lib/supabase";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function directionBadge(
  direction: AIRTrendDirection,
  loc: "ko" | "en",
): { label: string; bg: string; color: string } {
  switch (direction) {
    case "improving":
      return {
        label: loc === "ko" ? "상승" : "Rising",
        bg: "rgba(13, 148, 136, 0.15)",
        color: "#0d9488",
      };
    case "declining":
      return {
        label: loc === "ko" ? "하락" : "Declining",
        bg: "rgba(220, 38, 38, 0.12)",
        color: "#dc2626",
      };
    default:
      return {
        label: loc === "ko" ? "안정" : "Stable",
        bg: "rgba(100, 116, 139, 0.15)",
        color: "#64748b",
      };
  }
}

function formatCertCountdown(ms: number, loc: "ko" | "en"): string {
  if (ms <= 0) return loc === "ko" ? "만료 임박" : "Expiring now";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return loc === "ko" ? `${d}일 ${h}시간` : `${d}d ${h}h`;
  return `${pad(h)}:${pad(m)}`;
}

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
        <div style={{ flex: "0 0 60%", background: "#fecaca" }} title={bandRed} aria-hidden />
        <div style={{ flex: "0 0 20%", background: "#fde047" }} title={bandYellow} aria-hidden />
        <div style={{ flex: "0 0 20%", background: "#86efac" }} title={bandGreen} aria-hidden />
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

export type LeadershipEngineWidgetProps = {
  locale: Locale | string;
};

export function LeadershipEngineWidget({ locale }: LeadershipEngineWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const [data, setData] = React.useState<IntegrityDashboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [eliteBusy, setEliteBusy] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const load = React.useCallback(
    async (opts?: { refresh?: boolean }) => {
      setError(null);
      try {
        const q = opts?.refresh ? "?refresh=1" : "";
        const res = await fetch(`/api/bty/dashboard/integrity${q}`, { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as IntegrityDashboard & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
        setData(json);
      } catch {
        setError(b.leadershipEngineWidgetError);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [b.leadershipEngineWidgetError],
  );

  React.useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const uid = data?.userId?.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`le_integrity_dash:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "certified_leader_grants",
          filter: `user_id=eq.${uid}`,
        },
        () => void load({ refresh: true }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "elite_spec_nominations",
          filter: `user_id=eq.${uid}`,
        },
        () => void load({ refresh: true }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "certification_renewal_log",
          filter: `user_id=eq.${uid}`,
        },
        () => void load({ refresh: true }),
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [data?.userId, load]);

  const onEliteCta = React.useCallback(async () => {
    setEliteBusy(true);
    try {
      const res = await fetch("/api/arena/leadership-engine/elite-spec/nominate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) await load({ refresh: true });
    } finally {
      setEliteBusy(false);
    }
  }, [load]);

  if (loading && !data) {
    return (
      <section
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={b.leadershipEngineWidgetLoading}
      >
        <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>{b.leadershipEngineWidgetTitle}</p>
        <CardSkeleton showLabel={false} lines={2} />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section role="region" aria-label={b.leadershipEngineWidgetRegionAria}>
        <p style={{ margin: 0, fontSize: 14, color: "#8b2e2e" }}>{error ?? b.leadershipEngineWidgetError}</p>
      </section>
    );
  }

  const pr = data.promotionReadiness;
  const readinessPct = Math.round(pr.readiness_score * 100);
  const lriPct = data.lri != null ? Math.max(0, Math.min(1, data.lri.lri)) : 0;
  const dir = directionBadge(data.airTrend.direction, loc);
  const tiiPct = tiiScorePercent(data.tii?.tii ?? null);
  const badge = dir;

  const cert = data.certified;
  const certifiedActive = cert.state === "active";
  let certifiedMs = 0;
  if (cert.state === "active") {
    certifiedMs = Math.max(0, new Date(cert.expiresAt).getTime() - Date.now());
  }
  void tick;

  const showEliteCta =
    pr.readiness_score >= ELITE_SPEC_READINESS_THRESHOLD &&
    !pr.promotion_blocked &&
    data.eliteNomination?.status !== "PENDING" &&
    !certifiedActive;

  return (
    <section
      role="region"
      aria-label={b.leadershipEngineWidgetRegionAria}
      style={{
        display: "grid",
        gap: 20,
        padding: "18px 16px",
        border: "1px solid #e8e3d8",
        borderRadius: 16,
        background: "var(--arena-card, #fff)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--arena-text, #1e2a38)" }}>
          {b.leadershipEngineWidgetTitle}
        </h2>
        {pr.promotion_blocked ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(185, 28, 28, 0.12)",
              color: "#991b1b",
              border: "1px solid rgba(185, 28, 28, 0.3)",
            }}
          >
            {b.leadershipEnginePromotionBlockedBadge}
          </span>
        ) : null}
      </div>

      <div
        role="group"
        aria-label={b.leadershipEngineIntegrityRegionAria}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(15, 23, 42, 0.04)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
            {b.leadershipEngineIntegrityLabel}
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--arena-text, #1e2a38)", fontVariantNumeric: "tabular-nums" }}>
            {Math.round(data.integrityScoreCard.compositeScore)}%
          </p>
        </div>
        <span
          style={{
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1,
            color: "var(--arena-text, #1e2a38)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 40,
            textAlign: "center",
          }}
        >
          {data.integrityScoreCard.overall_integrity_grade}
        </span>
      </div>

      <div
        role="group"
        aria-label={b.leadershipEngineAirTrendSparklineAria}
        style={{ display: "grid", gap: 8, minWidth: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{b.leadershipEngineAirTrendSparklineAria}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 999, background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>
        <div style={{ height: 72 }}>
          <AirTrendSparkline dailyAir={data.airTrend.dailyAir} direction={data.airTrend.direction} height={72} />
        </div>
      </div>

      <div role="group" aria-label={b.leadershipEngineLriAria}>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, opacity: 0.85 }}>{b.leadershipEngineLriAria}</p>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--arena-text, #1e2a38)" }}>
          {(lriPct * 100).toFixed(1)}%
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
          {loc === "ko" ? "준비도 점수" : "Readiness score"}: {readinessPct}%
        </p>
      </div>

      <div role="group" aria-label={b.leadershipEngineTiiAria}>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, opacity: 0.85 }}>{b.leadershipEngineTiiAria}</p>
        {tiiPct != null ? (
          <>
            <TeamHealthBar
              scorePct={tiiPct}
              ariaLabel={b.tiiWidgetHealthBarAria}
              bandRed={b.tiiWidgetBandRed}
              bandYellow={b.tiiWidgetBandYellow}
              bandGreen={b.tiiWidgetBandGreen}
            />
            <p style={{ margin: "6px 0 0", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{tiiPct}%</p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{b.tiiWidgetNoSnapshot}</p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {certifiedActive ? (
          <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
            <span style={{ fontWeight: 700 }}>{b.leadershipEngineCertifiedBadge}</span>
            <span style={{ marginLeft: 8 }}>
              {b.leadershipEngineCertifiedExpiresIn}: {formatCertCountdown(certifiedMs, loc)}
            </span>
          </p>
        ) : data.eliteNomination?.status === "PENDING" ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(234, 179, 8, 0.15)",
              color: "#a16207",
              border: "1px solid rgba(234, 179, 8, 0.35)",
              width: "fit-content",
            }}
          >
            {b.leadershipEngineElitePendingBadge}
          </span>
        ) : data.eliteNomination?.status === "APPROVED" ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(22, 163, 74, 0.12)",
              color: "#166534",
              border: "1px solid rgba(22, 163, 74, 0.28)",
              width: "fit-content",
            }}
          >
            {b.leadershipEngineEliteApprovedBadge}
          </span>
        ) : null}
        {data.renewalHistory && data.renewalHistory.length > 0 ? (
          <div
            role="group"
            aria-label={b.leadershipEngineRenewalHistoryAria}
            style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              {b.leadershipEngineRenewalHistoryAria}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
              {data.renewalHistory.map((row) => {
                const lri =
                  row.lriAtAttempt != null && Number.isFinite(row.lriAtAttempt)
                    ? `${Math.round(row.lriAtAttempt * 100)}%`
                    : "—";
                const when = new Date(row.attemptedAt).toLocaleString(loc === "ko" ? "ko-KR" : "en-US", {
                  dateStyle: "short",
                  timeStyle: "short",
                });
                const status = row.renewed ? b.leadershipEngineRenewalRowRenewed : b.leadershipEngineRenewalRowNotRenewed;
                return (
                  <li key={row.id}>
                    <span style={{ fontWeight: 600 }}>{when}</span>
                    {" · "}
                    {status}
                    {" · LRI "}
                    {lri}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {data.weeklyReport ? (
        <div style={{ fontSize: 13, color: "#475569", display: "flex", flexWrap: "wrap", gap: 12 }}>
          <span>
            {b.leadershipEngineWeeklyStreak}: <strong>{data.weeklyReport.streak}</strong>
          </span>
          <span>
            {b.leadershipEngineWeeklyCompletion}:{" "}
            <strong>{Math.round(data.weeklyReport.completion_rate * 100)}%</strong>
          </span>
        </div>
      ) : null}

      {showEliteCta ? (
        <button
          type="button"
          className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={eliteBusy}
          onClick={() => void onEliteCta()}
        >
          {eliteBusy ? b.leadershipEngineEliteCtaBusy : b.leadershipEngineEliteCta}
        </button>
      ) : null}
    </section>
  );
}
