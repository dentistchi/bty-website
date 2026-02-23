"use client";

import React from "react";

export type ArenaHeaderProps = {
  step: number;
  phase: string;
  runId: string | null;
  onPause: () => void;
  onReset: () => void;
  /** When false, Pause button is hidden (MVP: reduce confusion). Default true. */
  showPause?: boolean;
};

export function ArenaHeader({ step, phase, runId, onPause, onReset, showPause = true }: ArenaHeaderProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty arena</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Simulation</h1>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
          한 판으로 끝. 멈춰도 이어짐. (MVP: 1 + 보완 1)
        </div>
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>
          Step {step} · Phase {phase} · Run {runId?.slice(0, 8) ?? "—"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {showPause && (
          <button onClick={onPause} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
            Pause
          </button>
        )}
        <button onClick={onReset} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          Reset
        </button>
      </div>
    </div>
  );
}
