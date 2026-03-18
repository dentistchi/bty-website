import type { ReactNode } from "react";
import BottomNav from "@/components/bty/navigation/BottomNav";

export type ScreenShellProps = {
  locale: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** 기본 true — Arena/Growth/My Page 허브 하단 네비 */
  showBottomNav?: boolean;
  /** 하단 네비 높이만큼 본문 패딩 (기본 pb-24) */
  contentClassName?: string;
  /** true면 가로 풀폭(자식에서 max-w-md 등 처리) */
  fullWidth?: boolean;
};

/**
 * BTY 공통 앱 프레임: 배경 · max-width · 선택 헤더 · 본문 · 하단 3탭.
 * 카드형 레이아웃은 `CardScreenShell`.
 */
export default function ScreenShell({
  locale,
  eyebrow,
  title,
  subtitle,
  children,
  showBottomNav = true,
  contentClassName = "pb-24",
  fullWidth = false,
}: ScreenShellProps) {
  const container = fullWidth
    ? `mx-auto w-full max-w-full px-0 py-6 ${contentClassName}`
    : `mx-auto max-w-md px-4 py-6 ${contentClassName}`;
  return (
    <div className="min-h-screen bg-[#F6F4EE] text-[#1F2937]">
      <div className={container}>
        {eyebrow || title || subtitle ? (
          <header className="mb-5 space-y-2">
            {eyebrow ? (
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#667085]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h1 className="text-3xl font-semibold tracking-tight text-[#1E2A38]">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="text-sm leading-6 text-[#667085]">{subtitle}</p>
            ) : null}
          </header>
        ) : null}
        <main>{children}</main>
      </div>
      {showBottomNav ? <BottomNav locale={locale} /> : null}
    </div>
  );
}

export { CardScreenShell } from "@/components/bty/layout/CardScreenShell";
export type { CardScreenShellProps } from "@/components/bty/layout/CardScreenShell";
