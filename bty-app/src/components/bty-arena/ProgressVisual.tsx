"use client";

import React from "react";

export interface ProgressVisualProps {
  /** Stage 1–7 from API/engine. */
  stage: number;
  /** Progress 0–100 or 0–1 (display only). */
  progressPct: number;
  /** Optional label for next milestone (e.g. "50 XP to PULSE"). */
  nextMilestoneLabel?: string;
}

/**
 * Renders Level/Tier/Stage progress. All values from API/engine; no computation.
 */
export function ProgressVisual({
  stage,
  progressPct,
  nextMilestoneLabel,
}: ProgressVisualProps) {
  const pct = progressPct <= 1 ? progressPct * 100 : progressPct;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 13, opacity: 0.85 }}>
          <b>Stage</b> {stage}
        </span>
        <span style={{ fontSize: 13, opacity: 0.85 }}>
          <b>Progress</b> {Math.round(pct)}%
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, Math.max(0, pct))}%`,
            background: "#111",
          }}
        />
      </div>
      {nextMilestoneLabel && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{nextMilestoneLabel}</div>
      )}
    </div>
  );
}
