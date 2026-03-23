"use client";

/**
 * Center — weekly AIR report (`getWeeklyReport`), AIR sparkline (`AirTrendSparkline`), completion ring,
 * streak, flag-type mix bar, phase gates (`getPhaseGateStatus` via API), CTA when gates incomplete,
 * Realtime `weekly_report_ready` refresh.
 * Integrity grade/composite from `getIntegrityScoreCard` (`/api/center/weekly-report-card` payload;
 * standalone: GET `/api/bty/center/integrity-scorecard`).
 */

import React from "react";
import Link from "next/link";
import { AirTrendSparkline } from "@/components/dashboard/AirTrendSparkline";
import { getSupabase } from "@/lib/supabase";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { mondayUtcWeekOf } from "@/engine/integrity/weekly-air-report.service";
import type { WeeklyAIRReport } from "@/engine/integrity/weekly-air-report.service";
import type { AIRTrendDirection } from "@/engine/integrity/air-trend.service";
import type { PhaseGateStatus } from "@/engine/healing/healing-content.service";
import type { HealingPhase } from "@/engine/healing/healing-phase.service";
import {
  WEEKLY_REPORT_REALTIME_CHANNEL_PREFIX,
  WEEKLY_REPORT_READY_EVENT,
} from "@/lib/bty/center/weekly-report-realtime";
import type { IntegrityScoreCard } from "@/engine/integration/integrity-score-card.service";
import { IntegrityScoreCardWidget } from "@/components/center/IntegrityScoreCardWidget";

export type WeeklyReportCardApi = {
  weekOf: string;
  report: WeeklyAIRReport | null;
  dailyAir: number[];
  airTrendDirection: AIRTrendDirection;
  currentPhase: HealingPhase;
  phaseGate: PhaseGateStatus;
  phaseGates: PhaseGateStatus[];
  anyPhaseGateIncomplete: boolean;
  integrityScoreCard: IntegrityScoreCard;
};

function phaseLabel(phase: HealingPhase, loc: "ko" | "en"): string {
  const map: Record<HealingPhase, [string, string]> = {
    ACKNOWLEDGEMENT: ["인지", "Acknowledgement"],
    REFLECTION: ["성찰", "Reflection"],
    REINTEGRATION: ["재통합", "Reintegration"],
    RENEWAL: ["갱신", "Renewal"],
  };
  return loc === "ko" ? map[phase][0] : map[phase][1];
}

function flagMixPercents(breakdown: Record<string, number>): { hero: number; integrity: number; clean: number; total: number } {
  let hero = 0;
  let integrity = 0;
  let rest = 0;
  for (const [k, v] of Object.entries(breakdown)) {
    const u = k.toUpperCase();
    const n = Number(v) || 0;
    if (u === "HERO_TRAP" || u.includes("HERO_TRAP")) hero += n;
    else if (u === "INTEGRITY_SLIP" || u.includes("INTEGRITY_SLIP")) integrity += n;
    else rest += n;
  }
  const total = hero + integrity + rest;
  if (total <= 0) return { hero: 0, integrity: 0, clean: 0, total: 0 };
  return {
    hero: hero / total,
    integrity: integrity / total,
    clean: rest / total,
    total,
  };
}

function CompletionRing({ pct }: { pct: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  const offset = c * (1 - p);
  return (
    <svg width={112} height={112} viewBox="0 0 112 112" aria-hidden>
      <circle cx="56" cy="56" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        stroke="#0d9488"
        strokeWidth="10"
        strokeLinecap="round"
        transform="rotate(-90 56 56)"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.45s ease" }}
      />
      <text x="56" y="62" textAnchor="middle" fontSize="20" fontWeight={800} fill="#0f172a">
        {Math.round(p * 100)}%
      </text>
    </svg>
  );
}

export type WeeklyReportCardProps = {
  userId: string;
  locale: Locale | string;
  /** Monday UTC YYYY-MM-DD; defaults to current ISO week. */
  weekOf?: string;
};

export function WeeklyReportCard({ userId, locale, weekOf: weekOfProp }: WeeklyReportCardProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const defaultWeek = React.useMemo(() => mondayUtcWeekOf(new Date()), []);
  const weekOf = weekOfProp?.trim() || defaultWeek;

  const [data, setData] = React.useState<WeeklyReportCardApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!userId.trim()) {
      setError(b.weeklyReportCardError);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const qs = new URLSearchParams({
        userId: userId.trim(),
        weekOf,
      });
      const res = await fetch(`/api/center/weekly-report-card?${qs.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as WeeklyReportCardApi & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      setData(json);
    } catch {
      setError(b.weeklyReportCardError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, weekOf, b.weeklyReportCardError]);

  React.useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`${WEEKLY_REPORT_REALTIME_CHANNEL_PREFIX}${uid}`)
      .on(
        "broadcast",
        { event: WEEKLY_REPORT_READY_EVENT },
        (msg: { payload?: { userId?: string } }) => {
          if (msg.payload?.userId === uid) void load();
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId, load]);

  if (loading && !data) {
    return (
      <section role="status" aria-busy="true" aria-label={b.weeklyReportCardLoading}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{b.weeklyReportCardLoading}</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section role="alert" aria-label={b.weeklyReportCardRegionAria}>
        <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error ?? b.weeklyReportCardError}</p>
      </section>
    );
  }

  const report = data.report;
  const completion = report != null ? Math.max(0, Math.min(1, report.completion_rate)) : 0;
  const streak = report?.streak ?? 0;
  const breakdown = report?.flag_type_breakdown ?? {};
  const mix = flagMixPercents(breakdown);
  const sparkDirection = report?.trend ?? data.airTrendDirection;

  return (
    <section
      role="region"
      aria-label={b.weeklyReportCardRegionAria}
      style={{
        display: "grid",
        gap: 16,
        padding: "18px 16px",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: "var(--center-card, #fafafa)",
        maxWidth: 520,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{b.weeklyReportCardTitle}</h2>
        <span style={{ fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
          {b.weeklyReportCardWeekLabel}: {data.weekOf}
        </span>
      </div>

      <div
        role="group"
        aria-label={b.weeklyReportCardIntegrityRegionAria}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "12px 14px",
          borderRadius: 12,
          background: "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(99,102,241,0.06))",
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
            {b.weeklyReportCardIntegrityLabel}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
            {b.weeklyReportCardIntegritySubline
              .replace("{grade}", data.integrityScoreCard.overall_integrity_grade)
              .replace("{score}", String(Math.round(data.integrityScoreCard.compositeScore)))}
          </p>
        </div>
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            lineHeight: 1,
            color: "#0f172a",
            fontVariantNumeric: "tabular-nums",
            minWidth: 44,
            textAlign: "center",
          }}
          aria-hidden
        >
          {data.integrityScoreCard.overall_integrity_grade}
        </span>
      </div>

      {!report ? (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{b.weeklyReportCardNoReport}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.85fr)",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            AIR (30d)
          </p>
          <AirTrendSparkline dailyAir={data.dailyAir} direction={sparkDirection} height={80} />
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
            {b.weeklyReportCardCompletionLabel}
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <CompletionRing pct={completion} />
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label={b.weeklyReportCardResilienceLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(59, 130, 246, 0.08)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>{b.weeklyReportCardResilienceLabel}</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#1e3a8a", fontVariantNumeric: "tabular-nums" }}>
          {data.integrityScoreCard.report.resilience.score}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>/ 100</span>
      </div>

      <IntegrityScoreCardWidget userId={userId} locale={locale} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{b.weeklyReportCardStreakLabel}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(13, 148, 136, 0.12)",
            color: "#0f766e",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {b.weeklyReportCardStreakDays.replace("{n}", String(streak))}
        </span>
      </div>

      <div role="group" aria-label={b.weeklyReportCardFlagBarAria}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
          {b.weeklyReportCardFlagBarAria}
        </p>
        <div
          style={{
            display: "flex",
            height: 12,
            borderRadius: 8,
            overflow: "hidden",
            background: "#e2e8f0",
          }}
        >
          <div style={{ width: `${mix.hero * 100}%`, background: "#ea580c", minWidth: mix.hero > 0 ? 2 : 0 }} title={b.weeklyReportCardFlagHero} />
          <div
            style={{ width: `${mix.integrity * 100}%`, background: "#dc2626", minWidth: mix.integrity > 0 ? 2 : 0 }}
            title={b.weeklyReportCardFlagIntegrity}
          />
          <div style={{ width: `${mix.clean * 100}%`, background: "#94a3b8", minWidth: mix.clean > 0 ? 2 : 0 }} title={b.weeklyReportCardFlagClean} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#475569", flexWrap: "wrap" }}>
          <span>
            <span style={{ color: "#ea580c", fontWeight: 700 }}>■</span> {b.weeklyReportCardFlagHero}{" "}
            {mix.total ? `${Math.round(mix.hero * 100)}%` : "—"}
          </span>
          <span>
            <span style={{ color: "#dc2626", fontWeight: 700 }}>■</span> {b.weeklyReportCardFlagIntegrity}{" "}
            {mix.total ? `${Math.round(mix.integrity * 100)}%` : "—"}
          </span>
          <span>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>■</span> {b.weeklyReportCardFlagClean}{" "}
            {mix.total ? `${Math.round(mix.clean * 100)}%` : "—"}
          </span>
        </div>
      </div>

      <div role="group" aria-label={b.weeklyReportCardPhaseLabel}>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
          {b.weeklyReportCardPhaseLabel}: {phaseLabel(data.currentPhase, loc)}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(data.phaseGate.completion_pct * 100)}
          aria-label={b.weeklyReportCardPhaseLabel}
          style={{ height: 10, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}
        >
          <div
            style={{
              width: `${Math.round(data.phaseGate.completion_pct * 100)}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #6366f1, #a78bfa)",
              transition: "width 0.35s ease",
            }}
          />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>
          {data.phaseGate.completed}/{data.phaseGate.required}{" "}
          {loc === "ko" ? "진단 항목 완료" : "diagnostics complete"}
        </p>
      </div>

      {data.anyPhaseGateIncomplete ? (
        <Link
          href={`/${loc}/assessment`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 14,
            background: "#0d9488",
            color: "#fff",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {b.weeklyReportCardCtaStart}
        </Link>
      ) : null}
    </section>
  );
}
