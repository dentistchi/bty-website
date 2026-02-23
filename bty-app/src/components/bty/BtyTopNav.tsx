"use client";

import React from "react";
import Link from "next/link";

type Props = { locale?: "en" | "ko" };

export default function BtyTopNav({ locale = "en" }: Props) {
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
        <Link href={dash} style={linkStyle}>
          Dashboard
        </Link>
        <Link href={arena} style={primaryStyle}>
          Arena
        </Link>
        <Link href={lb} style={linkStyle}>
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
