"use client";

/**
 * Admin-only system status: GET `/api/admin/system-health` ({@link getSystemHealth}),
 * Realtime `loop_health_log` INSERT → refresh; POST `/api/admin/smoke-test` full check.
 */

import React from "react";
import { HEALING_PHASE_ORDER } from "@/engine/healing/healing-phase.service";
import type { SystemHealthSnapshot } from "@/engine/integration/system-health-dashboard.service";
import type { SmokeTestReport } from "@/engine/integration/full-system-smoke-test";
import { getSupabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

export type SystemStatusWidgetProps = {
  locale?: Locale | string;
  className?: string;
};

/** Monday-start week: elapsed ms / 7d (0–1). */
function weeklyWeekProgress01(now: Date = new Date()): number {
  const d = now.getDay();
  const offsetToMonday = d === 0 ? -6 : 1 - d;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offsetToMonday);
  monday.setHours(0, 0, 0, 0);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const elapsed = Math.min(weekMs, Math.max(0, now.getTime() - monday.getTime()));
  return elapsed / weekMs;
}

function healingPhaseShort(phase: (typeof HEALING_PHASE_ORDER)[number], loc: "ko" | "en"): string {
  if (loc === "ko") {
    switch (phase) {
      case "ACKNOWLEDGEMENT":
        return "인지";
      case "REFLECTION":
        return "성찰";
      case "REINTEGRATION":
        return "재통합";
      case "RENEWAL":
        return "갱신";
      default:
        return phase;
    }
  }
  switch (phase) {
    case "ACKNOWLEDGEMENT":
      return "ACK";
    case "REFLECTION":
      return "REFL";
    case "REINTEGRATION":
      return "REINT";
    case "RENEWAL":
      return "REN";
    default:
      return phase;
  }
}

export function SystemStatusWidget({ locale = "en", className }: SystemStatusWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const [snapshot, setSnapshot] = React.useState<SystemHealthSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [forbidden, setForbidden] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [smokeRunning, setSmokeRunning] = React.useState(false);
  const [smokeResult, setSmokeResult] = React.useState<SmokeTestReport | null>(null);
  const [smokeError, setSmokeError] = React.useState<string | null>(null);

  const load = React.useCallback(async (refresh: boolean) => {
    setError(null);
    try {
      const q = refresh ? "/api/admin/system-health?refresh=1" : "/api/admin/system-health";
      const res = await fetch(q, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setSnapshot(null);
        return;
      }
      const json = (await res.json()) as { ok?: boolean; snapshot?: SystemHealthSnapshot; error?: string };
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.error ?? "system_health_failed");
      }
      setForbidden(false);
      setSnapshot(json.snapshot);
    } catch {
      setError(loc === "ko" ? "상태를 불러오지 못했습니다." : "Failed to load system status.");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [loc]);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  React.useEffect(() => {
    if (forbidden) return;
    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel("system_status_loop_health_log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "loop_health_log" },
        () => {
          void load(true);
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [forbidden, load]);

  const runSmoke = React.useCallback(async () => {
    setSmokeRunning(true);
    setSmokeError(null);
    setSmokeResult(null);
    try {
      const res = await fetch("/api/admin/smoke-test", { method: "POST", credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; report?: SmokeTestReport; error?: string };
      if (!res.ok || !json.report) {
        throw new Error(json.error ?? "smoke_failed");
      }
      setSmokeResult(json.report);
      void load(true);
    } catch {
      setSmokeError(loc === "ko" ? "점검 실행에 실패했습니다." : "Smoke test failed.");
    } finally {
      setSmokeRunning(false);
    }
  }, [load, loc]);

  if (loading && !snapshot && !forbidden) {
    return (
      <div className={className} role="status" aria-busy="true">
        <p className="m-0 text-sm text-slate-500">{loc === "ko" ? "불러오는 중…" : "Loading…"}</p>
      </div>
    );
  }

  if (forbidden) {
    return null;
  }

  if (error || !snapshot) {
    return (
      <div className={className} role="alert">
        <p className="m-0 text-sm text-red-600">{error ?? (loc === "ko" ? "데이터 없음" : "No data")}</p>
      </div>
    );
  }

  const ratio = snapshot.loopHealthLog24h.passRatio;
  const pct = Math.round(ratio * 100);
  const totalChecks = snapshot.loopHealthLog24h.totalRows;
  const healthOk = totalChecks > 0 && pct >= 80;
  const badgeBg = totalChecks === 0 ? "#64748b" : healthOk ? "#16a34a" : "#dc2626";
  const healing = snapshot.healingPhaseCounts;
  const healingTotal = HEALING_PHASE_ORDER.reduce((a, p) => a + (healing[p] ?? 0), 0);
  const weekPct = Math.round(weeklyWeekProgress01() * 100);

  const l = {
    title: loc === "ko" ? "시스템 상태" : "System status",
    loopHealth: loc === "ko" ? "루프 헬스 (24h)" : "Loop health (24h)",
    ejections: loc === "ko" ? "활성 제외" : "Active ejections",
    elite: loc === "ko" ? "엘리트 후보 대기" : "Pending elite nominations",
    slips: loc === "ko" ? "슬립 복구 미완료" : "Open slip recovery",
    healing: loc === "ko" ? "힐링 단계 분포" : "Healing phase mix",
    weekly: loc === "ko" ? "주간 진행 (주 대비)" : "Weekly progress (week)",
    weeklySub: loc === "ko" ? "이번 주 경과" : "Elapsed this week",
    smoke: loc === "ko" ? "전체 점검 실행" : "Run full smoke test",
    smokeNote: loc === "ko" ? "관리자 전용 · 환경 변수의 스모크 사용자 필요" : "Admin only · requires smoke user in env",
    cache: loc === "ko" ? "캐시" : "Cache",
    hit: loc === "ko" ? "적중" : "hit",
    resets: loc === "ko" ? "시즌 주간 리셋 로그" : "Weekly resets (season)",
    tiiRisk: loc === "ko" ? "팀 TII 저위험 (최근)" : "Team TII risk (recent)",
  };

  const riskSample = snapshot.teamIntegrityRiskSample ?? [];

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ""}`}
      aria-label={l.title}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{l.title}</h2>
        <span className="text-[10px] text-slate-400">
          {l.cache}: {snapshot.cacheHit ? l.hit : "miss"} · {new Date(snapshot.generatedAt).toLocaleString(loc === "ko" ? "ko-KR" : "en-US")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="flex flex-col rounded-lg border border-slate-100 p-2 dark:border-slate-700"
          title={`PASS ${snapshot.loopHealthLog24h.passCount} / FAIL ${snapshot.loopHealthLog24h.failCount}`}
        >
          <span className="text-[10px] font-medium uppercase text-slate-500">{l.loopHealth}</span>
          <span
            className="mt-1 inline-flex w-fit min-w-[3rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
            style={{ background: badgeBg }}
          >
            {totalChecks === 0 ? "—" : `${pct}%`}
          </span>
          <span className="mt-1 text-[10px] text-slate-500">
            {snapshot.loopHealthLog24h.passCount}P / {snapshot.loopHealthLog24h.failCount}F
          </span>
        </div>

        <div className="rounded-lg border border-slate-100 p-2 dark:border-slate-700">
          <span className="text-[10px] font-medium uppercase text-slate-500">{l.ejections}</span>
          <p className="m-0 mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {snapshot.activeEjections}
          </p>
        </div>

        <div className="rounded-lg border border-slate-100 p-2 dark:border-slate-700">
          <span className="text-[10px] font-medium uppercase text-slate-500">{l.elite}</span>
          <p className="m-0 mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {snapshot.pendingEliteSpecNominations}
          </p>
        </div>

        <div className="rounded-lg border border-slate-100 p-2 dark:border-slate-700">
          <span className="text-[10px] font-medium uppercase text-slate-500">{l.slips}</span>
          <p className="m-0 mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {snapshot.openSlipRecoveryTasks}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{l.healing}</p>
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="img"
          aria-label={HEALING_PHASE_ORDER.map((p) => `${p}:${healing[p] ?? 0}`).join(", ")}
        >
          {HEALING_PHASE_ORDER.map((phase, i) => {
            const w = healingTotal === 0 ? 25 : ((healing[phase] ?? 0) / healingTotal) * 100;
            const colors = ["#64748b", "#0ea5e9", "#a855f7", "#22c55e"];
            return (
              <div
                key={phase}
                style={{ width: `${w}%`, background: colors[i % colors.length] }}
                title={`${healingPhaseShort(phase, loc)}: ${healing[phase] ?? 0}`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-400">
          {HEALING_PHASE_ORDER.map((phase, i) => {
            const colors = ["#64748b", "#0ea5e9", "#a855f7", "#22c55e"];
            return (
              <span key={phase} className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: colors[i % colors.length] }} />
                {healingPhaseShort(phase, loc)} {healing[phase] ?? 0}
              </span>
            );
          })}
        </div>
      </div>

      {riskSample.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 p-2 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="m-0 text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-200">{l.tiiRisk}</p>
          <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[10px] text-amber-950 dark:text-amber-100">
            {riskSample.map((r) => (
              <li key={`${r.teamId}-${r.computedAt}`} className="tabular-nums">
                <span className="font-mono">{r.teamId}</span> · {r.riskLevel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase text-slate-500">
          <span>{l.weekly}</span>
          <span className="tabular-nums text-slate-700 dark:text-slate-300">{weekPct}%</span>
        </div>
        <p className="m-0 mb-1 text-[10px] text-slate-500">{l.weeklySub}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={weekPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${weekPct}%` }} />
        </div>
        <p className="mt-1 m-0 text-[10px] text-slate-500">
          {l.resets}: {snapshot.weeklyXpResetsThisSeason}
          {snapshot.activeSeasonNumber != null ? ` · S${snapshot.activeSeasonNumber}` : ""}
        </p>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
        <button
          type="button"
          disabled={smokeRunning}
          onClick={() => void runSmoke()}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {smokeRunning ? (loc === "ko" ? "실행 중…" : "Running…") : loc === "ko" ? "전체 점검 실행" : "Run full smoke test"}
        </button>
        <p className="mt-1 m-0 text-[10px] text-slate-400">{l.smokeNote}</p>
        {smokeError ? <p className="mt-2 m-0 text-xs text-red-600">{smokeError}</p> : null}
        {smokeResult ? (
          <p className="mt-2 m-0 text-xs text-slate-600 dark:text-slate-400">
            {loc === "ko" ? "결과" : "Result"}: {smokeResult.overallOk ? "OK" : "FAIL"} · Arena {smokeResult.arenaOk ? "✓" : "✗"} · Foundry{" "}
            {smokeResult.foundryOk ? "✓" : "✗"} · Center {smokeResult.centerOk ? "✓" : "✗"} · Dashboard {smokeResult.dashboardOk ? "✓" : "✗"} · Health{" "}
            {smokeResult.healthOk ? "✓" : "✗"} · Avatar {smokeResult.avatarOk ? "✓" : "✗"} · Onboarding {smokeResult.onboardingOk ? "✓" : "✗"} · Notifications{" "}
            {smokeResult.notificationsOk ? "✓" : "✗"}
            {smokeResult.errors.length ? ` — ${smokeResult.errors[0]}` : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default SystemStatusWidget;
