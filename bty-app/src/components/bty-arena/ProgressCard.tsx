"use client";

import React from "react";

export interface ProgressCardProps {
  /** Section label (e.g. "Lifetime Progress (Core XP)") */
  label: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Arena 리디자인: 웜 화이트·16px 라운드·은은한 그림자·왼쪽 세로 강조 바 (프롬프트 B·A 변수 통일) */
const ARENA_CARD_STYLE: React.CSSProperties = {
  background: "var(--arena-card, #FAFAF8)",
  padding: "20px 24px",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  borderLeft: "4px solid var(--arena-accent, #7c6b9a)",
};

/**
 * Presentational card for a labeled progress section.
 * Renders only; no business logic.
 */
export function ProgressCard({ label, children, className, style }: ProgressCardProps) {
  return (
    <div
      className={`bty-card ${className ?? ""}`.trim()}
      style={{
        ...ARENA_CARD_STYLE,
        ...style,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}
