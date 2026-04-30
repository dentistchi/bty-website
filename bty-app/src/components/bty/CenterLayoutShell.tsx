import type { ReactNode } from "react";
import { LangSwitch } from "@/components/LangSwitch";
import { LogoutButton } from "@/components/auth/LogoutButton";
import HubTopNav from "@/components/bty/HubTopNav";

/**
 * Center 공통 레이아웃: ArenaLayoutShell과 동일한 구조 — "BTY Center" 로고 + 스티키 헤더.
 * /[locale]/center, /[locale]/dear-me, /[locale]/assessment 에서 사용.
 */
export function CenterLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="bty-center-area" data-theme="dear">
      <header
        className="sticky top-0 z-20 backdrop-blur border-b border-[var(--arena-bg-end)]"
        style={{ background: "rgba(245, 240, 232, 0.92)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 min-h-12 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 shrink-0">
          <span
            className="font-semibold text-[var(--arena-text)] pt-1 shrink-0"
            style={{ letterSpacing: "0.02em" }}
          >
            BTY Center
          </span>
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
