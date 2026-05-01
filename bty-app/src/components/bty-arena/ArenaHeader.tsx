"use client";

import React from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";
import { getAccessoryImageUrl } from "@/lib/bty/arena/avatarOutfits";
import { AvatarComposite } from "./AvatarComposite";
import { UserAvatar } from "./UserAvatar";

export type ArenaStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ArenaPhase =
  | "CHOOSING"
  | "ESCALATION"
  | "FORCED_TRADEOFF"
  | "ACTION_DECISION"
  | "SHOW_RESULT"
  | "FOLLOW_UP"
  | "DONE";

/** Same fields as GET /api/arena/core-xp identity + layers (dashboard path). */
export type ArenaHeaderIdentity = {
  codeName: string;
  subName: string;
  avatarUrl: string | null;
  avatarCharacterId: string | null;
  avatarCharacterImageUrl: string | null;
  avatarOutfitImageUrl: string | null;
  accessoryIds: string[];
};

export type ArenaHeaderProps = {
  locale: Locale | string;
  step: ArenaStep;
  phase: ArenaPhase;
  runId: string | null;
  onPause: () => void;
  onReset: () => void;
  /** When false, Pause button is hidden. Default true. */
  showPause?: boolean;
  /** From core-xp — avatar + call sign; omit while loading. */
  identity?: ArenaHeaderIdentity | null;
};

export function ArenaHeader({
  locale,
  step: _step,
  phase: _phase,
  runId: _runId,
  onPause,
  onReset,
  showPause = true,
  identity,
}: ArenaHeaderProps) {
  const lang: Locale = locale === "ko" || locale === "en" ? locale : "en";
  const t = getMessages(lang).arenaRun;

  const resolvedAvatar = React.useMemo(() => {
    if (!identity) return null;
    const characterUrl =
      typeof identity.avatarCharacterImageUrl === "string" && identity.avatarCharacterImageUrl.trim() !== ""
        ? identity.avatarCharacterImageUrl.trim()
        : null;
    const outfitUrl =
      typeof identity.avatarOutfitImageUrl === "string" && identity.avatarOutfitImageUrl.trim() !== ""
        ? identity.avatarOutfitImageUrl.trim()
        : null;
    const accessoryUrls = (identity.accessoryIds ?? [])
      .map((id) => getAccessoryImageUrl(id))
      .filter((u): u is string => typeof u === "string" && u.trim() !== "");
    return { characterUrl, outfitUrl, accessoryUrls };
  }, [identity]);

  const displayAvatarUrl =
    identity?.avatarUrl ?? getAvatarCharacter(identity?.avatarCharacterId ?? undefined)?.imageUrl ?? null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty arena</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{t.headerTitle}</h1>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
          {t.headerSubtitle}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {identity && (
          <Link
            href={`/${lang}/bty/profile/avatar`}
            aria-label={t.headerIdentityLinkAria}
            className="flex max-w-[min(160px,28vw)] items-center gap-2 rounded-xl border border-bty-border/70 bg-bty-surface/90 px-2 py-1.5 shadow-sm ring-1 ring-bty-border/40"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bty-soft"
              aria-hidden
            >
              {resolvedAvatar?.characterUrl ? (
                <AvatarComposite
                  size={36}
                  characterUrl={resolvedAvatar.characterUrl}
                  outfitUrl={resolvedAvatar.outfitUrl ?? undefined}
                  accessoryUrls={resolvedAvatar.accessoryUrls}
                  alt=""
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserAvatar
                    avatarUrl={displayAvatarUrl}
                    initials={identity.codeName?.trim().slice(0, 2) || "?"}
                    alt=""
                    size="sm"
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-sm font-semibold leading-tight text-bty-navy"
                title={identity.codeName}
              >
                {identity.codeName.trim() || "—"}
              </div>
              {identity.subName.trim() ? (
                <div className="truncate text-[11px] leading-tight text-bty-secondary" title={identity.subName}>
                  {identity.subName}
                </div>
              ) : null}
            </div>
          </Link>
        )}
        <Link
          href={`/${lang}/bty`}
          aria-label={t.mainLabel}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            fontSize: 14,
          }}
        >
          {t.mainLabel}
        </Link>
        {showPause !== false && (
          <button
            type="button"
            onClick={onPause}
            aria-label={t.pauseLabel}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {t.pauseLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          aria-label={t.resetLabel}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          {t.resetLabel}
        </button>
      </div>
    </div>
  );
}
