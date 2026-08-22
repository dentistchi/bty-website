"use client";

import React from "react";
import PrivacyAwareLogoutLink from "@/components/auth/PrivacyAwareLogoutLink";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pathnameMatchesArenaEntryHref } from "@/components/bty/navigation/nav-items";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages } from "@/lib/i18n";

function detectLocale(pathname: string): "en" | "ko" {
  if (pathname.startsWith("/ko")) return "ko";
  return "en";
}

function isActive(pathname: string, href: string) {
  return pathnameMatchesArenaEntryHref(pathname, href);
}

/** Arena 스타일: 메인(/bty)에서는 Arena 강조, 활성 = 둥근 배경+강조색 */
const navStyle = {
  wrap: {
    display: "flex" as const,
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  link: {
    padding: "8px 14px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "var(--arena-text)",
    background: "transparent",
    transition: "background 0.15s ease, color 0.15s ease",
    fontSize: "inherit",
  },
  linkArena: {
    padding: "10px 16px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "var(--arena-text)",
    background: "transparent",
    transition: "background 0.15s ease, color 0.15s ease",
    fontWeight: 600,
    fontSize: "0.9375rem",
  },
  active: {
    padding: "8px 14px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "white",
    background: "var(--arena-accent)",
    transition: "background 0.15s ease, color 0.15s ease",
    fontSize: "inherit",
  },
  activeArena: {
    padding: "10px 16px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "white",
    background: "var(--arena-accent)",
    transition: "background 0.15s ease, color 0.15s ease",
    fontWeight: 600,
    fontSize: "0.9375rem",
  },
};

type Props = { showLogout?: boolean };

export default function BtyTopNav({ showLogout = true }: Props) {
  const pathname = usePathname() || "/";
  const locale = detectLocale(pathname);
  const { contract: arenaEntry } = useArenaEntryResolution(locale === "ko" ? "ko" : "en");
  const arenaHref = arenaEntry.href;

  const main = `/${locale}/bty`;
  const dash = `/${locale}/bty/dashboard`;
  const lb = `/${locale}/bty/leaderboard`;
  const logout = `/${locale}/bty/logout?next=/${locale}/bty/login`;

  const mainLabel = locale === "ko" ? "메인" : "Main";
  const isMainPage = pathname === `/${locale}/bty` || pathname === `/${locale}/bty/`;
  const logoutLabel = getMessages(locale).logout;

  const link = (href: string, label: string, useArenaStyle = false) => {
    const active = href === logout ? false : isActive(pathname, href);
    const style = useArenaStyle
      ? (active ? navStyle.activeArena : navStyle.linkArena)
      : (active ? navStyle.active : navStyle.link);
    return (
      <Link
        href={href}
        style={style}
        className="bty-nav-link"
        data-active={active ? "true" : undefined}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav style={navStyle.wrap}>
      {link(arenaHref, "Arena", isMainPage)}
      {link(main, mainLabel)}
      {link(dash, "Dashboard")}
      {link(lb, "Leaderboard")}
      {/*
        Sign out renders through PrivacyAwareLogoutLink so this device's unfinished learner
        drafts go with the session (R4-R5C4A-R2). The shared `link()` helper is deliberately
        untouched — it still serves Arena / Main / Dashboard / Leaderboard, which must not
        acquire a logout side effect. Same href, same label, same style: `active` is hard-coded
        false for logout, so nothing about its appearance changes.
      */}
      {showLogout && (
        <PrivacyAwareLogoutLink href={logout} style={navStyle.link} className="bty-nav-link">
          {logoutLabel}
        </PrivacyAwareLogoutLink>
      )}
    </nav>
  );
}
