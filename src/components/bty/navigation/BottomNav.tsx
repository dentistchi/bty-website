"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveBtyNav, getBtyNavItems, type BtyNavKey } from "@/components/bty/navigation/nav-items";
import { useForcedResetActive } from "@/components/bty/navigation/useForcedResetActive";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/** Inline tab glyphs (no icon-lib dependency). 18px, `currentColor` stroke so the Link tints them. */
const NAV_ICON_PATHS: Record<BtyNavKey, string> = {
  home: "M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5",
  arena: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4v0",
  foundry: "M14 3l-1 7h5l-9 11 1-8H5l9-10Z",
  center: "M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10Z",
  "my-page": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
};

function NavIcon({ navKey }: { navKey: BtyNavKey }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={NAV_ICON_PATHS[navKey]} />
    </svg>
  );
}

export type BottomNavProps = {
  locale: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * 5-tab dark "floor" nav (Home·Arena·Foundry·Center·Profile) — single dark surface, no per-tab
 * capsule; active = brand gold + subtle static glow, inactive = muted. 아이콘만(로고 0).
 * BTY Navigation Rule (D5): navigation never competes, content is hero, nav is the floor.
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
      className={`fixed bottom-0 left-0 right-0 z-[40] rounded-t-2xl border-t border-white/10 bg-bty-navy/95 px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm ${className}`}
      aria-label={ariaLabel}
    >
      <div className={`mx-auto grid max-w-md ${gridColsClass} gap-1.5`}>
        {visibleItems.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-gold/40 focus-visible:ring-offset-2 ${
                isActive
                  ? "text-bty-gold bg-white/[0.03] shadow-[0_0_20px_rgba(201,166,107,0.08)]"
                  : "text-white/55 hover:text-white/80"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon navKey={item.key} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
