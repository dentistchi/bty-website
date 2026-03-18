"use client";

import React from "react";
import { UserAvatar } from "./UserAvatar";
import { AvatarComposite } from "./AvatarComposite";

export interface LeaderboardRowProps {
  rank: number;
  /** Code name only (no real name). */
  codeName: string;
  /** Sub name (optional). Shown as "codeName · subName" when present. */
  subName?: string | null;
  /** Weekly XP value (rendered as-is from API). */
  weeklyXp: number;
  /** Avatar URL (optional). When null, UserAvatar shows fallback. Used when avatarLayers is not provided. */
  avatarUrl?: string | null;
  /** Character + outfit layers for stacked avatar display (§3). When set, UserAvatar uses layer composition. */
  avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null } | null;
  /** Weekly tier from API (e.g. Bronze, Silver, Gold, Platinum). Display only. */
  tier?: string | null;
  /** Highlight as current user row. */
  isMe?: boolean;
  /** Optional locale for number formatting (e.g. "en", "ko"). */
  locale?: string;
  /** `leaderboardTieRankSuffixDisplayKey` → i18n; 위 행과 동일 주간 XP일 때만. */
  tieRankSuffix?: string | null;
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
  avatarLayers,
  tier,
  isMe = false,
  locale,
  tieRankSuffix,
}: LeaderboardRowProps) {
  const displayName = subName ? `${codeName} · ${subName}` : codeName;
  const initials = codeName.slice(0, 2).toUpperCase();
  const formattedXp =
    typeof locale === "string"
      ? weeklyXp.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")
      : weeklyXp.toLocaleString();

  const isKo = locale === "ko";
  const tierBit =
    tier && tier !== "Code Name" ? (isKo ? `, 티어 ${tier}` : `, tier ${tier}`) : "";
  const tieAria =
    tieRankSuffix != null && tieRankSuffix !== "" ? `, ${tieRankSuffix}` : "";
  const rowAriaLabel = isKo
    ? `순위 ${rank}${tieAria}, ${displayName}${tierBit}, 주간 XP ${formattedXp}${isMe ? ", 나" : ""}`
    : `Rank ${rank}${tieAria}, ${displayName}${tierBit}, ${formattedXp} Weekly XP${isMe ? ", You" : ""}`;
  const statsGroupAria = isKo ? "주간 XP 및 티어" : "Weekly XP and tier";
  return (
    <div
      role="listitem"
      aria-label={rowAriaLabel}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        border: isMe ? "2px solid var(--arena-accent)" : "1px solid color-mix(in srgb, var(--arena-text-soft) 25%, transparent)",
        background: isMe ? "color-mix(in srgb, var(--arena-accent) 8%, transparent)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
        style={{
          minWidth: 34,
          minHeight: 34,
          padding: tieRankSuffix ? "4px 6px" : 0,
          borderRadius: 10,
          border: "1px solid color-mix(in srgb, var(--arena-text-soft) 30%, transparent)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
        }}
        >
          <span>{rank}</span>
          {tieRankSuffix ? (
            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, opacity: 0.85 }}>
              {tieRankSuffix}
            </span>
          ) : null}
        </div>
        {avatarLayers?.characterImageUrl ? (
          <AvatarComposite
            size={34}
            characterUrl={avatarLayers.characterImageUrl}
            outfitUrl={avatarLayers.outfitImageUrl ?? undefined}
            accessoryUrls={[]}
            alt={displayName}
          />
        ) : (
          <UserAvatar avatarUrl={avatarUrl} initials={initials} size="sm" />
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{displayName}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{tier ?? "Code Name"}</div>
        </div>
      </div>
      <div role="group" aria-label={statsGroupAria} style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{formattedXp}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{isKo ? "주간 XP" : "Weekly XP"}</div>
      </div>
    </div>
  );
}
