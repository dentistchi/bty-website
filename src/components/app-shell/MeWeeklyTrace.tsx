"use client";

import WeeklyOrb from "@/components/app-shell/WeeklyOrb";
import type { MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";

/**
 * MeWeeklyTrace (Slice 3.2C-B3A.2D · R4 simplification) — the Me Orb is the LIVING seven-light
 * {@link WeeklyOrb}: a calm, NON-INTERACTIVE visual trace of the week's rhythm. It is NOT the
 * startup entry Orb and it opens NO popup.
 *
 * "This Week is the summary; the Orb is the presence; neither needs a popup." R4 removed the
 * redundant weekly popup (and its detail fetch / local detail state / session cache / collision
 * placement) — the popup only re-showed values already present in the This Week card. The canonical
 * weekly summary now lives entirely in {@link MeThisWeek}; this component is purely the visual Orb.
 */

const COPY = {
  en: { orb: "This week's rhythm" },
  ko: { orb: "이번 주의 리듬" },
};

export default function MeWeeklyTrace({ locale, weeklyRhythm }: { locale: string; weeklyRhythm: MeWeeklyRhythm }) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  return (
    <div className="relative flex flex-col items-center" data-testid="me-weekly-trace">
      {/* The living seven-light Orb is the week's PRESENCE, not a control — non-interactive
          (`role="img"` with an accessible name, NOT a button, not keyboard-focusable, no disclosure
          state), it visualizes rhythm/continuity and opens nothing. Mounted once (stable canvas). */}
      <div
        data-testid="me-weekly-orb"
        role="img"
        aria-label={t.orb}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={
          {
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitUserDrag: "none",
          } as React.CSSProperties
        }
        className="select-none rounded-full"
      >
        <WeeklyOrb intensities={weeklyRhythm} locale={loc} size={200} />
      </div>
    </div>
  );
}
