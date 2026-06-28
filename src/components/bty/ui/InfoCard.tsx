import type { ReactNode } from "react";

export type InfoCardTone = "default" | "soft" | "warning" | "stable" | "panel";

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
  // Elevated dark panel (today surface). Light title/body so text stays legible on #11294A.
  panel: "border-white/10 bg-bty-panel",
};

/**
 * BTY Phase 1 — 와이어용 카드 (BTY_TAILWIND_THEME_TOKENS §6).
 * `tone="panel"`은 어두운 패널 — 제목/본문 기본색을 밝게 전환(navy 위 navy invisible 방지).
 */
export function InfoCard({ title, children, tone = "default", className }: InfoCardProps) {
  const isPanel = tone === "panel";
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${toneClass[tone]} ${className ?? ""}`}
    >
      <h2
        className={`text-xs font-semibold uppercase tracking-wide ${
          isPanel ? "text-white/55" : "text-bty-secondary"
        }`}
      >
        {title}
      </h2>
      <div className={`mt-3 space-y-2 text-sm ${isPanel ? "text-white/90" : "text-bty-text"}`}>
        {children}
      </div>
    </div>
  );
}
