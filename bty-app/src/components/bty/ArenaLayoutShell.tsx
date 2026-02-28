import type { ReactNode } from "react";
import { Noto_Sans_KR } from "next/font/google";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LangSwitch } from "@/components/LangSwitch";
import BtyTopNav from "@/components/bty/BtyTopNav";

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
export function ArenaLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className={`bty-arena-area ${notoSansKr.variable}`} data-theme="arena">
      <header
        className="sticky top-0 z-20 backdrop-blur border-b border-[var(--arena-bg-end)]"
        style={{ background: "rgba(245, 240, 232, 0.92)" }}
      >
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-4 flex-nowrap shrink-0">
          <span className="bty-arena-logo font-semibold text-[var(--arena-text)]" style={{ letterSpacing: "0.02em" }}>
            BTY Arena
          </span>
          <div className="flex items-center gap-3 flex-nowrap">
            <BtyTopNav showLogout={false} />
            <LangSwitch />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
