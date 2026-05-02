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

    const dash = `/${locale}/bty/dashboard`;
    const lb = `/${locale}/bty/leaderboard`;
    const myPage = `/${locale}/my-page`;
    const myAccount = `/${locale}/my-page/account`;

    return (
      <div className="flex flex-col items-end min-w-0 w-full sm:w-auto">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-end w-full">
          {/* Hub + extended nav */}
          <div style={arenaNav.wrap} className="bty-hub-primary justify-end" aria-label="Main navigation">
            {hubPill(center, "Center", "center")}
            {hubPill(arena, "Arena", "arena")}
            {hubPill(foundry, "Foundry", "foundry")}
          </div>
          <span style={{ color: "var(--arena-text-soft)", opacity: 0.3 }}>|</span>
          <div style={arenaNav.wrap}>
            {pill(dash, "Dashboard", isActivePath(pathname, dash))}
            {pill(lb, "Leaderboard", isActivePath(pathname, lb))}
            {pill(myPage, "My Page", isActivePath(pathname, myPage) && !isActivePath(pathname, myAccount))}
            {pill(myAccount, "My Account", isActivePath(pathname, myAccount))}
          </div>
          {trailing ? (
            <span className="flex shrink-0 items-center gap-3 border-l border-[var(--arena-text-soft)]/30 pl-3 ml-1">
              {trailing}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  /* dear theme: same pill structure as arena theme but for landing/center-adjacent pages */
  const pill2 = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      style={active ? arenaNav.active : arenaNav.link}
      className="bty-hub-sub-link"
    >
      {label}
    </Link>
  );

  const hubPill2 = (href: string, label: string, hub: "center" | "arena" | "foundry") => {
    const active = primaryActive === hub;
    return (
      <Link key={href} href={href} style={active ? arenaNav.primaryActive : arenaNav.primary} className="bty-hub-primary-link">
        {label}
      </Link>
    );
  };

  const dash2 = `/${locale}/bty/dashboard`;
  const lb2 = `/${locale}/bty/leaderboard`;
  const myPage2 = `/${locale}/my-page`;
  const myAccount2 = `/${locale}/my-page/account`;

  return (
    <div className="flex flex-col items-end min-w-0 w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-end w-full">
        <div style={arenaNav.wrap} className="bty-hub-primary justify-end" aria-label="Main navigation">
          {hubPill2(center, "Center", "center")}
          {hubPill2(arena, "Arena", "arena")}
          {hubPill2(foundry, "Foundry", "foundry")}
        </div>
        <span style={{ color: "var(--arena-text-soft)", opacity: 0.3 }}>|</span>
        <div style={arenaNav.wrap}>
          {pill2(dash2, "Dashboard", isActivePath(pathname, dash2))}
          {pill2(lb2, "Leaderboard", isActivePath(pathname, lb2))}
          {pill2(myPage2, "My Page", isActivePath(pathname, myPage2) && !isActivePath(pathname, myAccount2))}
          {pill2(myAccount2, "My Account", isActivePath(pathname, myAccount2))}
        </div>
        {showLangSwitch && (
          <span className="flex shrink-0 items-center gap-3 border-l border-[var(--arena-text-soft)]/30 pl-3 ml-1">
            <LangSwitch />
          </span>
        )}
      </div>
    </div>
  );
}
