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
  /** 있으면 내부 `<main>`에 `aria-label` (접근성 랜드마크) */
  mainAriaLabel?: string;
  /** 있으면 `BottomNav`에 전달 (경로별 하단 탭 랜드마크) */
  bottomNavAriaLabel?: string;
  /** 배경 변형. 기본 `"default"`(크림 #F6F4EE, 전역 21화면 불변). `"navy"`는 today 한정 brand navy 배경. */
  surface?: "default" | "navy";
  /**
   * true면 상단에 mobile-only iOS safe-area 스페이서를 넣어 콘텐츠가 상태바와 겹치지 않게 함
   * (ArenaLayoutShell과 동일 패턴). 기본 false — 기존 호출부 렌더는 무변경. 현재 Today만 opt-in.
   */
  safeAreaTop?: boolean;
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
  mainAriaLabel,
  bottomNavAriaLabel,
  surface = "default",
  safeAreaTop = false,
}: ScreenShellProps) {
  const container = fullWidth
    ? `mx-auto w-full max-w-full px-0 py-6 ${contentClassName}`
    : `mx-auto max-w-md px-4 py-6 ${contentClassName}`;
  const isNavy = surface === "navy";
  return (
    <div
      className={`min-h-screen ${isNavy ? "bg-bty-navy text-white" : "bg-[#F6F4EE] text-[#1F2937]"}`}
    >
      {/* Mobile/native: safe-area spacer so the top chrome clears the iOS status bar
          (mirrors ArenaLayoutShell). md:hidden + env()=0 on web → desktop/web unchanged. */}
      {safeAreaTop ? (
        <div className="md:hidden" style={{ height: "env(safe-area-inset-top)" }} aria-hidden />
      ) : null}
      <div className={container}>
        {eyebrow || title || subtitle ? (
          <header className="mb-5 space-y-2">
            {eyebrow ? (
              <p
                className={`text-sm font-medium uppercase tracking-[0.18em] ${
                  isNavy ? "text-white/70" : "text-[#667085]"
                }`}
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h1
                className={`text-3xl font-semibold tracking-tight ${
                  isNavy ? "text-white" : "text-[#1E2A38]"
                }`}
              >
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className={`text-sm leading-6 ${isNavy ? "text-white/70" : "text-[#667085]"}`}>
                {subtitle}
              </p>
            ) : null}
          </header>
        ) : null}
        <main {...(mainAriaLabel ? { "aria-label": mainAriaLabel } : {})}>{children}</main>
      </div>
      {showBottomNav ? (
        <BottomNav locale={locale} aria-label={bottomNavAriaLabel ?? "Main navigation"} />
      ) : null}
    </div>
  );
}

export { CardScreenShell } from "@/components/bty/layout/CardScreenShell";
export type { CardScreenShellProps } from "@/components/bty/layout/CardScreenShell";
