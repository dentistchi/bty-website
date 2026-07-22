"use client";

import { useEffect, useState } from "react";
import type { Locale } from "./copy";

/**
 * Host Follow-up Status (Slice 3.1B-3K) — a per-participant read-only section in the event control
 * room. INDEPENDENT of the Shared Question / Shared Understanding gate: a training with a follow-up
 * period and no shared question STILL shows follow-up status here. Self-gates: renders nothing when
 * the event has no follow-up obligations. Shows ONLY: participant identity (already allowed in the
 * control room), checkpoint, due date, derived state, and the LEARNER-REPORTED outcome. NEVER shows
 * Private Reflection, AI interpretation, hidden notes, inferred quality, or any employee score.
 */

type Outcome = "APPLIED" | "PARTLY_APPLIED" | "NOT_YET" | "BLOCKED";
type State = "pending" | "due" | "overdue" | "responded";

type Row = {
  followupId: string;
  displayName: string;
  followUpDays: number;
  dueAt: string;
  state: State;
  outcome: Outcome | null;
  respondedAt: string | null;
};

const COPY: Record<Locale, {
  title: string;
  checkpoint: (n: number) => string;
  due: string;
  states: Record<State, string>;
  reported: string;
  outcomes: Record<Outcome, string>;
  awaiting: string;
}> = {
  en: {
    title: "Follow-up status",
    checkpoint: (n) => `${n}-day follow-up`,
    due: "Due",
    states: { pending: "Upcoming", due: "Due today", overdue: "Overdue", responded: "Responded" },
    reported: "Learner reported",
    outcomes: { APPLIED: "Applied", PARTLY_APPLIED: "Partly applied", NOT_YET: "Not yet", BLOCKED: "Blocked" },
    awaiting: "Awaiting learner response",
  },
  ko: {
    title: "후속 확인 상태",
    checkpoint: (n) => `${n}일 후 확인`,
    due: "기한",
    states: { pending: "예정", due: "오늘 확인", overdue: "기한 지남", responded: "응답함" },
    reported: "학습자 보고",
    outcomes: { APPLIED: "적용함", PARTLY_APPLIED: "일부 적용", NOT_YET: "아직 안 함", BLOCKED: "방해 요인" },
    awaiting: "학습자 응답 대기 중",
  },
};

function fmtDate(iso: string, locale: Locale): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function FoundryFollowupStatus({ eventId, locale }: { eventId: string; locale: Locale }) {
  const t = COPY[locale];
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tz = deviceTz();
        const qs = tz ? `?tz=${encodeURIComponent(tz)}` : "";
        const res = await fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/followups${qs}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; rows?: Row[] };
        if (!cancelled && data?.ok) setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch {
        /* fail-soft — render nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!rows || rows.length === 0) return null; // self-gate: no obligations → no section

  const stateTone = (s: State) =>
    s === "overdue"
      ? "border-red-400/30 text-red-300/80"
      : s === "due"
        ? "border-[#C9A66B]/35 text-[#E5B769]"
        : s === "responded"
          ? "border-emerald-400/30 text-emerald-200/85"
          : "border-white/12 text-white/50";

  return (
    <div className="flex flex-col gap-3" data-testid="foundry-followup-status">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/85">{t.title}</span>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.followupId}
            data-testid="followup-status-row"
            data-state={r.state}
            className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-white/90">{r.displayName}</span>
              <span className={"shrink-0 rounded-md border px-2 py-0.5 text-[0.68rem] " + stateTone(r.state)}>
                {t.states[r.state]}
              </span>
            </div>
            <span className="text-xs text-white/45">
              {t.checkpoint(r.followUpDays)} · {t.due} {fmtDate(r.dueAt, locale)}
            </span>
            {r.state === "responded" && r.outcome ? (
              <span className="text-xs text-white/70" data-testid="followup-status-outcome">
                {t.reported}: {t.outcomes[r.outcome]}
              </span>
            ) : (
              <span className="text-xs text-white/40">{t.awaiting}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
