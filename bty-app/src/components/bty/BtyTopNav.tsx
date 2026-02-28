"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function detectLocale(pathname: string): "en" | "ko" {
  if (pathname.startsWith("/ko")) return "ko";
  return "en";
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Arena 스타일: 활성 = 둥근 배경+강조색, 비활성 = 텍스트만, hover = 부드러운 배경 */
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
  },
  active: {
    padding: "8px 14px",
    borderRadius: 12,
    textDecoration: "none" as const,
    color: "white",
    background: "var(--arena-accent)",
    transition: "background 0.15s ease, color 0.15s ease",
  },
};

type Props = { showLogout?: boolean };

export default function BtyTopNav({ showLogout = true }: Props) {
  const pathname = usePathname() || "/";
  const locale = detectLocale(pathname);

  const main = `/${locale}/bty`;
  const dash = `/${locale}/bty/dashboard`;
  const arena = `/${locale}/bty-arena`;
  const lb = `/${locale}/bty/leaderboard`;
  const logout = `/${locale}/bty/logout?next=/${locale}/bty/login`;

  const mainLabel = locale === "ko" ? "메인" : "Main";

  const link = (href: string, label: string) => {
    const active = href === logout ? false : isActive(pathname, href);
    return (
      <Link
        href={href}
        style={active ? navStyle.active : navStyle.link}
        className="bty-nav-link"
        data-active={active ? "true" : undefined}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav style={navStyle.wrap}>
      {link(main, mainLabel)}
      {link(dash, "Dashboard")}
      {link(arena, "Arena")}
      {link(lb, "Leaderboard")}
      {showLogout && link(logout, "Logout")}
    </nav>
  );
}
