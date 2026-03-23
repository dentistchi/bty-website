"use client";

/**
 * Avatar tier UI: GET `/api/bty/avatar/state` (`getAvatarState` + `getUnlockedAssets` + profile Core XP + `getCoreXPBreakdown`).
 * Five tier slots (0–4): `avatar-manifest.service` shapes (circle · shield · diamond · crown · star) @ 48px; slot frame **8px** radius; active **2px** solid `color_active` + **scale(1.1)**; inactive **0.5px** `color_inactive` + **scale(1)**.
 * Realtime `user_avatar_state` `current_tier` ↑ → **tierUp** on that slot only (`@keyframes tierUp` **300ms**).
 * `unlocked_assets[]`: row of 16px **#1D9E75** circles. Core XP bar + breakdown segments (fixed palette per source).
 */

import React from "react";
import { getSupabase } from "@/lib/supabase";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getManifestForTier, type TierBadgeShape } from "@/engine/avatar/avatar-manifest.service";
import {
  AVATAR_TIER_THRESHOLDS,
  computeTier,
  nextAvatarTierProgress,
  type AvatarTier,
} from "@/engine/avatar/avatar-state.service";

/** Mirrors API `core_xp_breakdown` from {@link getCoreXPBreakdown} (ledger positive deltas). */
export type CoreXpBreakdownApi = {
  arenaPct: number;
  labPct: number;
  foundryPct: number;
  mentorPct: number;
  otherPct: number;
};

export type AvatarStateApi = {
  user_id: string;
  current_tier: AvatarTier;
  unlocked_assets: string[];
  /** Selected cosmetics for display (POST `/api/bty/avatar/equip`). */
  equipped_asset_ids?: string[];
  /** Per `z_index` 0..4; from `user_equipped_assets`. */
  equipped_slots?: (string | null)[] | null;
  /** Outfit `asset_id` → stored `#RRGGBB` (POST `/api/bty/avatar/tint`). */
  outfit_tint_by_asset_id?: Record<string, string>;
  core_xp_total: number;
  tier_thresholds: number[];
  core_xp_breakdown: CoreXpBreakdownApi;
};

function formatCoreXpBreakdownSr(b: CoreXpBreakdownApi, prefix: string): string {
  const parts = [
    `ARENA ${b.arenaPct}%`,
    `LAB ${b.labPct}%`,
    `FOUNDRY ${b.foundryPct}%`,
    `MENTOR ${b.mentorPct}%`,
  ];
  if (b.otherPct > 0) parts.push(`OTHER ${b.otherPct}%`);
  return `${prefix}: ${parts.join(" · ")}`;
}

function clampTier(n: number): AvatarTier {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return n as AvatarTier;
}

const XP_SEG_COLORS = {
  arena: "#2563eb",
  lab: "#0891b2",
  foundry: "#7c3aed",
  mentor: "#d97706",
  other: "#64748b",
} as const;

function CoreXpSourceSegments({
  b,
  t,
  locale,
}: {
  b: CoreXpBreakdownApi;
  t: ReturnType<typeof getMessages>["bty"];
  locale: "ko" | "en";
}) {
  const seg = [
    { key: "arena", pct: b.arenaPct, color: XP_SEG_COLORS.arena, short: t.avatarRendererXpArena },
    { key: "lab", pct: b.labPct, color: XP_SEG_COLORS.lab, short: t.avatarRendererXpLab },
    { key: "foundry", pct: b.foundryPct, color: XP_SEG_COLORS.foundry, short: t.avatarRendererXpFoundry },
    { key: "mentor", pct: b.mentorPct, color: XP_SEG_COLORS.mentor, short: t.avatarRendererXpMentor },
    { key: "other", pct: b.otherPct, color: XP_SEG_COLORS.other, short: t.avatarRendererXpOther },
  ];
  const totalPct = seg.reduce((a, s) => a + Math.max(0, s.pct), 0);
  const hasAny = totalPct > 0;

  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>
        {t.avatarRendererCoreXpSegmentsAria}
      </p>
      <div
        role="img"
        aria-label={formatCoreXpBreakdownSr(b, t.avatarRendererCoreXpSources)}
        style={{
          display: "flex",
          height: 10,
          borderRadius: 6,
          overflow: "hidden",
          background: "#e2e8f0",
          border: "1px solid #e2e8f0",
        }}
      >
        {hasAny
          ? seg.map((s) =>
              s.pct > 0 ? (
                <div
                  key={s.key}
                  title={`${s.short}: ${s.pct}%`}
                  style={{
                    width: `${s.pct}%`,
                    minWidth: s.pct > 0 ? "2px" : 0,
                    background: s.color,
                    transition: "width 0.35s ease",
                  }}
                />
              ) : null,
            )
          : null}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 10px",
          marginTop: 6,
          fontSize: 10,
          color: "#64748b",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {seg.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                flexShrink: 0,
              }}
            />
            {s.short} {s.pct.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { maximumFractionDigits: 1 })}%
          </span>
        ))}
      </div>
    </div>
  );
}

const EMPTY_BREAKDOWN: CoreXpBreakdownApi = {
  arenaPct: 0,
  labPct: 0,
  foundryPct: 0,
  mentorPct: 0,
  otherPct: 0,
};

const TIER_SHAPE_PX = 48 as const;
const SLOT_FRAME_RADIUS_PX = 8 as const;
const TIER_UI_ACTIVE = getManifestForTier(0).color_active;

/** Distinct SVG per {@link TierBadgeShape} — viewBox 48×48, {@link TIER_SHAPE_PX}. */
function TierBadgeShape({ shape, fill }: { shape: TierBadgeShape; fill: string }) {
  const vb = "0 0 48 48";
  const common = { fill, opacity: 0.95 as const };

  switch (shape) {
    case "circle":
      return (
        <svg viewBox={vb} width="100%" height="100%" aria-hidden>
          <circle cx="24" cy="24" r="18" {...common} />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox={vb} width="100%" height="100%" aria-hidden>
          <path
            d="M 24 6 L 38 10 L 38 26 C 38 34 24 44 24 44 C 24 44 10 34 10 26 L 10 10 Z"
            {...common}
          />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox={vb} width="100%" height="100%" aria-hidden>
          <polygon points="24,6 41,24 24,42 7,24" {...common} />
        </svg>
      );
    case "crown":
      return (
        <svg viewBox={vb} width="100%" height="100%" aria-hidden>
          <path
            d="M 8 40 L 8 30 L 10 30 L 10 22 L 14 28 L 18 18 L 22 26 L 24 16 L 26 26 L 30 18 L 34 28 L 38 22 L 38 30 L 40 30 L 40 40 Z"
            {...common}
          />
        </svg>
      );
    case "star":
      return (
        <svg viewBox={vb} width="100%" height="100%" aria-hidden>
          <polygon
            points="24,4 29.5,17.5 44,18.5 33,28 36.5,42.5 24,35.5 11.5,42.5 15,28 4,18.5 18.5,17.5"
            {...common}
          />
        </svg>
      );
    default:
      return null;
  }
}

const AVATAR_RENDERER_STYLE_ID = "avatar-renderer-tier-upgrade-keyframes";

/** Realtime tier-up keyframe duration (ms). */
const TIER_UPGRADE_MS = 300 as const;

export type AvatarRendererProps = {
  userId: string;
  locale: Locale | string;
  /** When set (e.g. leaderboard row), overrides API Core XP for bar + tier highlight only. */
  coreXp?: number;
};

export function AvatarRenderer({ userId, locale, coreXp: coreXpContext }: AvatarRendererProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = getMessages(loc).bty;
  const breakdownSrId = React.useId();

  const [data, setData] = React.useState<AvatarStateApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  /** When set, that tier column plays the upgrade keyframe. */
  const [bumpTier, setBumpTier] = React.useState<AvatarTier | null>(null);
  /** Last rendered tier (for Realtime when `payload.old` is missing on insert). */
  const displayedTierRef = React.useRef<AvatarTier | null>(null);

  const load = React.useCallback(async () => {
    if (!userId.trim()) {
      setError(t.avatarRendererError);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const q = `/api/bty/avatar/state?userId=${encodeURIComponent(userId.trim())}`;
      const res = await fetch(q, { credentials: "include" });
      const json = (await res.json()) as AvatarStateApi & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      setData({
        ...json,
        core_xp_breakdown: json.core_xp_breakdown ?? { ...EMPTY_BREAKDOWN },
      });
    } catch {
      setError(t.avatarRendererError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, t.avatarRendererError]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const clearBumpLater = React.useCallback(() => {
    window.setTimeout(() => setBumpTier(null), TIER_UPGRADE_MS + 40);
  }, []);

  const triggerUpgradeFx = React.useCallback(
    (opts?: { bumpTier?: AvatarTier | null }) => {
      if (opts?.bumpTier != null) {
        setBumpTier(opts.bumpTier);
        clearBumpLater();
      }
      void load();
    },
    [load, clearBumpLater],
  );

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`avatar_state:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_avatar_state",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const prevRaw = payload.old?.current_tier;
          const nextRaw = payload.new?.current_tier;
          const prev =
            typeof prevRaw === "number"
              ? clampTier(prevRaw)
              : displayedTierRef.current != null
                ? displayedTierRef.current
                : null;
          const next = typeof nextRaw === "number" ? clampTier(nextRaw) : null;
          if (next != null && prev != null && next > prev) {
            triggerUpgradeFx({ bumpTier: next });
          } else {
            void load();
          }
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId, load, triggerUpgradeFx]);

  React.useEffect(() => {
    if (!data) return;
    const merged =
      typeof coreXpContext === "number" && Number.isFinite(coreXpContext)
        ? Math.max(0, Math.floor(coreXpContext))
        : Math.max(0, Math.floor(data.core_xp_total));
    displayedTierRef.current = computeTier(merged) as AvatarTier;
  }, [data, coreXpContext]);

  if (loading && !data) {
    return (
      <div role="status" aria-busy="true" aria-label={t.avatarRendererLoading}>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{t.avatarRendererLoading}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" style={{ fontSize: 13, color: "#b91c1c" }}>
        {error ?? t.avatarRendererError}
      </div>
    );
  }

  const mergedCore =
    typeof coreXpContext === "number" && Number.isFinite(coreXpContext)
      ? Math.max(0, Math.floor(coreXpContext))
      : Math.max(0, Math.floor(data.core_xp_total));

  const tierForUi = computeTier(mergedCore) as AvatarTier;
  const prog = nextAvatarTierProgress(mergedCore, tierForUi);
  const thresholds =
    Array.isArray(data.tier_thresholds) && data.tier_thresholds.length >= 5
      ? data.tier_thresholds
      : [...AVATAR_TIER_THRESHOLDS];

  const tierOrder: AvatarTier[] = [0, 1, 2, 3, 4];

  const coreXpBreakdownSr = formatCoreXpBreakdownSr(data.core_xp_breakdown, t.avatarRendererCoreXpSources);

  return (
    <section role="region" aria-label={t.avatarRendererRegionAria} style={{ maxWidth: 520 }}>
      <style id={AVATAR_RENDERER_STYLE_ID}>{`
        @keyframes tierUp {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .avatar-tier-upgrade-fx {
          transform-origin: center center;
          animation: tierUp ${TIER_UPGRADE_MS}ms ease-in-out;
        }
      `}</style>

      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "stretch",
          padding: 14,
          borderRadius: 16,
          background: "var(--arena-card, #f8fafc)",
          border: "1px solid #e2e8f0",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          {loc === "ko" ? "티어 진행" : "Tier progression"}
        </p>

        <div
          role="list"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {tierOrder.map((tier) => {
            const m = getManifestForTier(tier);
            const active = tier === tierForUi;
            const fill = active ? m.color_active : m.color_inactive;
            const bump = bumpTier === tier;

            return (
              <div
                key={tier}
                role="listitem"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: TIER_SHAPE_PX + 8,
                  minWidth: TIER_SHAPE_PX,
                }}
              >
                <div
                  className={bump ? "avatar-tier-upgrade-fx" : undefined}
                  aria-current={active ? "step" : undefined}
                  aria-label={loc === "ko" ? m.label_ko : m.label_en}
                  style={{
                    width: TIER_SHAPE_PX,
                    height: TIER_SHAPE_PX,
                    boxSizing: "border-box",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: SLOT_FRAME_RADIUS_PX,
                    border: active
                      ? `2px solid ${m.color_active}`
                      : `0.5px solid ${m.color_inactive}`,
                    outline: "none",
                    background: active ? "rgba(29, 158, 117, 0.08)" : "#f8fafc",
                    transform: bump ? undefined : active ? "scale(1.1)" : "scale(1.0)",
                    zIndex: active ? 2 : 1,
                    transition: bump
                      ? undefined
                      : "transform 0.35s ease, border-color 0.35s ease",
                  }}
                >
                  <div style={{ width: TIER_SHAPE_PX, height: TIER_SHAPE_PX }}>
                    <TierBadgeShape shape={m.shape} fill={fill} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          role="group"
          aria-label={t.avatarRendererUnlockedBadges}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
            alignItems: "center",
            minHeight: 16,
            marginTop: 10,
          }}
        >
          {data.unlocked_assets.map((id) => (
            <span
              key={id}
              title={id}
              aria-label={id}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: TIER_UI_ACTIVE,
                display: "block",
                flexShrink: 0,
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, color: "#94a3b8" }}>
          {loc === "ko" ? "구간 (Core XP)" : "Bands (Core XP)"}:{" "}
          {thresholds.map((n) => n.toLocaleString(loc === "ko" ? "ko-KR" : "en-US")).join(" / ")}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#475569",
            marginBottom: 4,
          }}
        >
          <span>{t.avatarRendererNextTierProgress}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {mergedCore.toLocaleString(loc === "ko" ? "ko-KR" : "en-US")} {t.avatarRendererCoreXpLabel}
          </span>
        </div>
        <span id={breakdownSrId} className="sr-only">
          {t.avatarRendererNextTierProgress}. {coreXpBreakdownSr}
        </span>
        {prog.nextThresholdXp != null ? (
          <>
            <div
              role="progressbar"
              aria-valuemin={prog.currentBandMinXp}
              aria-valuemax={prog.nextThresholdXp}
              aria-valuenow={mergedCore}
              aria-label={t.avatarRendererNextTierProgress}
              aria-describedby={breakdownSrId}
              style={{
                height: 8,
                borderRadius: 999,
                background: "#e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(prog.progress01 * 100)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${TIER_UI_ACTIVE}, #5eead4)`,
                  transition: "width 0.35s ease",
                }}
              />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
              → {prog.nextThresholdXp.toLocaleString(loc === "ko" ? "ko-KR" : "en-US")} XP
            </p>
          </>
        ) : (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }} aria-describedby={breakdownSrId}>
            {t.avatarRendererMaxTier}
          </p>
        )}
        <CoreXpSourceSegments b={data.core_xp_breakdown} t={t} locale={loc} />
      </div>
    </section>
  );
}
