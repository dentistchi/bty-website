"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveBtyNav, getBtyNavItems } from "@/components/bty/navigation/nav-items";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type BottomNavProps = {
  locale: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Arena · Growth · My Page 3탭. Journey 등 하위 허브는 Growth active.
 * 고정 하단, locale 기반 href.
 */
export default function BottomNav({
  locale,
  className = "",
  "aria-label": ariaLabel = "Main navigation",
}: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const items = getBtyNavItems(locale, {
    arena: t.bottomNavArena,
    growth: t.bottomNavGrowth,
    "my-page": t.bottomNavMyPage,
  });
  const active = getActiveBtyNav(pathname);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-[40] border-t border-[#E8E3D8] bg-[#FFFCF7]/95 px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm ${className}`}
      aria-label={ariaLabel}
    >
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-2xl px-3 py-3 text-center text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B08D57]/40 focus-visible:ring-offset-2 ${
                isActive
                  ? "bg-[#1E2A38] text-white shadow-sm"
                  : "bg-white text-[#667085] hover:bg-[#F6F4EE]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
