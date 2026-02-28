"use client";

import React from "react";

/**
 * DESIGN_FIRST_IMPRESSION_BRIEF §2 / PROJECT_BACKLOG §8:
 * Empty state = icon/illustration + one-line message (+ optional CTA).
 * Use for leaderboard empty list, dashboard empty card, etc.
 */
export interface EmptyStateProps {
  /** Emoji or icon character (e.g. "🏆", "📋") — aria-hidden when present */
  icon?: string;
  /** One-line message (e.g. "아직 기록이 없어요. 첫 시나리오를 시작해 보세요.") */
  message: string;
  /** Optional CTA (e.g. link to Arena) */
  cta?: React.ReactNode;
  /** Optional additional hint below message */
  hint?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function EmptyState({ icon, message, cta, hint, className, style }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        textAlign: "center",
        ...style,
      }}
    >
      {icon && (
        <span
          style={{
            fontSize: 48,
            lineHeight: 1,
            marginBottom: 16,
            opacity: 0.75,
          }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p style={{ margin: 0, fontSize: 15, color: "var(--arena-text)", opacity: 0.9 }}>{message}</p>
      {hint && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--arena-text-soft)", opacity: 0.85 }}>{hint}</p>
      )}
      {cta && <div style={{ marginTop: 14 }}>{cta}</div>}
    </div>
  );
}
