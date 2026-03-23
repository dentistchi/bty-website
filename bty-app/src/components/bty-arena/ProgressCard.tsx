"use client";

import React from "react";
import { InfoCard } from "@/components/bty/ui/InfoCard";

export interface ProgressCardProps {
  /** Section label (e.g. "Lifetime Progress (Core XP)") */
  label: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Arena progress section — BTY shared card language: delegates to {@link InfoCard}.
 * Legacy left-accent inline styles removed in favor of theme tokens on InfoCard.
 */
export function ProgressCard({ label, children, className, style }: ProgressCardProps) {
  return (
    <div className={className} style={style}>
      <InfoCard title={label}>{children}</InfoCard>
    </div>
  );
}
