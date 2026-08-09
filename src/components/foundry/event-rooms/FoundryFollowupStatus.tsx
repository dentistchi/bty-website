"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Slice 3.2M-3 — the behaviour the report is about; without it "Applied" says applied to what? */
  subject?: string | null;
  /** Earlier truthful check-ins, oldest first, excluding the current answer. */
  history?: { outcome: Outcome; at: string }[];
  /** Slice 3.2M-4 — what someone ELSE reported. Never merged with the learner's own words. */
  observation?: {
    observed: boolean;
    observerCount: number;
    latestAt: string | null;
    observerHistory: { outcome: "OBSERVED" | "NOT_OBSERVED" | "UNABLE_TO_TELL"; at: string }[];
    /** Slice 3.2M-5 — repetition over time, derived server-side from OCCURRENCE dates. */
    sustained?: boolean;
    firstObservedOn?: string | null;
    lastObservedOn?: string | null;
    distinctPositiveDates?: number;
  };
};

const COPY: Record<Locale, {
  title: string;
  checkpoint: (n: number) => string;
  due: string;
  states: Record<State, string>;
  reported: string;
  subjectLabel: string;
  earlier: string;
  selfReportNote: string;
  observationHeading: string;
  observedBy: (n: number) => string;
  seenMoreThanOnce: (first: string, last: string) => string;
  sustainedAcross: (first: string, last: string) => string;
  noObservation: string;
  observerSaidNot: string;
  observerUnsure: string;
  outcomes: Record<Outcome, string>;
  awaiting: string;
}> = {
  en: {
    title: "Follow-up status",
    checkpoint: (n) => `${n}-day follow-up`,
    due: "Due",
    states: { pending: "Upcoming", due: "Due today", overdue: "Overdue", responded: "Responded" },
    reported: "Learner reported",
    subjectLabel: "They were asked to",
    earlier: "Earlier they reported",
    selfReportNote: "Their own report — nobody else confirmed it.",
    observationHeading: "Independent observation",
    observedBy: (n) => (n === 1 ? "One colleague saw or heard this" : `${n} colleagues saw or heard this`),
    seenMoreThanOnce: (first, last) => `Seen more than once · first ${first} · most recent ${last}`,
    // PAST TENSE, WITH ITS DATES. Not "is sustained" — a span that happened, which is the only
    // thing the evidence says. It never means the behaviour is still happening today.
    sustainedAcross: (first, last) => `Sustained across ${first}–${last}`,
    noObservation: "No independent observation yet",
    observerSaidNot: "A colleague reported they did not see it",
    observerUnsure: "A colleague could not tell",
    outcomes: { APPLIED: "Applied", PARTLY_APPLIED: "Partly applied", NOT_YET: "Not yet", BLOCKED: "Blocked" },
    awaiting: "Awaiting learner response",
  },
  ko: {
    subjectLabel: "요청받은 행동",
    earlier: "이전 보고",
    selfReportNote: "본인이 직접 보고한 내용이며, 제3자가 확인한 것은 아닙니다.",
    observationHeading: "제3자 관찰",
    observedBy: (n) => `동료 ${n}명이 직접 보거나 들었습니다`,
    seenMoreThanOnce: (first, last) => `여러 번 관찰됨 · 처음 ${first} · 최근 ${last}`,
    sustainedAcross: (first, last) => `${first}–${last} 기간에 걸쳐 지속됨`,
    noObservation: "아직 제3자 관찰 없음",
    observerSaidNot: "동료가 보지 못했다고 보고했습니다",
    observerUnsure: "동료가 판단할 수 없었습니다",
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

/**
 * Format an OCCURRENCE day key ("YYYY-MM-DD"), not an instant (Slice 3.2M-5).
 *
 * Rendered in UTC from the key's own components so the date a colleague reported is the date a
 * Host reads. Passing it through the reader's zone could shift it by a day and quietly change
 * what the evidence says.
 */
function fmtDayKey(dayKey: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return "";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(
    locale === "ko" ? "ko-KR" : "en-US",
    { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
  );
}

/**
 * WHEN THEY SAW IT, NOT WHEN THEY TOLD US (Slice 3.2M-5).
 *
 * The 3.2M-4 line printed `latestAt`, which is the submission timestamp. Once occurrence dates
 * existed, a live Host read "One colleague saw or heard this · Aug 9" directly above "Sustained
 * across Jul 20–Jul 27" — two different date meanings on adjacent lines, and the first one
 * invited exactly the wrong reading: that the sighting happened on the day it was filed.
 *
 * So the line prefers the most recent OCCURRENCE date. `latestAt` remains the fallback for a
 * payload that predates the occurrence field, where the filing date is the only date there is.
 */
function observedOnLabel(
  o: { lastObservedOn?: string | null; latestAt: string | null },
  locale: Locale,
): string {
  if (o.lastObservedOn) return fmtDayKey(o.lastObservedOn, locale);
  return o.latestAt ? fmtDate(o.latestAt, locale) : "";
}

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function FoundryFollowupStatus({
  eventId,
  locale,
  focusFollowupId,
}: {
  eventId: string;
  locale: Locale;
  /** Host Leadership Attention deep link (Slice 3.1B-3L): scroll to + highlight this followup row. */
  focusFollowupId?: string;
}) {
  const t = COPY[locale];
  const [rows, setRows] = useState<Row[] | null>(null);
  // Scroll the deep-linked row into view exactly once (after the async rows load), then keep it
  // highlighted so the Host understands where the Today link landed. Presentation only.
  const scrolledRef = useRef(false);
  const setFocusEl = (el: HTMLLIElement | null) => {
    if (el && !scrolledRef.current) {
      scrolledRef.current = true;
      try {
        el.scrollIntoView({ block: "center" });
      } catch {
        /* non-DOM env — no-op */
      }
    }
  };

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
        {rows.map((r) => {
          const isFocused = Boolean(focusFollowupId) && r.followupId === focusFollowupId;
          return (
          <li
            key={r.followupId}
            ref={isFocused ? setFocusEl : undefined}
            data-testid="followup-status-row"
            data-state={r.state}
            data-focused={isFocused ? "true" : undefined}
            className={
              "flex flex-col gap-1 rounded-xl border bg-white/[0.02] px-3 py-2 " +
              (isFocused ? "border-[#C9A66B]/60 ring-2 ring-[#C9A66B]/40" : "border-white/8")
            }
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
            {/* What they were asked to do — the report is meaningless without it. */}
            {r.subject ? (
              <span className="text-xs leading-5 text-white/55" data-testid="followup-subject">
                {t.subjectLabel}: {r.subject}
              </span>
            ) : null}
            {/*
              A SEPARATE SOURCE (Slice 3.2M-4). Kept visually apart from the learner's own
              report so nobody reads "Applied" and "One colleague saw it" as one claim — and
              so a colleague who did NOT see it never looks like confirmation.
            */}
            {r.observation ? (
              <span
                className={"text-xs " + (r.observation.observed ? "text-[#C9A66B]/90" : "text-white/40")}
                data-testid={r.observation.observed ? "host-observed" : "host-not-observed"}
              >
                {t.observationHeading}:{" "}
                {r.observation.observed
                  ? `${t.observedBy(r.observation.observerCount)}${observedOnLabel(r.observation, locale) ? ` · ${observedOnLabel(r.observation, locale)}` : ""}`
                  : r.observation.observerHistory.some((o) => o.outcome === "NOT_OBSERVED")
                    ? t.observerSaidNot
                    : r.observation.observerHistory.some((o) => o.outcome === "UNABLE_TO_TELL")
                      ? t.observerUnsure
                      : t.noObservation}
              </span>
            ) : null}
            {/*
              REPETITION OVER TIME (Slice 3.2M-5) — a SECOND line, never folded into the first.
              "One colleague saw this" and "seen across three weeks" are different claims, and
              merging them would let a single sighting borrow the weight of a span.

              Shown only when there is genuinely more than one occurrence date. The sustained
              wording is past tense with its dates attached: it says a span happened, not that a
              habit was formed, not that it is still happening today.
            */}
            {r.observation && (r.observation.distinctPositiveDates ?? 0) >= 2 && r.observation.firstObservedOn && r.observation.lastObservedOn ? (
              <span
                className={"text-xs " + (r.observation.sustained ? "text-[#C9A66B]" : "text-white/55")}
                data-testid={r.observation.sustained ? "host-sustained" : "host-seen-more-than-once"}
              >
                {(r.observation.sustained ? t.sustainedAcross : t.seenMoreThanOnce)(
                  fmtDayKey(r.observation.firstObservedOn, locale),
                  fmtDayKey(r.observation.lastObservedOn, locale),
                )}
              </span>
            ) : null}
            {r.state === "responded" && r.outcome ? (
              <>
                <span className="text-xs text-white/70" data-testid="followup-status-outcome">
                  {t.reported}: {t.outcomes[r.outcome]}
                </span>
                {/* An earlier honest "not yet" is part of the truth, not something to hide. */}
                {r.history && r.history.length > 0 ? (
                  <span className="text-xs text-white/40" data-testid="followup-history">
                    {t.earlier}: {r.history.map((h) => t.outcomes[h.outcome]).join(" → ")}
                  </span>
                ) : null}
                <span className="text-[0.68rem] text-white/35" data-testid="followup-selfreport-note">
                  {t.selfReportNote}
                </span>
              </>
            ) : (
              <span className="text-xs text-white/40">{t.awaiting}</span>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
