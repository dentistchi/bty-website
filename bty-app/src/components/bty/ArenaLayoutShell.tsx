import type { ReactNode } from "react";
import Link from "next/link";
import { Noto_Sans_KR } from "next/font/google";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LangSwitch } from "@/components/LangSwitch";
import HubTopNav from "@/components/bty/HubTopNav";

/** DESIGN_FIRST_IMPRESSION_BRIEF §4 B: 제목·로고용 포인트 폰트 (Arena 영역만) */
const notoSansKr = Noto_Sans_KR({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-arena-heading",
});

/**
 * Arena 공통 레이아웃: 스티키 헤더 + 크림 배경 + max-w-6xl 본문.
 * /en, /ko 의 /bty/*, /bty-arena/* 에서 공통 사용.
 */
export function ArenaLayoutShell({ children, locale }: { children: ReactNode; locale?: string }) {
  const brandHref = locale ? `/${locale}` : "/en";
  return (
    <div className={`bty-arena-area ${notoSansKr.variable}`} data-theme="arena">
      <header
        className="sticky top-0 z-20 backdrop-blur border-b border-[var(--arena-bg-end)]"
        style={{ background: "rgba(245, 240, 232, 0.92)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 min-h-12 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 shrink-0">
          <Link
            href={brandHref}
            className="bty-arena-logo pt-1 shrink-0"
            style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.02em", textDecoration: "none", color: "var(--arena-text)" }}
          >
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

      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
