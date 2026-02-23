"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { locale?: "en" | "ko" };

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  const base = href.split("?")[0];
  return pathname === base || pathname.startsWith(base + "/");
}

export default function BtyTopNav({ locale = "en" }: Props) {
  const pathname = usePathname() ?? "";
  const dash = `/${locale}/bty/dashboard`;
  const arena = `/${locale}/bty-arena`;
  const lb = `/${locale}/bty/leaderboard`;
  const logout = `/${locale}/bty/logout?next=/${locale}/bty/login`;

  const linkStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    textDecoration: "none",
    color: "inherit",
    background: "white",
  };

  const primaryStyle: React.CSSProperties = {
    ...linkStyle,
    border: "1px solid #111",
    background: "#111",
    color: "white",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={dash} style={isActive(pathname, dash) ? primaryStyle : linkStyle}>
          Dashboard
        </Link>
        <Link href={arena} style={isActive(pathname, arena) ? primaryStyle : linkStyle}>
          Arena
        </Link>
        <Link href={lb} style={isActive(pathname, lb) ? primaryStyle : linkStyle}>
          Leaderboard
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={logout} style={linkStyle}>
          Logout
        </Link>
      </div>
    </div>
  );
}
