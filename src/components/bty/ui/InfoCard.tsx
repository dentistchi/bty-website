import type { ReactNode } from "react";

export type InfoCardTone = "default" | "soft" | "warning" | "stable";

export type InfoCardProps = {
  title: string;
  children: ReactNode;
  tone?: InfoCardTone;
  className?: string;
};

const toneClass: Record<InfoCardTone, string> = {
  default: "border-bty-border bg-bty-surface",
  soft: "border-bty-border bg-bty-soft/90",
  warning: "border-bty-warning/35 bg-bty-warning/5",
  stable: "border-bty-stable/35 bg-bty-stable/10",
};

/**
 * BTY Phase 1 — 와이어용 카드 (BTY_TAILWIND_THEME_TOKENS §6).
 */
export function InfoCard({ title, children, tone = "default", className }: InfoCardProps) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${toneClass[tone]} ${className ?? ""}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-bty-secondary">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-bty-text">{children}</div>
    </div>
  );
}
