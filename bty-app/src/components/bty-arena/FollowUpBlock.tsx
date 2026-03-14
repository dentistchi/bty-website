"use client";

import React from "react";
import { CardSkeleton } from "./CardSkeleton";

export type FollowUpBlockProps = {
  /** e.g. "Skip follow-up · Next scenario" or "따라하기 건너뛰기 · 다음 시나리오" */
  skipLabel: string;
  prompt: string;
  options: string[];
  onSubmit: (index: number) => void;
  onSkip: () => void;
  /** When true, show loading skeleton below options (follow-up submit in flight). */
  loading?: boolean;
  /** Aria-label for loading state (e.g. "따라하기 제출 중…" / "Submitting follow-up…"). */
  loadingAriaLabel?: string;
};

export function FollowUpBlock({ skipLabel, prompt, options, onSubmit, onSkip, loading = false, loadingAriaLabel = "Submitting follow-up…" }: FollowUpBlockProps) {
  return (
    <>
      <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{prompt}</div>
        <div style={{ display: "grid", gap: 10 }}>
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSubmit(idx)}
              disabled={loading}
              aria-label={opt}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                background: "white",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          aria-label={skipLabel}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #999",
            background: "white",
            color: "#555",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {skipLabel}
        </button>
      </div>
      {loading && (
        <div style={{ marginTop: 10 }} aria-busy="true" aria-label={loadingAriaLabel}>
          <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
        </div>
      )}
    </>
  );
}
