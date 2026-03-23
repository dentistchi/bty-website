"use client";

/**
 * Center — GET `/api/bty/center/resilience`, grade ring, component breakdown, milestone dots,
 * Realtime `user_resilience_scores` INSERT → refetch + score count-up, Dr. Chi CTA → `/[locale]/bty/mentor`.
 */

import React from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";
import type { ResilienceScoreCardApi } from "@/engine/resilience/resilience-tracker.service";

const MILESTONE_LEVELS = [25, 50, 75, 100] as const;

function ringColor(score: number): string {
  if (score < 40) return "#ef4444";
  if (score < 75) return "#f59e0b";
  return "#14b8a6";
}

function GradeRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, score / 100));
  const offset = c * (1 - p);
  const stroke = ringColor(score);
  return (
    <svg width={140} height={140} viewBox="0 0 140 140" aria-hidden className="shrink-0">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="12"
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.55s ease, stroke 0.35s ease" }}
      />
    </svg>
  );
}

function useAnimatedScore(target: number): number {
  const [display, setDisplay] = React.useState(0);
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const t0 = performance.now();
    const dur = 520;
    let id = 0;
    const tick = () => {
      const u = Math.min(1, (performance.now() - t0) / dur);
      const eased = u * u * (3 - 2 * u);
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (u < 1) id = requestAnimationFrame(tick);
      else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target]);

  return display;
}

export type ResilienceScoreCardProps = {
  userId: string;
  locale: Locale | string;
  /** Route locale segment e.g. `ko` — mentor href `/${routeLocale}/bty/mentor` */
  routeLocale: string;
};

export function ResilienceScoreCard({ userId, locale, routeLocale }: ResilienceScoreCardProps) {
  const loc = locale === "ko" ? "ko" : "en";

  const [data, setData] = React.useState<ResilienceScoreCardApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const scoreTarget = data?.score ?? 0;
  const displayScore = useAnimatedScore(scoreTarget);

  const load = React.useCallback(async () => {
    if (!userId.trim()) {
      setError(loc === "ko" ? "사용자 정보가 없습니다." : "Missing user.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/bty/center/resilience", { credentials: "include" });
      const json = (await res.json()) as ResilienceScoreCardApi & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      setData(json);
    } catch {
      setError(loc === "ko" ? "회복력 지수를 불러오지 못했습니다." : "Could not load resilience score.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, loc]);

  React.useEffect(() => {
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
      .channel(`resilience_scores:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_resilience_scores",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId, load]);

  if (loading && !data) {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
        aria-busy="true"
        aria-label={loc === "ko" ? "회복력 지수 로딩" : "Loading resilience score"}
      >
        <p className="m-0 text-center text-sm text-slate-500">
          {loc === "ko" ? "불러오는 중…" : "Loading…"}
        </p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5" role="alert">
        <p className="m-0 text-center text-sm text-red-700">{error ?? "—"}</p>
      </section>
    );
  }

  const mentorHref = `/${routeLocale}/bty/mentor`;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label={loc === "ko" ? "회복력 지수 카드" : "Resilience score card"}
    >
      <div className="flex flex-col items-center gap-4">
        <p className="m-0 text-center text-xs font-bold uppercase tracking-widest text-slate-500">
          {loc === "ko" ? "회복력 지수" : "Resilience index"}
        </p>

        <div className="relative flex items-center justify-center">
          <GradeRing score={data.score} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-5xl font-black tabular-nums text-slate-900"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {displayScore}
            </span>
            <span className="text-xs font-semibold text-slate-400">/ 100</span>
          </div>
        </div>

        <ul className="w-full max-w-sm space-y-2 text-sm text-slate-700">
          <li className="flex justify-between gap-3 border-b border-slate-100 pb-2">
            <span className="text-slate-500">
              {loc === "ko" ? "연속 CLEAN 선택" : "Consecutive CLEAN choices"}
            </span>
            <span className="font-semibold tabular-nums">{data.consecutive_clean_choices}</span>
          </li>
          <li className="flex justify-between gap-3 border-b border-slate-100 pb-2">
            <span className="text-slate-500">
              {loc === "ko" ? "회복 속도 (평균 일수)" : "Recovery speed (avg days)"}
            </span>
            <span className="font-semibold tabular-nums">
              {data.integrity_slip_count > 0
                ? data.recovery_avg_days.toLocaleString(loc === "ko" ? "ko-KR" : "en-US", {
                    maximumFractionDigits: 1,
                  })
                : "—"}
            </span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-slate-500">
              {loc === "ko" ? "힐링 단계 진행" : "Healing phase progress"}
            </span>
            <span className="font-semibold tabular-nums">{data.center_phase_completions}</span>
          </li>
        </ul>

        <div className="w-full max-w-xs">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {loc === "ko" ? "마일스톤" : "Milestones"}
          </p>
          <div className="flex justify-between gap-2 px-1">
            {MILESTONE_LEVELS.map((m) => {
              const reached = data.score >= m;
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className="h-3 w-3 rounded-full transition-colors duration-300"
                    style={{
                      background: reached ? "#14b8a6" : "#e2e8f0",
                      boxShadow: reached ? "0 0 0 2px rgba(20,184,166,0.25)" : undefined,
                    }}
                    title={`${m}`}
                    aria-label={
                      loc === "ko"
                        ? `${m} ${reached ? "달성" : "미달성"}`
                        : `${m} ${reached ? "reached" : "not reached"}`
                    }
                  />
                  <span className="text-[10px] font-semibold tabular-nums text-slate-400">{m}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Link
          href={mentorHref}
          className="mt-1 inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
        >
          {loc === "ko" ? "Dr. Chi와 이야기하기" : "Talk with Dr. Chi"}
        </Link>
      </div>
    </section>
  );
}
