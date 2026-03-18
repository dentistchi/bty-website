import type { ReactNode } from "react";

export type CardScreenShellProps = {
  title: string;
  subtitle?: string;
  /** ≡ 버튼 접근성 라벨 */
  menuLabel?: string;
  children: ReactNode;
  /** 하단 고정 네비 등 (와이어 §1 Bottom) */
  footer?: ReactNode;
  className?: string;
};

/**
 * 카드형 화면 래퍼 (Arena 와이어·My Page 스텁 등).
 * 전체 앱 프레임은 `ScreenShell` (layout/ScreenShell.tsx).
 */
export function CardScreenShell({
  title,
  subtitle,
  menuLabel = "Menu",
  children,
  footer,
  className,
}: CardScreenShellProps) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-bty-border bg-bty-surface shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center justify-between border-b border-bty-border bg-bty-soft/40 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-bty-text">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-xs text-bty-secondary">{subtitle}</div>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-bty-border bg-bty-surface px-3 py-1.5 text-xs text-bty-secondary transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          aria-label={menuLabel}
        >
          ≡
        </button>
      </div>
      <div className="space-y-4 bg-bty-surface p-4">{children}</div>
      {footer ? (
        <div className="border-t border-bty-border bg-bty-soft/60 px-3 py-3">{footer}</div>
      ) : null}
    </section>
  );
}
