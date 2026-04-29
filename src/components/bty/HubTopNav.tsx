"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";
import { pathnameMatchesArenaEntryHref } from "@/components/bty/navigation/nav-items";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages } from "@/lib/i18n";

function detectLocale(pathname: string): "en" | "ko" {
  return pathname.startsWith("/ko") ? "ko" : "en";
}

export type HubContext = "arena" | "center" | "foundry" | "none";

export function detectHubContext(pathname: string, locale: string): HubContext {
  if (pathname.includes("/bty-arena")) return "arena";
  if (
    new RegExp(`/${locale}/(center|dear-me|assessment|journal)(/|$)`).test(pathname)
  ) {
    return "center";
  }
  if (pathname.includes(`/${locale}/bty`) && !pathname.includes("/bty-arena")) {
    return "foundry";
  }
  return "none";
}

function isActivePath(pathname: string, href: string) {
  return pathnameMatchesArenaEntryHref(pathname, href);
}

const arenaNav = {
  wrap: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 8,
    flexWrap: "wrap" as const,
  },
  link: {
    padding: "6px 12px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "var(--arena-text)",
    background: "transparent",
    fontSize: "0.875rem",
  },
  active: {
    padding: "6px 12px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "white",
    background: "var(--arena-accent)",
    fontSize: "0.875rem",
  },
  primary: {
    padding: "8px 14px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "var(--arena-text)",
    fontWeight: 600,
    fontSize: "0.9375rem",
  },
  primaryActive: {
    padding: "8px 14px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "white",
    background: "var(--arena-accent)",
    fontWeight: 600,
    fontSize: "0.9375rem",
  },
};

type Props = {
  /** dear: Center/Landing 등 산ctuary·Dear 톤 */
  theme?: "arena" | "dear";
  showLangSwitch?: boolean;
  /** Arena 헤더: 허브 링크 오른쪽에 Lang·Logout 등 */
  trailing?: ReactNode;
};

export default function HubTopNav({ theme = "arena", showLangSwitch = false, trailing }: Props) {
  const pathname = usePathname() || "/";
  const locale = detectLocale(pathname);
  const ctx = detectHubContext(pathname, locale);
  const isKo = locale === "ko";
  const t = getMessages(locale).nav;

  const center = `/${locale}/center`;
  const { contract: arenaEntry } = useArenaEntryResolution(isKo ? "ko" : "en");
  const arena = arenaEntry.href;
  const foundry = `/${locale}/bty/foundry`;

  const primaryActive =
    ctx === "center" ? "center" : ctx === "arena" ? "arena" : ctx === "foundry" ? "foundry" : null;

  const L = {
    main: isKo ? "메인" : "Main",
    dashboard: "Dashboard",
    leaderboard: isKo ? "리더보드" : "Leaderboard",
    assessment: isKo ? "자가진단" : "Assessment",
    dearMe: "Dear Me",
    journal: isKo ? "저널" : "Journal",
    dojo: "Dojo",
    integrity: isKo ? "진실성" : "Integrity",
    mentor: "Mentor",
    elite: "Elite",
  };

  if (theme === "arena") {
    const pill = (href: string, label: string, active: boolean) => (
      <Link
        key={href}
        href={href}
        style={active ? arenaNav.active : arenaNav.link}
        className="bty-hub-sub-link"
        data-active={active ? "true" : undefined}
      >
        {label}
      </Link>
    );

    const hubPill = (href: string, label: string, hub: "center" | "arena" | "foundry") => {
      const active = primaryActive === hub;
      return (
        <Link
          key={href}
          href={href}
          style={active ? arenaNav.primaryActive : arenaNav.primary}
          className="bty-hub-primary-link"
        >
          {label}
        </Link>
      );
    };

    let secondary: ReactNode = null;
    if (ctx === "arena") {
      const m = arena;
      const d = `/${locale}/bty/dashboard`;
      const lb = `/${locale}/bty/leaderboard`;
      secondary = (
        <div style={arenaNav.wrap} className="bty-hub-secondary mt-1" aria-label={isKo ? "아레나 하위 메뉴" : "Arena sub navigation"}>
          {pill(m, L.main, isActivePath(pathname, m))}
          {pill(d, L.dashboard, isActivePath(pathname, d))}
          {pill(lb, L.leaderboard, isActivePath(pathname, lb))}
        </div>
      );
    } else if (ctx === "foundry") {
      const routes = [
        [`/${locale}/bty/foundry`, L.main],
        [`/${locale}/bty/dashboard`, L.dashboard],
        [`/${locale}/bty/dojo`, L.dojo],
        [`/${locale}/bty/integrity`, L.integrity],
        [`/${locale}/bty/mentor`, L.mentor],
        [`/${locale}/bty/elite`, L.elite],
        [`/${locale}/bty/leaderboard`, L.leaderboard],
      ] as const;
      secondary = (
        <div style={arenaNav.wrap} className="bty-hub-secondary mt-1" aria-label={isKo ? "훈련장 하위 메뉴" : "Foundry sub navigation"}>
          {routes.map(([href, label]) => pill(href, label, isActivePath(pathname, href)))}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-end min-w-0 w-full sm:w-auto">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end w-full">
          <div style={arenaNav.wrap} className="bty-hub-primary justify-end" aria-label={isKo ? "허브 이동" : "Hub navigation"}>
            {hubPill(center, t.center, "center")}
            {hubPill(arena, t.arena, "arena")}
            {hubPill(foundry, isKo ? "훈련장" : "Foundry", "foundry")}
          </div>
          {trailing ? (
            <span className="flex shrink-0 items-center gap-3 border-l border-[var(--arena-text-soft)]/30 pl-3 ml-1">
              {trailing}
            </span>
          ) : null}
        </div>
        {secondary ? <div className="w-full flex justify-end sm:justify-end mt-1">{secondary}</div> : null}
      </div>
    );
  }

  /* dear theme: Center / Arena / Foundry + optional second row + Lang */
  const muted = "text-dear-charcoal-soft hover:underline";
  const activeDear = "font-medium text-dear-charcoal underline";
  const hubLink = (href: string, label: string, hub: "center" | "arena" | "foundry") => (
    <Link
      key={href}
      href={href}
      className={primaryActive === hub ? activeDear : muted}
      aria-current={primaryActive === hub ? "page" : undefined}
    >
      {label}
    </Link>
  );

  const subLink = (href: string, label: string) => {
    const on = isActivePath(pathname, href);
    return (
      <Link key={href} href={href} className={on ? activeDear : muted} aria-current={on ? "page" : undefined}>
        {label}
      </Link>
    );
  };

  let secondRow: ReactNode = null;
  if (ctx === "center") {
    secondRow = (
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm mt-2" aria-label={isKo ? "센터 메뉴" : "Center menu"}>
        {subLink(center, L.main)}
        {subLink(`/${locale}/assessment`, L.assessment)}
        {subLink(`/${locale}/dear-me`, L.dearMe)}
        {subLink(`/${locale}/journal`, L.journal)}
      </div>
    );
  }

  return (
    <nav className="w-full" aria-label={isKo ? "주요 메뉴" : "Main navigation"}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        {hubLink(center, t.center, "center")}
        {hubLink(arena, t.arena, "arena")}
        {hubLink(foundry, isKo ? "훈련장" : "Foundry", "foundry")}
        {showLangSwitch && (
          <>
            <span className="text-dear-charcoal-soft/60">|</span>
            <LangSwitch />
          </>
        )}
      </div>
      {secondRow}
    </nav>
  );
}
