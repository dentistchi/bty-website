"use client";

import React from "react";
import Link from "next/link";

export type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ArenaPhase = "CHOOSING" | "SHOW_RESULT" | "FOLLOW_UP" | "DONE";

const TITLE = { en: "Simulation", ko: "시뮬레이션" };
const SUBTITLE = {
  en: "One round. Resumes when you return. (MVP 1)",
  ko: "한 판으로 끝. 멈춰도 이어짐. (MVP: 1 + 보완 1)",
};
const PAUSE_LABEL = { en: "Pause", ko: "일시정지" };
const RESET_LABEL = { en: "Reset", ko: "초기화" };
const MAIN_LABEL = { en: "Main", ko: "메인" };

export type ArenaHeaderProps = {
  locale: string;
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
  const isKo = locale === "ko";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty arena</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{isKo ? TITLE.ko : TITLE.en}</h1>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
          {isKo ? SUBTITLE.ko : SUBTITLE.en}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link
          href={`/${locale}/bty`}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            fontSize: 14,
          }}
        >
          {isKo ? MAIN_LABEL.ko : MAIN_LABEL.en}
        </Link>
        {showPause !== false && (
          <button onClick={onPause} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
            {isKo ? PAUSE_LABEL.ko : PAUSE_LABEL.en}
          </button>
        )}
        <button onClick={onReset} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          {isKo ? RESET_LABEL.ko : RESET_LABEL.en}
        </button>
      </div>
    </div>
  );
}
