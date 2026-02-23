"use client";

import React from "react";

export type ReflectionBlockProps = {
  options: string[];
  onSubmit: (index: number) => void;
};

export function ReflectionBlock({ options, onSubmit }: ReflectionBlockProps) {
  return (
    <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Reflection</div>
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
  );
}
