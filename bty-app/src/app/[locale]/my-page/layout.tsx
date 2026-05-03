import type { ReactNode } from "react";
import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";
import { LogoutButton } from "@/components/auth/LogoutButton";
import HubTopNav from "@/components/bty/HubTopNav";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export default async function MyPageLayout({ children, params }: Props) {
  const { locale } = await params;
  const brandHref = `/${locale}`;
  return (
    <div data-theme="arena">
      <header
        className="sticky top-0 z-20 backdrop-blur border-b border-[var(--arena-bg-end)]"
        style={{ background: "rgba(245, 240, 232, 0.92)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 min-h-12 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 shrink-0">
          <Link
            href={brandHref}
            className="pt-1 shrink-0"
            style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.02em", textDecoration: "none", color: "var(--arena-text, #1E2A38)" }}
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
      {children}
    </div>
  );
}
