"use client";

import React from "react";

export type FollowUpBlockProps = {
  prompt: string;
  options: string[];
  onSubmit: (index: number) => void;
  onSkip: () => void;
};

export function FollowUpBlock({ prompt, options, onSubmit, onSkip }: FollowUpBlockProps) {
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
          보완 선택 건너뛰고 Continue
        </button>
      </div>
    </>
  );
}
