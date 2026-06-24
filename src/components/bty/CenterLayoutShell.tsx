import type { ReactNode } from "react";
import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";
import { LogoutButton } from "@/components/auth/LogoutButton";
import HubTopNav from "@/components/bty/HubTopNav";

/**
 * Center 공통 레이아웃: ArenaLayoutShell과 동일한 구조 — btyARENA 로고 + 스티키 헤더.
 * /[locale]/center, /[locale]/dear-me, /[locale]/assessment 에서 사용.
 */
export function CenterLayoutShell({ children, locale }: { children: ReactNode; locale?: string }) {
  const brandHref = locale ? `/${locale}` : "/en";
  return (
    <div className="bty-center-area" data-theme="dear">
      <header
        className="sticky top-0 z-20 backdrop-blur border-b border-[var(--arena-bg-end)]"
        style={{ background: "rgba(245, 240, 232, 0.92)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 min-h-12 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 shrink-0">
          <Link
            href={brandHref}
            className="pt-1 shrink-0 inline-flex items-center gap-1.5"
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

      <div className="max-w-3xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
