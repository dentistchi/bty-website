import type { ReactNode } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LangSwitch } from "@/components/LangSwitch";
import HubTopNav from "@/components/bty/HubTopNav";
import BottomNav from "@/components/bty/navigation/BottomNav";

/** DESIGN_FIRST_IMPRESSION_BRIEF §4 B: 제목·로고용 포인트 폰트 (Arena 영역만)
 * FONT_VENDOR_A: self-hosted latin-subset Noto Sans KR (was the Google font loader).
 * Removes Cloudflare/OpenNext build-time fetch to fonts.gstatic.com (ETIMEDOUT risk). */
const notoSansKr = localFont({
  src: [
    { path: "../../app/fonts/noto-sans-kr-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../app/fonts/noto-sans-kr-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../app/fonts/noto-sans-kr-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-arena-heading",
  fallback: ["system-ui", "Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
  adjustFontFallback: "Arial",
});

/**
 * Arena 공통 레이아웃: 스티키 헤더 + 크림 배경 + max-w-6xl 본문.
 * /en, /ko 의 /bty/*, /bty-arena/* 에서 공통 사용.
 *
 * App-shell rule (native/mobile): the desktop web nav (logo + HubTopNav + LangSwitch +
 * Logout) is DESKTOP-ONLY (`hidden md:block`). On mobile/native the primary experience is
 * app-like — no top web nav (so the logo can't overlap the iOS status bar), a safe-area
 * spacer clears the notch, and the shared 5-tab {@link BottomNav} floor
 * (Today·Arena·Foundry·Center·Me) is the primary navigation. Pure mobile-viewport CSS
 * (`md:` breakpoints) — desktop is unchanged. Language/logout/dashboard/leaderboard remain
 * reachable on desktop here and, on mobile, inside their deeper surfaces (unchanged routes).
 */
export function ArenaLayoutShell({ children, locale }: { children: ReactNode; locale?: string }) {
  const brandHref = locale ? `/${locale}` : "/en";
  return (
    <div className={`bty-arena-area ${notoSansKr.variable}`} data-theme="arena">
      {/* Mobile/native: safe-area spacer so content clears the iOS status bar (header is hidden). */}
      <div className="md:hidden" style={{ height: "env(safe-area-inset-top)" }} aria-hidden />
      <header
        className="hidden md:block sticky top-0 z-20 backdrop-blur border-b border-[var(--arena-bg-end)]"
        style={{ background: "rgba(245, 240, 232, 0.92)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 min-h-12 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 shrink-0">
          <Link
            href={brandHref}
            className="bty-arena-logo pt-1 shrink-0 inline-flex items-center gap-1.5"
            style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.02em", textDecoration: "none", color: "var(--arena-text)" }}
          >
            <img src="/brand/bty-knot-transparent-navy.svg" alt="" aria-hidden="true" width={20} height={20} className="h-5 w-5 shrink-0" />
            <span style={{ fontWeight: 400 }}>bty</span>ARENA
          </Link>
          <HubTopNav
            trailing={
              <>
                <LangSwitch />
                <LogoutButton />
              </>
            }
          />
        </div>
      </header>

      {/* pb-28 on mobile keeps content clear of the fixed BottomNav; desktop keeps py-8. */}
      <div className="max-w-6xl mx-auto px-4 py-8 pb-28 md:pb-8">{children}</div>

      {/* Mobile/native primary nav — the app floor. Desktop hides it (top nav owns nav there). */}
      {locale ? <BottomNav locale={locale} className="md:hidden" /> : null}
    </div>
  );
}
