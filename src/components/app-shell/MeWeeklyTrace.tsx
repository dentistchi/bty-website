"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
import type { MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import type { WeeklyActivityDetail, WeeklyAttendanceDay } from "@/lib/bty/daily/weeklyActivity.server";
import { choosePopupPlacement } from "@/domain/daily/popupPlacement";

/**
 * MeWeeklyTrace (Slice 3.2F-ORB-WEEKLY-ATTENDANCE-R1) — the Me 7-Orb owns ONE interaction: it
 * discloses the user's seven-day ATTENDANCE rhythm ("which days was I present this week?").
 *
 * This is NOT the removed full weekly-summary popup (that stays deleted). The attendance popup shows
 * ONLY: a "Weekly attendance" title, the canonical week range, seven weekday states, and an
 * active-day count — never points / learned / created / Center / action plans / events / XP / Stage.
 *
 * Data: the canonical DATED seven-day attendance lives only in the existing weekly-activity
 * `?detail=1` response (the summary carries just an `activeDays` count; the numberless `weeklyRhythm`
 * has no dates). So detail is fetched LAZILY on Orb activation — NEVER on Me mount — and ONLY its
 * `attendance` field is read. `weeklyActivity.server.ts` and the endpoint are unchanged.
 *
 * "This Week is the summary; the Orb reveals attendance."
 */

const COPY = {
  en: {
    orb: "Show weekly attendance",
    title: "Weekly attendance",
    present: "Present",
    absent: "Rest",
    activeDays: (n: number) => `${n} active ${n === 1 ? "day" : "days"}`,
    close: "Close",
    loading: "Loading…",
  },
  ko: {
    orb: "주간 출석 보기",
    title: "주간 출석",
    present: "출석",
    absent: "휴식",
    activeDays: (n: number) => `활동 ${n}일`,
    close: "닫기",
    loading: "불러오는 중…",
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

// Conservative top safe-area allowance (status bar / notch) for collision math (reused pattern).
const SAFE_TOP_PX = 56;

export default function MeWeeklyTrace({
  locale,
  weeklyRhythm,
  refreshKey,
}: {
  locale: string;
  weeklyRhythm: MeWeeklyRhythm;
  /** Bumped on Me-reselect / account switch → drop any prior account's attendance (no cross-flash). */
  refreshKey?: number;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [open, setOpen] = useState(false);
  const [attendance, setAttendance] = useState<WeeklyAttendanceDay[] | null>(null);
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const orbRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const inFlight = useRef(false);
  const popupId = "me-attendance-popup";
  const titleId = "me-attendance-title";

  // Account switch / Me-reselect → close and drop the prior account's attendance so a refetch on the
  // next open reloads the CURRENT owner's seven-day states (never a cross-account flash).
  useEffect(() => {
    setOpen(false);
    setAttendance(null);
  }, [refreshKey]);

  // Escape closes on web and returns focus to the Orb (reachable close without covering the Orb).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        orbRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lazy: fetch the canonical dated seven-day attendance ONLY on Orb activation (never on mount).
  // Reads ONLY `attendance` from the existing ?detail=1 response — no events/learning/etc. Fail-soft.
  async function loadAttendance() {
    if (inFlight.current || attendance) return;
    inFlight.current = true;
    try {
      const tz = deviceTz();
      const res = await fetch(`/api/me/today/weekly-activity?detail=1${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as WeeklyActivityDetail;
        if (Array.isArray(d?.attendance)) setAttendance(d.attendance);
      }
    } catch {
      /* fail-soft → the popup shows a quiet loading state; never throws into Me */
    } finally {
      inFlight.current = false;
    }
  }

  function openPopup() {
    setOpen(true);
    void loadAttendance();
  }
  function closePopup() {
    setOpen(false);
    orbRef.current?.focus();
  }

  // Collision-aware placement (reused): prefer above the Orb, flip below near the top safe area.
  useLayoutEffect(() => {
    if (!open || !orbRef.current || !popupRef.current) return;
    const anchor = orbRef.current.getBoundingClientRect();
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
  }, [open, attendance]);

  const days = attendance ?? [];
  const range = days.length === 7 ? `${fmtDate(days[0].date, loc)} – ${fmtDate(days[6].date, loc)}` : null;
  const activeCount = days.filter((d) => d.active).length;

  return (
    <div className="relative flex flex-col items-center" data-testid="me-weekly-trace">
      {open ? (
        <div
          ref={popupRef}
          id={popupId}
          role="dialog"
          aria-labelledby={titleId}
          data-testid="me-attendance-popup"
          data-placement={placement}
          // Attendance-only popover, anchored to the Orb. Dynamic-viewport max-height + contained
          // scroll + safe-area bottom pad (iOS-robust; no body/page escape, no horizontal overflow).
          className={`absolute left-1/2 z-20 w-[min(19rem,86vw)] max-h-[min(70dvh,32rem)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-white/12 bg-[#12161f]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl backdrop-blur-sm ${placement === "above" ? "bottom-full mb-2.5" : "top-full mt-2.5"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span id={titleId} className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/50">{t.title}</span>
            <div className="flex items-center gap-2">
              {range ? <span className="text-[0.72rem] text-white/45" data-testid="me-attendance-range">{range}</span> : null}
              <button
                type="button"
                data-testid="me-attendance-close"
                aria-label={t.close}
                onClick={closePopup}
                className="-mr-1 shrink-0 rounded-full px-1.5 text-white/45 outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/40"
              >
                ✕
              </button>
            </div>
          </div>

          {days.length === 7 ? (
            <>
              <div className="mt-2.5 flex items-center justify-between gap-1" data-testid="me-attendance-days">
                {days.map((d, i) => (
                  <div
                    key={d.date ?? i}
                    className="flex flex-col items-center gap-1"
                    data-testid="me-attendance-day"
                    data-active={d.active ? "1" : "0"}
                    aria-label={`${fmtDate(d.date, loc)} — ${d.active ? t.present : t.absent}`}
                  >
                    <span className="text-[0.58rem] text-white/35" aria-hidden>{fmtWeekday(d.date, loc)}</span>
                    {/* Distinguishable WITHOUT color: filled ● present vs hollow ○ rest (shape + text
                        + aria-label), so an active/inactive day reads correctly in monochrome too. */}
                    <span
                      aria-hidden
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.5rem] leading-none ${d.active ? "bg-[#E5B769] text-[#0B1F3A]" : "border border-white/25 bg-transparent text-white/30"}`}
                    >
                      {d.active ? "●" : "○"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[0.72rem] text-white/45" data-testid="me-attendance-count">{t.activeDays(activeCount)}</p>
            </>
          ) : (
            <p className="mt-2.5 text-[0.78rem] text-white/40" role="status" data-testid="me-attendance-loading">{t.loading}</p>
          )}
        </div>
      ) : null}

      {/* The living seven-light Orb owns ONE interaction: reveal weekly attendance. Semantic button
          (aria-expanded/controls), keyboard-activatable (Enter/Space native), press feedback
          (active:scale), animation continues when closed. NOT the cold-launch entry Orb; it opens
          the attendance-only popup, never the removed full weekly-summary popup. */}
      <button
        ref={orbRef}
        type="button"
        data-testid="me-weekly-orb"
        aria-label={t.orb}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => (open ? closePopup() : openPopup())}
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
        className="select-none rounded-full outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <WeeklyOrb intensities={weeklyRhythm} locale={loc} size={200} />
      </button>
    </div>
  );
}
