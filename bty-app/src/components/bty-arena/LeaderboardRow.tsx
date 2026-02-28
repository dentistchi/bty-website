"use client";

import React from "react";
import { UserAvatar } from "./UserAvatar";

export interface LeaderboardRowProps {
  rank: number;
  /** Code name only (no real name). */
  codeName: string;
  /** Sub name (optional). Shown as "codeName · subName" when present. */
  subName?: string | null;
  /** Weekly XP value (rendered as-is from API). */
  weeklyXp: number;
  /** Avatar URL (optional). When null, UserAvatar shows fallback. */
  avatarUrl?: string | null;
  /** Highlight as current user row. */
  isMe?: boolean;
}

/**
 * Single leaderboard row. Displays rank, avatar, code name, and weekly XP.
 * No business logic; all values from API.
 */
export function LeaderboardRow({
  rank,
  codeName,
  subName,
  weeklyXp,
  avatarUrl,
  isMe = false,
}: LeaderboardRowProps) {
  const displayName = subName ? `${codeName} · ${subName}` : codeName;
  const initials = codeName.slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        border: isMe ? "2px solid #5B4B8A" : "1px solid #eee",
        background: isMe ? "rgba(91, 75, 138, 0.08)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid #eee",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
          }}
        >
          {rank}
        </div>
        <UserAvatar avatarUrl={avatarUrl} initials={initials} size="sm" />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{displayName}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Code Name</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{weeklyXp}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Weekly XP</div>
      </div>
    </div>
  );
}
