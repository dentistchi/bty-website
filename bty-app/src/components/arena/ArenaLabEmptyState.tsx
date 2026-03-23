import type { CSSProperties, ReactNode } from "react";

/** `uxPhase1Stub` 의 `arenaLabEmpty*` 키만 묶어서 전달 */
export type ArenaLabEmptyStateLabels = {
  arenaLabEmptyRegionAria: string;
  arenaLabEmptyTitle: string;
  arenaLabEmptyMessage: string;
  arenaLabEmptyHint: string;
};

export type ArenaLabEmptyStateProps = {
  labels: ArenaLabEmptyStateLabels;
  /** 데코용 아이콘 문자(기본 📋) — `aria-hidden` */
  icon?: string;
  /** 추가 액션(링크 등) */
  children?: ReactNode;
  style?: CSSProperties;
};

/**
 * Leadership Lab — 활성 시나리오가 없을 때(render-only).
 */
export function ArenaLabEmptyState({
  labels,
  icon = "📋",
  children,
  style,
}: ArenaLabEmptyStateProps) {
  return (
    <section
      data-testid="arena-lab-empty-state"
      role="region"
      aria-label={labels.arenaLabEmptyRegionAria}
      style={{
        marginTop: 0,
        padding: "28px 24px",
        border: "1px solid #eee",
        borderRadius: 14,
        background: "var(--arena-card)",
        textAlign: "center",
        ...style,
      }}
    >
      {icon ? (
        <span
          style={{
            fontSize: 44,
            lineHeight: 1,
            display: "block",
            marginBottom: 16,
            opacity: 0.8,
          }}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1.35,
          color: "var(--arena-text)",
        }}
      >
        {labels.arenaLabEmptyTitle}
      </h2>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--arena-text)",
          opacity: 0.92,
        }}
      >
        {labels.arenaLabEmptyMessage}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--arena-text-soft)",
          opacity: 0.9,
        }}
      >
        {labels.arenaLabEmptyHint}
      </p>
      {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </section>
  );
}
