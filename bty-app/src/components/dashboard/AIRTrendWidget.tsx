"use client";

/**
 * Foundry dashboard — 30-day AIR sparkline, 7-day avg, trend badge, Certified Leader expiry, Realtime `air_trend_warning`.
 * Data: GET /api/arena/dashboard/air-trend (session user).
 */

import React from "react";
import { AirTrendSparkline } from "@/components/dashboard/AirTrendSparkline";
import { CardSkeleton } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getSupabase } from "@/lib/supabase";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  AIR_TREND_REALTIME_CHANNEL_PREFIX,
  AIR_TREND_WARNING_BROADCAST_EVENT,
} from "@/lib/bty/arena/air-trend-realtime";

import type { AIRTrend, AIRTrendDirection } from "@/engine/integrity/air-trend.service";
import type { CertifiedLeaderStatus } from "@/engine/integrity/certified-leader.monitor";

type AirTrendApi = {
  userId: string;
  trend: AIRTrend;
  certified: CertifiedLeaderStatus;
};

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

export type AIRTrendWidgetProps = {
  locale: Locale | string;
};

export function AIRTrendWidget({ locale }: AIRTrendWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const [data, setData] = React.useState<AirTrendApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warningFlash, setWarningFlash] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const flashRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerWarningFlash = React.useCallback(() => {
    setWarningFlash(true);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => {
      flashRef.current = null;
      setWarningFlash(false);
    }, 4500);
  }, []);

  const load = React.useCallback(
    async (opts?: { flashOnWarning?: boolean }) => {
      setError(null);
      try {
        const j = await arenaFetch<AirTrendApi>("/api/arena/dashboard/air-trend");
        setData(j);
        if (j.trend.warningEmitted && opts?.flashOnWarning !== false) triggerWarningFlash();
      } catch {
        setError(b.airTrendWidgetError);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [b.airTrendWidgetError, triggerWarningFlash],
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
    return () => {
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, []);

  React.useEffect(() => {
    const userId = data?.userId?.trim();
    if (!userId) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`${AIR_TREND_REALTIME_CHANNEL_PREFIX}${userId}`)
      .on(
        "broadcast",
        { event: AIR_TREND_WARNING_BROADCAST_EVENT },
        (msg: { payload?: { userId?: string } }) => {
          if (msg.payload?.userId === userId) {
            triggerWarningFlash();
            void load({ flashOnWarning: false });
          }
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [data?.userId, load, triggerWarningFlash]);

  if (loading && !data) {
    return (
      <section
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={b.airTrendWidgetLoading}
      >
        <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>{b.airTrendWidgetTitle}</p>
        <CardSkeleton showLabel={false} lines={2} />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section role="region" aria-label={b.airTrendWidgetRegionAria}>
        <p style={{ margin: 0, fontSize: 14, color: "#8b2e2e" }}>{error ?? b.airTrendWidgetError}</p>
      </section>
    );
  }

  const { trend, certified } = data;
  const badge = directionBadge(trend.direction, loc);
  const scorePct = Math.max(0, Math.min(100, Math.round(trend.last7DayWindowAvg * 100)));

  void tick;
  let certifiedCountdown: string | null = null;
  if (certified.state === "active") {
    const ms = new Date(certified.expiresAt).getTime() - Date.now();
    certifiedCountdown = formatCertCountdown(ms, loc);
  }

  return (
    <section
      role="region"
      aria-label={b.airTrendWidgetRegionAria}
      style={{
        display: "grid",
        gap: 14,
        padding: "18px 16px",
        border: "1px solid #e8e3d8",
        borderRadius: 16,
        background: "var(--arena-card, #fff)",
      }}
    >
      {warningFlash ? (
        <div
          role="alert"
          className="animate-pulse"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            background: "rgba(220, 38, 38, 0.12)",
            color: "#991b1b",
            border: "1px solid rgba(220, 38, 38, 0.35)",
          }}
        >
          {b.airTrendWidgetWarningBanner}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--arena-text, #1e2a38)" }}>
          {b.airTrendWidgetTitle}
        </h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 999,
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", gap: 16, alignItems: "center" }}>
        <AirTrendSparkline dailyAir={trend.dailyAir} direction={trend.direction} />

        <div role="group" aria-label={b.airTrendWidgetSevenDayAria}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, opacity: 0.8 }}>{b.airTrendWidgetSevenDayLabel}</p>
          <p
            style={{
              margin: 0,
              fontSize: 40,
              fontWeight: 800,
              lineHeight: 1.05,
              fontVariantNumeric: "tabular-nums",
              color: "var(--arena-text, #1e2a38)",
            }}
          >
            {scorePct}
            <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 4, opacity: 0.75 }}>%</span>
          </p>
        </div>
      </div>

      {certifiedCountdown != null ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "#5b4a2a",
            padding: "10px 12px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #f4e8c8, #f0e4c0)",
            border: "1px solid rgba(180, 150, 80, 0.35)",
          }}
        >
          {b.airTrendWidgetCertifiedExpiryPrefix}{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{certifiedCountdown}</span>
        </p>
      ) : null}
    </section>
  );
}
