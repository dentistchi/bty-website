"use client";

import { useEffect, useState } from "react";
import type { MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { WeeklySummary } from "@/lib/bty/daily/weeklyActivity.server";
import { getCachedSummary, setCachedSummary } from "@/lib/bty/daily/weeklyActivityCache";

/**
 * Me · This week (Slice 3.2C-B3A.2D) — the FIRST substantive block on the Me root,
 * visible without scrolling. Identity + Forge stage, then a compact honest weekly
 * summary. Read-only, fail-soft: a metric with no canonical value is OMITTED (never
 * fabricated); a displayed zero is a proven canonical zero. No internal metrics,
 * reason codes, or leadership scores. Attendance dots come from the existing weekly
 * rhythm (self-return presence), not a new source.
 */

const COPY = {
  en: {
    me: "Me",
    stage: (n: number) => `Forge stage ${n}`,
    thisWeek: "This week",
    points: "points",
    activeDays: (n: number) => `${n} active ${n === 1 ? "day" : "days"}`,
    learned: (n: number) => `${n} learned`,
    created: (n: number) => `${n} created`,
    center: (n: number) => `${n} Center`,
    actions: (n: number) => `${n} action ${n === 1 ? "plan" : "plans"}`,
    events: (n: number) => `${n} ${n === 1 ? "event" : "events"} joined`,
    quiet: "A quiet week so far.",
    unavailable: "Couldn't load this week.",
    retry: "Retry",
    loading: "Loading your week…",
  },
  ko: {
    me: "나",
    stage: (n: number) => `포지 스테이지 ${n}`,
    thisWeek: "이번 주",
    points: "포인트",
    activeDays: (n: number) => `활동 ${n}일`,
    learned: (n: number) => `학습 ${n}`,
    created: (n: number) => `생성 ${n}`,
    center: (n: number) => `센터 ${n}`,
    actions: (n: number) => `행동 계획 ${n}`,
    events: (n: number) => `참여한 이벤트 ${n}`,
    quiet: "아직 조용한 한 주입니다.",
    unavailable: "이번 주를 불러오지 못했습니다.",
    retry: "다시 시도",
    loading: "이번 주 불러오는 중…",
  },
};

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function MeThisWeek({
  locale,
  weeklyRhythm,
  refreshKey,
}: {
  locale: string;
  weeklyRhythm: MeWeeklyRhythm;
  /** Bumped on Me-tab reselect (B3A.2D-R1) → re-fetch the canonical weekly summary once. */
  refreshKey?: number;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  // Stale-while-refresh (B3A.2D-R3): seed from the session cache so a bottom-Me reselect (which
  // remounts me-home) keeps the last successful Forge Stage + weekly values visible instead of
  // blanking to the "quiet week" fallback. `loaded` distinguishes an initial no-data mount (may
  // show a quiet loading state) from a proven-empty week.
  const [summary, setSummary] = useState<WeeklySummary | null>(() => getCachedSummary());
  const [loaded, setLoaded] = useState<boolean>(() => getCachedSummary() != null);
  /*
    A LOAD THAT FAILED IS NOT A LOAD STILL RUNNING (Slice A0-RUNTIME2).

    This previously returned early on a non-OK response without ever ending the loading state, so a
    401 rendered "Loading your week…" forever. The Founder met exactly that in the Teams tab, where
    every inline-auth route was refusing. The auth cause is repaired centrally, but a card that can
    spin indefinitely on ANY failure is its own defect — so the four states are now distinct:
    loading, content, proven-empty, and failed-with-retry.

    Stale-while-refresh is preserved: when a cached summary exists, a failure keeps showing it
    rather than replacing real values with an error.
  */
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tz = deviceTz();
        const res = await fetch(`/api/me/today/weekly-activity${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          // Retain the last successful values (never blank), but STOP claiming to be loading.
          setFailed(true);
          return;
        }
        const d = (await res.json()) as { summary?: WeeklySummary | null };
        if (cancelled) return;
        if (d.summary) {
          setSummary(d.summary);
          setCachedSummary(d.summary);
        }
        setFailed(false);
        setLoaded(true);
      } catch {
        // fail-soft → retain the last successful values; the Orb + identity still render
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, attempt]);

  const s = summary ?? {};
  // Attendance dots from the existing weekly rhythm (presence-as-light).
  const dots = Array.isArray(weeklyRhythm) ? weeklyRhythm : [];
  // Compact count chips — only metrics with a canonical numeric value are shown.
  const chips: string[] = [];
  if (typeof s.weeklyPoints === "number") chips.push(`${s.weeklyPoints} ${t.points}`);
  if (typeof s.activeDays === "number") chips.push(t.activeDays(s.activeDays));
  if (typeof s.trainingsCompleted === "number") chips.push(t.learned(s.trainingsCompleted));
  if (typeof s.trainingsCreated === "number") chips.push(t.created(s.trainingsCreated));
  if (typeof s.centerReflections === "number") chips.push(t.center(s.centerReflections));
  if (typeof s.actionPlansCompleted === "number") chips.push(t.actions(s.actionPlansCompleted));
  if (typeof s.eventsParticipated === "number") chips.push(t.events(s.eventsParticipated));

  const stage = typeof s.forgeStage === "number" ? s.forgeStage : null;

  return (
    <section className="flex flex-col gap-2" data-testid="me-this-week">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-white">{t.me}</h1>
        {stage != null ? (
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#C9A66B]/85" data-testid="me-forge-stage">
            · {t.stage(stage)}
          </span>
        ) : null}
      </div>

      {/* R4: This Week is a STATIC semantic summary — NOT a button, not keyboard-focusable, no
          aria-expanded/controls, no popup/disclosure. It shows the canonical weekly values (incl.
          "N event(s) joined"); the summary is sufficient, so there is no second surface to open. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3" data-testid="me-week-summary">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.thisWeek}</span>
        {dots.length > 0 ? (
          <div className="flex items-center gap-1.5" data-testid="me-week-dots" aria-hidden>
            {dots.map((d, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${d > 0 ? "bg-[#E5B769]" : "bg-white/12"}`} />
            ))}
          </div>
        ) : null}
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.82rem] text-white/70" data-testid="me-week-counts">
            {chips.map((c, i) => (
              <span key={i}>
                {i > 0 ? <span className="mr-2.5 text-white/25">·</span> : null}
                {c}
              </span>
            ))}
          </div>
        ) : loaded ? (
          // Proven-empty week (a completed load with no canonical values) — never shown merely
          // because a refresh is pending (that path retains the last values above).
          <p className="text-[0.82rem] text-white/50">{t.quiet}</p>
        ) : failed ? (
          // The load ended and did not succeed. Compact, truthful, and recoverable — never a
          // spinner that outlives its request.
          <p className="flex items-center gap-2 text-[0.82rem] text-white/50" data-testid="me-week-error">
            <span>{t.unavailable}</span>
            <button
              type="button"
              data-testid="me-week-retry"
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
              className="rounded-md border border-white/15 px-2 py-0.5 text-[0.78rem] font-medium text-white/70"
            >
              {t.retry}
            </button>
          </p>
        ) : (
          // Initial no-data mount only — a quiet loading state, not a proven-zero claim.
          <p className="text-[0.82rem] text-white/30" role="status" data-testid="me-week-loading">{t.loading}</p>
        )}
      </div>
    </section>
  );
}
