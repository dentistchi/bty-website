"use client";

import { useEffect, useState } from "react";
import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
import type { MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { WeeklyActivityDetail } from "@/lib/bty/daily/weeklyActivity.server";

/**
 * MeWeeklyTrace (Slice 3.2C-B3A.2D-R2) — the Me Orb is the LIVING seven-light weekly trace
 * ({@link WeeklyOrb}, NOT the startup entry Orb): one continuously-moving light per BTY day in the
 * current 7-day window. A short TAP toggles an INLINE weekly popover anchored above the Orb — no
 * route, no meView change, no nested screen, no hold-to-enter. The WeeklyOrb is mounted ONCE with
 * stable identity so toggling the popup never remounts it, never spawns a second canvas / rAF loop,
 * and never interrupts or accelerates the animation. The startup Orb is untouched by this file.
 *
 * Data: the SAME canonical endpoint (?detail=1). Fetched once per mount and per Me-reselect
 * (refreshKey) — never per frame / per light movement. Center reflection bodies are never fetched.
 */

const COPY = {
  en: {
    show: "Show this week",
    hide: "Hide this week",
    title: "This week",
    points: "Weekly points",
    activeDays: "Active days",
    learning: "Learning completed",
    training: "Training created",
    center: "Center reflections",
    actions: "Action plans done",
    activity: "Activity recorded",
    noActivity: "No activity recorded",
  },
  ko: {
    show: "이번 주 보기",
    hide: "이번 주 닫기",
    title: "이번 주",
    points: "주간 포인트",
    activeDays: "활동일",
    learning: "완료한 학습",
    training: "생성한 교육",
    center: "센터 성찰",
    actions: "완료한 행동 계획",
    activity: "활동 기록됨",
    noActivity: "활동 없음",
  },
};

function deviceTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
function fmtDate(iso: string, loc: string): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
function fmtWeekday(iso: string, loc: string): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { weekday: "narrow" });
  } catch {
    return "";
  }
}

export default function MeWeeklyTrace({
  locale,
  weeklyRhythm,
  refreshKey,
}: {
  locale: string;
  weeklyRhythm: MeWeeklyRhythm;
  refreshKey?: number;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [detail, setDetail] = useState<WeeklyActivityDetail | null>(null);
  const popupId = "me-week-popup"; // single instance on the Me root

  // Fetch the canonical detail ONCE per mount / Me-reselect (refreshKey). Never on toggle or frame.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tz = deviceTz();
        const res = await fetch(`/api/me/today/weekly-activity?detail=1${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as WeeklyActivityDetail;
          if (!cancelled) setDetail(d);
        }
      } catch {
        /* fail-soft → the Orb still animates; the popup shows whatever loaded */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Me-reselect (refreshKey change) closes the popup and clears any day selection — the shell's
  // canonical root-reselect contract. This is the only case where the popup is open while the
  // component stays mounted (opening a row / switching tabs unmounts me-home entirely).
  useEffect(() => {
    setOpen(false);
    setSelectedDay(null);
  }, [refreshKey]);

  const s = detail?.summary ?? {};
  const attendance = detail?.attendance;
  const range = attendance && attendance.length === 7 ? `${fmtDate(attendance[0].date, loc)} – ${fmtDate(attendance[6].date, loc)}` : null;

  const rows: Array<[string, number | undefined]> = [
    [t.points, typeof s.weeklyPoints === "number" ? s.weeklyPoints : undefined],
    [t.activeDays, typeof s.activeDays === "number" ? s.activeDays : undefined],
    [t.learning, typeof s.trainingsCompleted === "number" ? s.trainingsCompleted : undefined],
    [t.training, typeof s.trainingsCreated === "number" ? s.trainingsCreated : undefined],
    [t.center, typeof s.centerReflections === "number" ? s.centerReflections : undefined],
    [t.actions, typeof s.actionPlansCompleted === "number" ? s.actionPlansCompleted : undefined],
  ];

  return (
    <div className="relative flex flex-col items-center" data-testid="me-weekly-trace">
      {/* Inline popover — anchored ABOVE the Orb, does not cover the Orb hit target, stays clear of
          the bottom dock (rendered inside <main>, which the dock always paints over). */}
      {open ? (
        <div
          id={popupId}
          role="region"
          aria-label={t.title}
          data-testid="me-week-popup"
          className="absolute bottom-full left-1/2 z-20 mb-3 w-[min(20rem,88vw)] -translate-x-1/2 rounded-2xl border border-white/12 bg-[#12161f]/95 px-4 py-3 shadow-xl backdrop-blur-sm"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/50">{t.title}</span>
            {range ? <span className="text-[0.72rem] text-white/45" data-testid="me-week-range">{range}</span> : null}
          </div>

          <div className="mt-2 flex flex-col gap-1">
            {rows.map(([label, value]) =>
              typeof value === "number" ? (
                <div key={label} className="flex items-baseline justify-between gap-3 text-[0.8rem]">
                  <span className="text-white/60">{label}</span>
                  <span className="font-semibold text-white/85">{value}</span>
                </div>
              ) : null,
            )}
          </div>

          {attendance && attendance.length > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-1" data-testid="me-week-days">
              {attendance.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDay(selectedDay === i ? null : i)}
                  className="flex flex-col items-center gap-1"
                  aria-label={`${fmtDate(d.date, loc)} — ${d.active ? t.activity : t.noActivity}`}
                >
                  <span className="text-[0.58rem] text-white/35">{fmtWeekday(d.date, loc)}</span>
                  <span className={`h-3 w-3 rounded-full ${d.active ? "bg-[#E5B769]" : "border border-white/20 bg-transparent"} ${selectedDay === i ? "ring-2 ring-white/40" : ""}`} />
                </button>
              ))}
            </div>
          ) : null}

          {selectedDay != null && attendance?.[selectedDay] ? (
            <p className="mt-2 text-[0.78rem] text-white/70" data-testid="me-week-day-detail">
              {fmtDate(attendance[selectedDay].date, loc)} · {attendance[selectedDay].active ? t.activity : t.noActivity}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The living seven-light Orb IS the toggle control. Mounted once (stable identity) so the
          popup toggle never remounts it or restarts its animation. Touch-safe (B3A.2D protections). */}
      <button
        type="button"
        data-testid="me-weekly-orb-toggle"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-label={open ? t.hide : t.show}
        onClick={() => setOpen((v) => !v)}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={
          {
            touchAction: "manipulation",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitUserDrag: "none",
            WebkitTapHighlightColor: "transparent",
          } as React.CSSProperties
        }
        className="select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <WeeklyOrb intensities={weeklyRhythm} locale={loc} size={200} />
      </button>
    </div>
  );
}
