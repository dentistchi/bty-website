"use client";

import React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type ScenarioIntroProps = {
  locale: Locale | string;
  title: string;
  context: string;
  onStart: () => void;
};

export function ScenarioIntro({ locale, title, context, onStart }: ScenarioIntroProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const startLabel = getMessages(lang).arenaRun.startSimulation;
  return (
    <>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>
      <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{context}</p>

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={onStart}
          className="bty-btn-primary"
          aria-label={startLabel}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: "var(--arena-accent)",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {startLabel}
        </button>
      </div>
    </>
  );
}
