"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveBtyNav, getBtyNavItems } from "@/components/bty/navigation/nav-items";
import { useForcedResetActive } from "@/components/bty/navigation/useForcedResetActive";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
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
  const { contract: arenaEntry } = useArenaEntryResolution(loc);
  const items = getBtyNavItems(
    locale,
    {
      home: "Home",
      arena: "Arena",
      foundry: "Foundry",
      center: "Center",
      "my-page": "Profile",
    },
    arenaEntry.href,
  );
  const active = getActiveBtyNav(pathname, locale, arenaEntry.href);

  /**
   * v1.1.1 §5.5.2 + §8-7: FORCED_RESET sub-mode → render Center tab only,
   * full-width. Arena (btyARENA) and My Page tabs suppressed (not-rendered)
   * because they are §5.4 secondary-block / non-Center surfaces the user is
   * not allowed to access. Middleware 2C-1 already redirects Arena URLs;
   * this closes the §8-Open #2 gap (b) so the tabs aren't visible to click.
   */
  const forcedResetActive = useForcedResetActive();
  const visibleItems = forcedResetActive ? items.filter((it) => it.key === "center") : items;
  const gridColsClass = forcedResetActive ? "grid-cols-1" : "grid-cols-5";

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-[40] border-t border-bty-border bg-bty-surface/95 px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm ${className}`}
      aria-label={ariaLabel}
    >
      <div className={`mx-auto grid max-w-md ${gridColsClass} gap-1.5`}>
        {visibleItems.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-2xl px-2 py-3 text-center text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-gold/40 focus-visible:ring-offset-2 ${
                isActive
                  ? "bg-bty-navy text-white shadow-sm"
                  : "bg-white text-bty-secondary hover:bg-bty-bg"
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
