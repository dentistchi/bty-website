"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type LetterCalendarDay = { date: string; hasReply: boolean };

/** Local YYYY-MM-DD key for a Date (avoids UTC offset drift on day matching). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Month grid of Dear Me letter dates. Render-only: shows a dot on days that
 * have a letter, highlights the selected day, and reports clicks via
 * onSelectDate (the parent renders the day's content). Month names / weekday
 * labels come from i18n (Workers runtime lacks full Intl locale data).
 */
export function LetterCalendar({
  locale,
  entries,
  selectedDate,
  onSelectDate,
}: {
  locale: string;
  entries: LetterCalendarDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).center;

  // Map day-key -> hasReply (any letter that day; reply wins for color).
  const byDay = React.useMemo(() => {
    const m = new Map<string, boolean>();
    for (const e of entries) {
      const k = dayKey(new Date(e.date));
      m.set(k, (m.get(k) ?? false) || e.hasReply);
    }
    return m;
  }, [entries]);

  // Default the visible month to the most recent letter, else current month.
  const initial = React.useMemo(() => {
    const base = entries.length > 0 ? new Date(entries[0].date) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  }, [entries]);

  const [view, setView] = React.useState(initial);
  React.useEffect(() => setView(initial), [initial]);

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel =
    lang === "ko"
      ? `${view.year}년 ${t.calendarMonths[view.month]}`
      : `${t.calendarMonths[view.month]} ${view.year}`;

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div
      className="rounded-xl border border-dear-sage/20 bg-dear-sage/5 px-3 py-3"
      role="group"
      aria-label={t.calendarTitle}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label={t.calendarPrevMonth}
          className="rounded-lg px-2 py-1 text-sm text-dear-charcoal-soft hover:text-dear-charcoal hover:bg-dear-sage/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-dear-charcoal" aria-live="polite">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label={t.calendarNextMonth}
          className="rounded-lg px-2 py-1 text-sm text-dear-charcoal-soft hover:text-dear-charcoal hover:bg-dear-sage/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {t.calendarWeekdays.map((w, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-dear-charcoal-soft/70 py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={`b${i}`} aria-hidden="true" />;
          const key = dayKey(new Date(view.year, view.month, day));
          const has = byDay.has(key);
          const hasReply = byDay.get(key) === true;
          const isSelected = selectedDate === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!has}
              onClick={() => has && onSelectDate(key)}
              aria-pressed={isSelected}
              aria-label={`${key}${has ? (hasReply ? ` · ${t.letterHistoryReplied}` : ` · ${t.letterHistoryNoReply}`) : ""}`}
              className={[
                "relative aspect-square rounded-lg text-xs flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dear-sage",
                isSelected
                  ? "bg-dear-sage/30 text-dear-charcoal font-semibold"
                  : has
                    ? "text-dear-charcoal hover:bg-dear-sage/15 cursor-pointer"
                    : "text-dear-charcoal-soft/40 cursor-default",
              ].join(" ")}
            >
              {day}
              {has && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
                  style={{ background: hasReply ? "#14b8a6" : "#cbb89d" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
