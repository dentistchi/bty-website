"use client";

import React from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ArenaPhase = "CHOOSING" | "SHOW_RESULT" | "FOLLOW_UP" | "DONE";

export type ArenaHeaderProps = {
  locale: Locale | string;
  step: ArenaStep;
  phase: ArenaPhase;
  runId: string | null;
  onPause: () => void;
  onReset: () => void;
  /** When false, Pause button is hidden. Default true. */
  showPause?: boolean;
};

export function ArenaHeader({
  locale,
  step,
  phase,
  runId,
  onPause,
  onReset,
  showPause = true,
}: ArenaHeaderProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty arena</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{t.headerTitle}</h1>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
          {t.headerSubtitle}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link
          href={`/${lang}/bty`}
          aria-label={t.mainLabel}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            fontSize: 14,
          }}
        >
          {t.mainLabel}
        </Link>
        {showPause !== false && (
          <button
            type="button"
            onClick={onPause}
            aria-label={t.pauseLabel}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {t.pauseLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          aria-label={t.resetLabel}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          {t.resetLabel}
        </button>
      </div>
    </div>
  );
}
