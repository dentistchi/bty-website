"use client";

import React from "react";

export type ConsolidationBlockProps = {
  choiceId: string;
  intent: string;
  microInsight: string;
  onComplete: () => void;
};

export function ConsolidationBlock({ choiceId, intent, microInsight, onComplete }: ConsolidationBlockProps) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        border: "1px solid #eee",
        borderRadius: 14,
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Step 6 · Consolidation</div>
      <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9, marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px 0" }}>You chose {choiceId} ({intent}).</p>
        <p style={{ margin: "0 0 8px 0" }}>Key insight: {microInsight}</p>
        <p style={{ margin: 0 }}>Principle: &quot;Stabilize people first, then fix the system.&quot;</p>
      </div>
      <button
        onClick={onComplete}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #111",
          background: "#111",
          color: "white",
          cursor: "pointer",
        }}
      >
        Complete
      </button>
    </div>
  );
}
