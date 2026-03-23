"use client";

/**
 * Integrity score card: GET `/api/bty/center/integrity-scorecard`, weighted AIR / LRI / resilience bars,
 * `realtime` on `integrity_score_cards` → refetch; grade letter **300ms** fade on change.
 * Delta vs prior in-memory snapshot (table is one row per user — no history column).
 */

import React from "react";
import { getSupabase } from "@/lib/supabase";
import type { IntegrityGrade, IntegrityScoreCard } from "@/engine/integration/integrity-score-card.service";
import type { Locale } from "@/lib/i18n";

const STYLE_ID = "integrity-score-card-widget";

const GRADE_BG: Record<IntegrityGrade, string> = {
  A: "#0d9488",
  B: "#14b8a6",
  C: "#f59e0b",
  D: "#dc2626",
};

function gradeRank(g: IntegrityGrade): number {
  switch (g) {
    case "A":
      return 4;
    case "B":
      return 3;
    case "C":
      return 2;
    case "D":
      return 1;
    default:
      return 0;
  }
}

export type IntegrityScoreCardWidgetProps = {
  userId: string;
  locale?: Locale | string;
  className?: string;
};

export function IntegrityScoreCardWidget({ userId, locale = "en", className }: IntegrityScoreCardWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const [card, setCard] = React.useState<IntegrityScoreCard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [gradeAnimKey, setGradeAnimKey] = React.useState(0);
  const [delta, setDelta] = React.useState<{ composite: number; grade: number } | null>(null);
  const priorRef = React.useRef<IntegrityScoreCard | null>(null);

  const load = React.useCallback(async () => {
    if (!userId.trim()) {
      setErr(loc === "ko" ? "사용자 없음" : "Missing user");
      setLoading(false);
      return;
    }
    setErr(null);
    try {
      const qs = new URLSearchParams({ userId: userId.trim() });
      const res = await fetch(`/api/bty/center/integrity-scorecard?${qs.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { integrityScoreCard?: IntegrityScoreCard; error?: string };
      if (!res.ok || !json.integrityScoreCard) {
        throw new Error(json.error ?? "LOAD_FAILED");
      }
      const next = json.integrityScoreCard;
      const prev = priorRef.current;
      if (prev && prev.computedAt !== next.computedAt) {
        setDelta({
          composite: next.compositeScore - prev.compositeScore,
          grade: gradeRank(next.overall_integrity_grade) - gradeRank(prev.overall_integrity_grade),
        });
        if (prev.overall_integrity_grade !== next.overall_integrity_grade) {
          setGradeAnimKey((k) => k + 1);
        }
      } else {
        setDelta(null);
      }
      priorRef.current = next;
      setCard(next);
    } catch {
      setErr(loc === "ko" ? "무결성 카드를 불러오지 못했습니다." : "Could not load integrity score card.");
      setCard(null);
      setDelta(null);
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
      .channel(`integrity_score_cards:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "integrity_score_cards",
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

  if (loading && !card) {
    return (
      <div className={className} role="status" aria-busy="true">
        <p className="m-0 text-sm text-slate-500">{loc === "ko" ? "불러오는 중…" : "Loading…"}</p>
      </div>
    );
  }

  if (err || !card) {
    return (
      <div className={className} role="alert">
        <p className="m-0 text-sm text-red-600">{err ?? "—"}</p>
      </div>
    );
  }

  const g = card.overall_integrity_grade;
  const r = card.report;

  const ts = new Date(card.computedAt).toLocaleString(loc === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ""}`}
      role="region"
      aria-label={loc === "ko" ? "무결성 점수 카드" : "Integrity score card"}
    >
      <style id={STYLE_ID}>{`
        @keyframes isc-grade-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .isc-grade-letter {
          animation: isc-grade-fade 300ms ease;
        }
      `}</style>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {loc === "ko" ? "무결성 등급" : "Integrity grade"}
          </p>
          <p className="mt-1 m-0 text-xs text-slate-500">
            {loc === "ko" ? "산출 시각" : "Computed"}: <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{ts}</span>
          </p>
        </div>
        <div
          key={`${g}-${card.computedAt}-${gradeAnimKey}`}
          className="isc-grade-letter flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl font-black text-white shadow-inner"
          style={{ backgroundColor: GRADE_BG[g] }}
          aria-hidden
        >
          {g}
        </div>
      </div>

      {delta && (delta.composite !== 0 || delta.grade !== 0) ? (
        <div
          className="mb-3 flex items-center gap-2 text-sm font-semibold"
          role="status"
          aria-label={
            loc === "ko"
              ? `변화 ${delta.composite >= 0 ? "상승" : "하락"} ${Math.abs(delta.composite).toFixed(1)}`
              : `Change ${delta.composite >= 0 ? "up" : "down"} ${Math.abs(delta.composite).toFixed(1)}`
          }
        >
          <span className="text-lg" aria-hidden>
            {delta.composite !== 0
              ? delta.composite > 0
                ? "↑"
                : "↓"
              : delta.grade !== 0
                ? delta.grade > 0
                  ? "↑"
                  : "↓"
                : "→"}
          </span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {delta.composite > 0 ? "+" : ""}
            {delta.composite.toFixed(1)} {loc === "ko" ? "점" : "pts"}
            {delta.grade !== 0 ? (
              <span className="ml-2 text-xs font-normal text-slate-500">
                ({loc === "ko" ? "등급" : "grade"} {delta.grade > 0 ? "+" : ""}
                {delta.grade})
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span>{loc === "ko" ? "AIR 기여 (40%)" : "AIR contribution (40%)"}</span>
            <span className="tabular-nums">{Math.round(r.airPct)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, r.airPct))}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span>{loc === "ko" ? "LRI 기여 (30%)" : "LRI contribution (30%)"}</span>
            <span className="tabular-nums">{Math.round(r.lriPct)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, r.lriPct))}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span>{loc === "ko" ? "회복력 기여 (30%)" : "Resilience contribution (30%)"}</span>
            <span className="tabular-nums">{Math.round(r.resiliencePct)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, r.resiliencePct))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrityScoreCardWidget;
