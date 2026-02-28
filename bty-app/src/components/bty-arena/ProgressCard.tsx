"use client";

import React from "react";

export interface ProgressCardProps {
  /** Section label (e.g. "Lifetime Progress (Core XP)") */
  label: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Presentational card for a labeled progress section.
 * Renders only; no business logic.
 */
export function ProgressCard({ label, children, className, style }: ProgressCardProps) {
  return (
    <div
      className={className}
      style={{
        padding: 16,
        border: "1px solid #eee",
        borderRadius: 14,
        ...style,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
