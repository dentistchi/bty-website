"use client";

import React from "react";

export type ScenarioIntroProps = {
  title: string;
  context: string;
  onStart: () => void;
};

export function ScenarioIntro({ title, context, onStart }: ScenarioIntroProps) {
  return (
    <>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>
      <p style={{ marginTop: 0, lineHeight: 1.6, opacity: 0.9 }}>{context}</p>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={onStart}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start Simulation
        </button>
      </div>
    </>
  );
}
