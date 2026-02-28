"use client";

import React from "react";

const START_BTN = { en: "Start Simulation", ko: "시뮬레이션 시작" };

export type ScenarioIntroProps = {
  locale: string;
  title: string;
  context: string;
  onStart: () => void;
};

export function ScenarioIntro({ locale, title, context, onStart }: ScenarioIntroProps) {
  const startLabel = locale === "ko" ? START_BTN.ko : START_BTN.en;
  return (
    <>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>
      <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{context}</p>

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={onStart}
          className="bty-btn-primary"
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
