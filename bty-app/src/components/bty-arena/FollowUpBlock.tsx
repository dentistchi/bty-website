"use client";

import React from "react";

export type FollowUpBlockProps = {
  /** e.g. "Skip follow-up · Next scenario" or "따라하기 건너뛰기 · 다음 시나리오" */
  skipLabel: string;
  prompt: string;
  options: string[];
  onSubmit: (index: number) => void;
  onSkip: () => void;
};

export function FollowUpBlock({ skipLabel, prompt, options, onSubmit, onSkip }: FollowUpBlockProps) {
  return (
    <>
      <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{prompt}</div>
        <div style={{ display: "grid", gap: 10 }}>
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onSubmit(idx)}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                background: "white",
                cursor: "pointer",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          onClick={onSkip}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #999",
            background: "white",
            color: "#555",
            cursor: "pointer",
          }}
        >
          {skipLabel}
        </button>
      </div>
    </>
  );
}
