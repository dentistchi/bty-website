"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
import type { MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { WeeklyActivityDetail } from "@/lib/bty/daily/weeklyActivity.server";
import { getCachedDetail, setCachedDetail } from "@/lib/bty/daily/weeklyActivityCache";
import { choosePopupPlacement } from "@/domain/daily/popupPlacement";

/**
 * MeWeeklyTrace (Slice 3.2C-B3A.2D-R2 · R3 refinements) — the Me Orb is the LIVING seven-light
 * {@link WeeklyOrb} (NOT the startup entry Orb). A short TAP toggles a COMPACT inline popover
 * anchored to the Orb.
 *
 * R3: the popover no longer duplicates the root THIS WEEK counts — it discloses only what the root
 * doesn't (date range + the seven dated day indicators + the selected day's proven activity state).
 * Placement is collision-aware (prefers above, flips below when the top would cross the safe area),
 * so the heading/date range are never clipped. Detail is seeded from the session cache
 * (stale-while-refresh) so a reselect never blanks it. Center reflection bodies are never fetched.
 */

const COPY = {
  en: { show: "Show this week", hide: "Hide this week", title: "This week", activity: "Activity recorded", noActivity: "No activity recorded", events: "Events" },
  ko: { show: "이번 주 보기", hide: "이번 주 닫기", title: "이번 주", activity: "활동 기록됨", noActivity: "활동 없음", events: "이벤트" },
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

// A conservative top safe-area allowance (status bar / notch) for collision math; env() is not
// readable in JS, and over-reserving only makes the popup flip below sooner (never clip).
const SAFE_TOP_PX = 56;

export default function MeWeeklyTrace({
  locale,
  weeklyRhythm,
  refreshKey,
  open: openProp,
  onOpenChange,
}: {
  locale: string;
  weeklyRhythm: MeWeeklyRhythm;
  refreshKey?: number;
  /** R1: optional controlled disclosure so the labeled "This week" card (MeThisWeek) AND the living
   *  Orb drive ONE shared popup. Uncontrolled (prop omitted) keeps the Orb as a self-contained toggle
   *  for standalone renders/tests. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = isControlled ? (openProp as boolean) : openState;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? (next as (v: boolean) => boolean)(open) : next;
    if (!isControlled) setOpenState(value);
    onOpenChange?.(value);
  };
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [detail, setDetail] = useState<WeeklyActivityDetail | null>(() => getCachedDetail());
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupId = "me-week-popup";

  // Fetch canonical detail once per mount / Me-reselect (never on toggle or frame). Stale-while-
  // refresh: seed from cache, keep the last value on failure, save on success.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tz = deviceTz();
        const res = await fetch(`/api/me/today/weekly-activity?detail=1${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as WeeklyActivityDetail;
        if (!cancelled && d && d.summary) {
          setDetail(d);
          setCachedDetail(d);
        }
      } catch {
        /* fail-soft → keep the last cached detail; the Orb still animates */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Me-reselect clears any day selection (canonical root-reselect contract). The popup itself is
  // closed here when uncontrolled; in controlled mode the parent owns close-on-reselect.
  useEffect(() => {
    if (!isControlled) setOpenState(false);
    setSelectedDay(null);
  }, [refreshKey, isControlled]);

  // Collision-aware placement: measured synchronously before paint. Prefer above the Orb; flip
  // below when the above-top would cross the top safe area (so the heading is never clipped).
  useLayoutEffect(() => {
    if (!open || !toggleRef.current || !popupRef.current) return;
    const anchor = toggleRef.current.getBoundingClientRect();
    const popup = popupRef.current.getBoundingClientRect();
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    setPlacement(
      choosePopupPlacement({
        anchorTop: anchor.top,
        anchorBottom: anchor.bottom,
        popupHeight: popup.height,
        viewportHeight: vh,
        safeTop: SAFE_TOP_PX,
        margin: 10,
      }),
    );
  }, [open, detail, selectedDay]);

  const attendance = detail?.attendance;
  const range = attendance && attendance.length === 7 ? `${fmtDate(attendance[0].date, loc)} – ${fmtDate(attendance[6].date, loc)}` : null;

  return (
    <div className="relative flex flex-col items-center" data-testid="me-weekly-trace">
      {open ? (
        <div
          ref={popupRef}
          id={popupId}
          role="region"
          aria-label={t.title}
          data-testid="me-week-popup"
          data-placement={placement}
          // R2 layout contract: the disclosed weekly story (range · attendance · selected day ·
          // Events) must all be REACHABLE on a physical iPhone. The old fixed `max-h-[42vh]` is
          // unreliable in iOS WKWebView (vh ignores the dynamic toolbars/safe area) and let the
          // attendance grid consume the visible height, clipping the Events section below the fold.
          // Fix: dynamic-viewport max-height (`dvh`, iOS-correct) with a rem ceiling, real vertical
          // scroll contained to the popup (`overscroll-contain` → no body/page escape), and a
          // safe-area-aware bottom pad so the last item never hides behind the bottom dock.
          className={`absolute left-1/2 z-20 w-[min(19rem,86vw)] max-h-[min(70dvh,32rem)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-white/12 bg-[#12161f]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl backdrop-blur-sm ${placement === "above" ? "bottom-full mb-2.5" : "top-full mt-2.5"}`}
        >
          {/* Compact — no duplication of the root summary counts. Only what the root doesn't show. */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/50">{t.title}</span>
            {range ? <span className="text-[0.72rem] text-white/45" data-testid="me-week-range">{range}</span> : null}
          </div>

          {/* Events this week (Slice 3.2F · surfaced first in R2): the participant's OWN Reality Event
              participations — "this Event was part of my week". Title + date only; newest-first; omitted
              when empty (a proven zero is the Me summary chip, per the existing category policy). Placed
              directly under the header so it is ALWAYS visible on open — never clipped below the
              attendance grid on a short iPhone popup. No event_id/user_id/token/other-participant/XP. */}
          {detail?.eventsParticipated && detail.eventsParticipated.length > 0 ? (
            <div className="mt-2.5 flex flex-col gap-1" data-testid="me-week-events">
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40">{t.events}</span>
              {detail.eventsParticipated.map((e, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[0.8rem]" data-testid="me-week-event-item">
                  <span className="min-w-0 truncate text-white/75">{e.title}</span>
                  <span className="shrink-0 text-white/40">{fmtDate(e.date, loc)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {attendance && attendance.length > 0 ? (
            <div className="mt-2.5 flex items-center justify-between gap-1" data-testid="me-week-days">
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

      {/* The living seven-light Orb IS the toggle. Mounted once (stable identity) → no remount / no
          second canvas·rAF across toggles. Touch-safe (B3A.2D protections). */}
      <button
        ref={toggleRef}
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
