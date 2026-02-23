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

export default function BtyTopNav() {
  const pathname = usePathname() || "/";
  const locale = detectLocale(pathname);

  const dash = `/${locale}/bty/dashboard`;
  const arena = `/${locale}/bty-arena`;
  const lb = `/${locale}/bty/leaderboard`;
  const logout = `/${locale}/bty/logout?next=/${locale}/bty/login`;

  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    textDecoration: "none",
    color: "inherit",
    background: "white",
  };

  const activeStyle: React.CSSProperties = {
    ...base,
    border: "1px solid #111",
    background: "#111",
    color: "white",
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={dash} style={isActive(pathname, dash) ? activeStyle : base}>
          Dashboard
        </Link>
        <Link href={arena} style={isActive(pathname, arena) ? activeStyle : base}>
          Arena
        </Link>
        <Link href={lb} style={isActive(pathname, lb) ? activeStyle : base}>
          Leaderboard
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={logout} style={base}>
          Logout
        </Link>
      </div>
    </div>
  );
}
