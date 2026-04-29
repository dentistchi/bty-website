"use client";

/**
 * Avatar tier hub: GET `/api/bty/avatar/snapshot` → fast paint, then `Promise.all` full state + equipped;
 * {@link getFullManifest} for shapes/labels/slots, 200ms skeleton, active tier badge (72px), progression row + equipped dot,
 * {@link resolveCompositeAssets} z-layers, Core XP arc; Realtime unchanged.
 */

import React from "react";
import { getSupabase } from "@/lib/supabase";
import { getEquippedState as fetchClientEquipped } from "@/lib/bty/avatar/getEquippedState";
import {
  getLatestSnapshot,
  invalidateSnapshot,
  persistSnapshot,
  type AvatarSnapshot,
} from "@/lib/bty/avatar/avatarSnapshot";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import {
  getFullManifest,
  resolveCompositeAssets,
  type AvatarTierManifest,
  type ResolvedLayer,
  type TierBadgeShape,
} from "@/engine/avatar/avatar-manifest.service";
import {
  AVATAR_TIER_THRESHOLDS,
  computeTier,
  nextAvatarTierProgress,
  type AvatarTier,
} from "@/engine/avatar/avatar-state.service";
import type { AvatarStateApi, CoreXpBreakdownApi } from "./AvatarRenderer";
import {
  useAvatarAnimation,
  type AvatarAnimationControllerHandle,
} from "./AvatarAnimationController";
import {
  EQUIPPED_STATE_CHANGED_EVENT,
  type EquippedStateChangedPayload,
} from "@/engine/avatar/avatar-equipped-state.service";

const ACTIVE_PX = 72 as const;
const MINI_PX = 24 as const;
const ASSET_DOT_PX = 16 as const;
/** Exported for scaled mini previews (e.g. {@link AvatarCustomizerPanel}). */
export const ARC_WRAP_PX = 104 as const;
const ARC_R = 42 as const;
const ARC_STROKE = 4 as const;
/** Orbit radius so 16px dots stay inside {@link ARC_WRAP_PX} (center = ARC_WRAP_PX/2). */
const RADIAL_R = 36 as const;
const TIER_PULSE_MS = 300 as const;
const STYLE_ID = "avatar-composite-tier-pulse";
const EQUIP_BADGE_PX = 4 as const;

const EMPTY_BREAKDOWN: CoreXpBreakdownApi = {
  arenaPct: 0,
  labPct: 0,
  foundryPct: 0,
  mentorPct: 0,
  otherPct: 0,
};

function padEquippedSlots(raw: (string | null)[] | null | undefined): (string | null)[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  const out = raw.map((x) =>
    typeof x === "string" && x.trim() !== "" ? x.trim() : null,
  );
  while (out.length < 5) out.push(null);
  return out.slice(0, 5);
}

function equippedSnapshotMismatch(
  snap: AvatarSnapshot | null,
  full: AvatarStateApi,
  fullSlots: (string | null)[] | null,
): boolean {
  if (!snap) return false;
  if (snap.current_tier !== full.current_tier) return true;
  const a = JSON.stringify(padEquippedSlots(snap.equipped_slots));
  const b = JSON.stringify(padEquippedSlots(fullSlots ?? full.equipped_slots ?? undefined));
  if (a !== b) return true;
  const sa = [...(snap.equipped_asset_ids ?? [])].sort().join(",");
  const sb = [...(full.equipped_asset_ids ?? [])].sort().join(",");
  if (sa !== sb) return true;
  const ta = JSON.stringify(snap.outfit_tint_by_asset_id ?? {});
  const tb = JSON.stringify(full.outfit_tint_by_asset_id ?? {});
  return ta !== tb;
}

/** Gray outline placeholders matching tier row + arc + caption band (≥200ms display). */
function AvatarCompositeSkeleton({ loc }: { loc: "ko" | "en" }) {
  const stroke = "#e5e7eb";
  const c = ARC_WRAP_PX / 2;
  const circum = 2 * Math.PI * ARC_R;
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label={loc === "ko" ? "아바타 로딩" : "Loading avatar"}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}
    >
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: MINI_PX,
              height: MINI_PX,
              border: `1px solid ${stroke}`,
              borderRadius: i % 2 === 0 ? "50%" : 6,
              opacity: 0.95,
            }}
          />
        ))}
      </div>
      <div style={{ position: "relative", width: ARC_WRAP_PX, height: ARC_WRAP_PX, margin: "0 auto" }}>
        <svg width={ARC_WRAP_PX} height={ARC_WRAP_PX} aria-hidden>
          <circle
            cx={c}
            cy={c}
            r={ARC_R}
            fill="none"
            stroke={stroke}
            strokeWidth={ARC_STROKE}
          />
          <circle
            cx={c}
            cy={c}
            r={ARC_R}
            fill="none"
            stroke={stroke}
            strokeWidth={ARC_STROKE}
            strokeDasharray={`${circum * 0.35} ${circum}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        </svg>
      </div>
      <div style={{ width: 200, height: 10, borderRadius: 4, border: `1px solid ${stroke}` }} />
      <div style={{ width: 160, height: 8, borderRadius: 4, border: `1px solid ${stroke}`, opacity: 0.8 }} />
    </section>
  );
}

function clampTier(n: number): AvatarTier {
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return n as AvatarTier;
}

/** SVG geometry keyed by manifest `shape` (viewBox 48×48). */
export function TierShapeSvg({
  shape,
  fill,
  size,
}: {
  shape: TierBadgeShape;
  fill: string;
  size: number;
}) {
  const vb = "0 0 48 48";
  const common = { fill, opacity: 0.95 as const };

  let inner: React.ReactNode;
  switch (shape) {
    case "circle":
      inner = <circle cx="24" cy="24" r="18" {...common} />;
      break;
    case "shield":
      inner = (
        <path
          d="M 24 6 L 38 10 L 38 26 C 38 34 24 44 24 44 C 24 44 10 34 10 26 L 10 10 Z"
          {...common}
        />
      );
      break;
    case "diamond":
      inner = <polygon points="24,6 41,24 24,42 7,24" {...common} />;
      break;
    case "crown":
      inner = (
        <path
          d="M 8 40 L 8 30 L 10 30 L 10 22 L 14 28 L 18 18 L 22 26 L 24 16 L 26 26 L 30 18 L 34 28 L 38 22 L 38 30 L 40 30 L 40 40 Z"
          {...common}
        />
      );
      break;
    case "star":
      inner = (
        <polygon
          points="24,4 29.5,17.5 44,18.5 33,28 36.5,42.5 24,35.5 11.5,42.5 15,28 4,18.5 18.5,17.5"
          {...common}
        />
      );
      break;
    default:
      inner = <circle cx="24" cy="24" r="18" {...common} />;
  }

  return (
    <svg viewBox={vb} width={size} height={size} aria-hidden>
      {inner}
    </svg>
  );
}

/** Renders {@link ResolvedLayer} from {@link resolveCompositeAssets} — tier shape base, outfit tint, radial accessories, tier label. */
export function CompositeLayerViews({
  layers,
  activeManifest,
  bumpPulse,
  loc,
  cx,
  cy,
}: {
  layers: ResolvedLayer[];
  activeManifest: AvatarTierManifest;
  bumpPulse: boolean;
  loc: "ko" | "en";
  cx: number;
  cy: number;
}) {
  const fill = activeManifest.color_active;
  const half = ASSET_DOT_PX / 2;
  const sorted = [...layers].sort((a, b) => a.z_index - b.z_index);

  const accessoriesUnlocked = sorted.filter((l) => l.asset_type === "accessory" && l.unlocked);
  const radialN = Math.max(1, accessoriesUnlocked.length);

  const badgeRow = sorted.find((l) => l.asset_type === "badge");
  const labelEmphasis = badgeRow ? badgeRow.unlocked : true;

  return (
    <>
      {sorted.map((layer) => {
        const zi = 40 + layer.z_index;

        if (layer.asset_type === "base") {
          if (layer.layer_id !== "base") return null;
          return (
            <div
              key={layer.layer_id}
              className={bumpPulse ? "avatar-composite-tier-pulse" : undefined}
              style={{
                position: "absolute",
                left: (ARC_WRAP_PX - ACTIVE_PX) / 2,
                top: (ARC_WRAP_PX - ACTIVE_PX) / 2,
                width: ACTIVE_PX,
                height: ACTIVE_PX,
                zIndex: zi,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <TierShapeSvg shape={activeManifest.shape} fill={fill} size={ACTIVE_PX} />
            </div>
          );
        }

        if (layer.asset_type === "outfit") {
          if (!layer.unlocked) return null;
          return (
            <div
              key={layer.layer_id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: ACTIVE_PX + 8,
                height: ACTIVE_PX + 8,
                marginLeft: -(ACTIVE_PX + 8) / 2,
                marginTop: -(ACTIVE_PX + 8) / 2,
                borderRadius: "50%",
                background: fill,
                opacity: 0.16,
                mixBlendMode: "multiply",
                zIndex: zi,
                pointerEvents: "none",
              }}
              aria-hidden
            />
          );
        }

        if (layer.asset_type === "accessory") {
          if (!layer.unlocked) return null;
          const idx = accessoriesUnlocked.findIndex((x) => x.layer_id === layer.layer_id);
          if (idx < 0) return null;
          const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / radialN;
          const x = cx + RADIAL_R * Math.cos(angle) - half;
          const y = cy + RADIAL_R * Math.sin(angle) - half;
          return (
            <span
              key={layer.layer_id}
              title={layer.asset_id}
              aria-label={layer.asset_id}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: ASSET_DOT_PX,
                height: ASSET_DOT_PX,
                borderRadius: "50%",
                background: fill,
                boxSizing: "border-box",
                zIndex: zi,
                pointerEvents: "auto",
              }}
            />
          );
        }

        if (layer.asset_type === "badge") {
          return null;
        }

        return null;
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 6,
          textAlign: "center",
          zIndex: 200,
          fontSize: 11,
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.2,
          pointerEvents: "none",
          padding: "0 4px",
          opacity: labelEmphasis ? 1 : 0.45,
        }}
      >
        {loc === "ko" ? activeManifest.label_ko : activeManifest.label_en}
      </div>
    </>
  );
}

function XpArcRing({
  progress01,
  inactiveColor,
  activeColor,
}: {
  progress01: number;
  inactiveColor: string;
  activeColor: string;
}) {
  const c = ARC_WRAP_PX / 2;
  const circum = 2 * Math.PI * ARC_R;
  const dash = Math.max(0, Math.min(1, progress01)) * circum;

  return (
    <svg
      width={ARC_WRAP_PX}
      height={ARC_WRAP_PX}
      style={{ position: "absolute", left: 0, top: 0, zIndex: 0, pointerEvents: "none" }}
      aria-hidden
    >
      <circle
        cx={c}
        cy={c}
        r={ARC_R}
        fill="none"
        stroke={inactiveColor}
        strokeWidth={ARC_STROKE}
      />
      <circle
        cx={c}
        cy={c}
        r={ARC_R}
        fill="none"
        stroke={activeColor}
        strokeWidth={ARC_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circum}`}
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: "stroke-dasharray 0.35s ease" }}
      />
    </svg>
  );
}

export type AvatarCompositeProps = {
  userId: string;
  locale?: Locale | string;
  /** Optional Core XP override (e.g. leaderboard). */
  coreXp?: number;
  /**
   * Non-persisted equipped slots for customization preview. When non-null, overrides snapshot / equipped
   * resolution (merged unlock set includes any preview-only asset ids).
   */
  previewEquippedSlots?: (string | null)[] | null;
  /** Non-persisted outfit tint overrides for customization preview. */
  previewOutfitTints?: Record<string, string> | null;
};

export const AvatarComposite = React.forwardRef<
  AvatarAnimationControllerHandle,
  AvatarCompositeProps
>(function AvatarComposite(
  { userId, locale = "en", coreXp: coreXpContext, previewEquippedSlots, previewOutfitTints },
  ref,
) {
  const animTargetRef = React.useRef<HTMLDivElement | null>(null);
  const { triggerAnimation } = useAvatarAnimation(animTargetRef, userId.trim());
  React.useImperativeHandle(
    ref,
    () => ({
      triggerAnimation: (preset) => triggerAnimation(preset),
    }),
    [triggerAnimation],
  );

  const loc = locale === "ko" ? "ko" : "en";
  const t = getMessages(loc).bty;
  const manifest = getFullManifest();

  const [data, setData] = React.useState<AvatarStateApi | null>(null);
  /** Per `z_index` 0..4; refreshed via Realtime + `GET /api/bty/avatar/equipped`. */
  const [equippedSlots, setEquippedSlots] = React.useState<(string | null)[] | null>(null);
  const [minSkeletonElapsed, setMinSkeletonElapsed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bumpTier, setBumpTier] = React.useState<AvatarTier | null>(null);
  const displayedTierRef = React.useRef<AvatarTier | null>(null);
  const snapshotFromServerRef = React.useRef<AvatarSnapshot | null>(null);
  /** DB-backed {@link ResolvedLayer} stack from GET `/api/bty/avatar/snapshot` (instant arc layers). */
  const [serverComposite, setServerComposite] = React.useState<{
    tier: AvatarTier;
    layers: ResolvedLayer[];
  } | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => setMinSkeletonElapsed(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  const refreshEquippedOnly = React.useCallback(async () => {
    const uid = userId.trim();
    if (!uid) return;
    try {
      const next = await fetchClientEquipped(uid);
      setEquippedSlots(next.equipped_slots);
      setServerComposite(null);
    } catch {
      /* keep previous equipped list */
    }
  }, [userId]);

  const reconcileFull = React.useCallback(async () => {
    if (!userId.trim()) {
      setError(t.avatarRendererError);
      return;
    }
    setError(null);
    setServerComposite(null);
    try {
      const uid = userId.trim();
      const q = `/api/bty/avatar/state?userId=${encodeURIComponent(uid)}`;
      const [res, equippedPayload] = await Promise.all([
        fetch(q, { credentials: "include" }),
        fetchClientEquipped(uid).catch(() => null),
      ]);
      const json = (await res.json()) as AvatarStateApi & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      const full: AvatarStateApi = {
        ...json,
        core_xp_breakdown: json.core_xp_breakdown ?? { ...EMPTY_BREAKDOWN },
      };
      const slots =
        equippedPayload?.equipped_slots ??
        padEquippedSlots(full.equipped_slots ?? undefined);

      if (equippedSnapshotMismatch(snapshotFromServerRef.current, full, slots)) {
        invalidateSnapshot(uid);
      }
      snapshotFromServerRef.current = null;

      setData(full);
      setEquippedSlots(slots);
      persistSnapshot(uid, {
        user_id: full.user_id,
        current_tier: full.current_tier,
        unlocked_assets: full.unlocked_assets,
        equipped_asset_ids: full.equipped_asset_ids,
        equipped_slots: slots,
        outfit_tint_by_asset_id: full.outfit_tint_by_asset_id,
        core_xp_total: full.core_xp_total,
        tier_thresholds: full.tier_thresholds,
        core_xp_breakdown: full.core_xp_breakdown,
      });
    } catch {
      setError(t.avatarRendererError);
      setData((prev) => prev ?? null);
    }
  }, [userId, t.avatarRendererError]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) {
      setError(t.avatarRendererError);
      return;
    }
    let cancelled = false;

    void (async () => {
      const snap = await getLatestSnapshot(uid);
      if (cancelled) return;
      if (snap) {
        snapshotFromServerRef.current = snap;
        if (
          Array.isArray(snap.composite_layers) &&
          snap.composite_layers.length > 0 &&
          typeof snap.composite_tier === "number"
        ) {
          setServerComposite({
            tier: clampTier(snap.composite_tier),
            layers: snap.composite_layers,
          });
        }
        setData({
          user_id: snap.user_id,
          current_tier: snap.current_tier as AvatarTier,
          unlocked_assets: snap.unlocked_assets,
          equipped_asset_ids: snap.equipped_asset_ids,
          equipped_slots: snap.equipped_slots ?? null,
          outfit_tint_by_asset_id: snap.outfit_tint_by_asset_id,
          core_xp_total: snap.core_xp_total,
          tier_thresholds: snap.tier_thresholds,
          core_xp_breakdown: snap.core_xp_breakdown ?? { ...EMPTY_BREAKDOWN },
        });
        setEquippedSlots(padEquippedSlots(snap.equipped_slots));
      }
      await reconcileFull();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, t.avatarRendererError, reconcileFull]);

  const clearBumpLater = React.useCallback(() => {
    window.setTimeout(() => setBumpTier(null), TIER_PULSE_MS + 40);
  }, []);

  const triggerTierFx = React.useCallback(
    (opts?: { bumpTier?: AvatarTier | null }) => {
      if (opts?.bumpTier != null) {
        setBumpTier(opts.bumpTier);
        clearBumpLater();
      }
      void reconcileFull();
    },
    [reconcileFull, clearBumpLater],
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
      .channel(`avatar_composite:${uid}`)
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
            triggerTierFx({ bumpTier: next });
          } else {
            void reconcileFull();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_equipped_assets",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void refreshEquippedOnly();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_avatar_assets",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void reconcileFull();
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId, reconcileFull, triggerTierFx, refreshEquippedOnly]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;
    const onClientEquipped = (ev: Event) => {
      const ce = ev as CustomEvent<EquippedStateChangedPayload>;
      const d = ce.detail;
      if (!d || d.userId !== uid) return;
      void refreshEquippedOnly();
    };
    window.addEventListener(EQUIPPED_STATE_CHANGED_EVENT, onClientEquipped);
    return () => window.removeEventListener(EQUIPPED_STATE_CHANGED_EVENT, onClientEquipped);
  }, [userId, refreshEquippedOnly]);

  const mergedCore = React.useMemo(() => {
    if (!data) return 0;
    const raw =
      typeof coreXpContext === "number" && Number.isFinite(coreXpContext)
        ? Math.max(0, Math.floor(coreXpContext))
        : Math.max(0, Math.floor(data.core_xp_total));
    return raw;
  }, [data, coreXpContext]);

  React.useEffect(() => {
    if (!data) return;
    displayedTierRef.current = computeTier(mergedCore) as AvatarTier;
  }, [data, mergedCore]);

  const tierForUiResolved = React.useMemo(
    () => (data ? (computeTier(mergedCore) as AvatarTier) : (0 as AvatarTier)),
    [data, mergedCore],
  );

  const compositeLayers = React.useMemo(() => {
    if (!data) return [];
    const tintMerged: Record<string, string> = {
      ...(data.outfit_tint_by_asset_id ?? {}),
      ...(previewOutfitTints ?? {}),
    };
    const hasCustomTints = Object.keys(tintMerged).length > 0;

    if (previewEquippedSlots != null) {
      const mergedUnlocked = [...data.unlocked_assets];
      for (const s of previewEquippedSlots) {
        if (typeof s === "string" && s.trim() !== "") {
          const id = s.trim();
          if (!mergedUnlocked.includes(id)) mergedUnlocked.push(id);
        }
      }
      const slots = padEquippedSlots(previewEquippedSlots);
      return resolveCompositeAssets(
        tierForUiResolved,
        mergedUnlocked,
        undefined,
        slots,
        tintMerged,
      );
    }
    if (
      serverComposite &&
      serverComposite.layers.length > 0 &&
      serverComposite.tier === tierForUiResolved &&
      !hasCustomTints
    ) {
      return serverComposite.layers;
    }
    const slots =
      equippedSlots ?? padEquippedSlots(data.equipped_slots ?? undefined);
    const legacy = data.equipped_asset_ids ?? [];
    return resolveCompositeAssets(
      tierForUiResolved,
      data.unlocked_assets,
      slots != null ? undefined : legacy,
      slots,
      tintMerged,
    );
  }, [
    data,
    tierForUiResolved,
    equippedSlots,
    serverComposite,
    previewEquippedSlots,
    previewOutfitTints,
  ]);

  const showSkeleton = !error && (!data || !minSkeletonElapsed);

  if (error && !data) {
    return (
      <div role="alert" style={{ fontSize: 13, color: "#b91c1c" }}>
        {error ?? t.avatarRendererError}
      </div>
    );
  }

  if (showSkeleton) {
    return <AvatarCompositeSkeleton loc={loc} />;
  }

  if (!data) {
    return null;
  }

  const tierForUi = tierForUiResolved;
  const prog = nextAvatarTierProgress(mergedCore, tierForUi);
  const thresholds =
    Array.isArray(data.tier_thresholds) && data.tier_thresholds.length >= 5
      ? data.tier_thresholds
      : [...AVATAR_TIER_THRESHOLDS];

  const activeManifest: AvatarTierManifest = manifest[tierForUi];
  const bumpPulse = bumpTier !== null && bumpTier === tierForUi;
  const inactiveStroke = activeManifest.color_inactive;

  const tierOrder: AvatarTier[] = [0, 1, 2, 3, 4];

  const hasEquippedCosmetics =
    (equippedSlots ?? []).some((x) => x != null && String(x).trim() !== "") ||
    (data.equipped_asset_ids?.length ?? 0) > 0;

  return (
    <div
      ref={animTargetRef}
      className="bty-avatar-anim-target"
      role="region"
      aria-label={t.avatarRendererRegionAria}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}
    >
      <style id={STYLE_ID}>{`
        @keyframes avatarCompositeTierPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .avatar-composite-tier-pulse {
          transform-origin: center center;
          animation: avatarCompositeTierPulse ${TIER_PULSE_MS}ms ease-in-out;
        }
      `}</style>

      {/* 5 × inactive mini-shapes (tier progression) */}
      <div
        role="list"
        aria-label={loc === "ko" ? "티어 단계" : "Tier steps"}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {tierOrder.map((ti) => {
          const m = manifest[ti];
          const showEquippedDot = ti === tierForUi && hasEquippedCosmetics;
          return (
            <div
              key={m.tier}
              role="listitem"
              style={{
                position: "relative",
                width: MINI_PX,
                height: MINI_PX,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.85,
              }}
            >
              <TierShapeSvg shape={m.shape} fill={m.color_inactive} size={MINI_PX} />
              {showEquippedDot ? (
                <span
                  title={loc === "ko" ? "장착 중" : "Equipped"}
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: EQUIP_BADGE_PX,
                    height: EQUIP_BADGE_PX,
                    borderRadius: "50%",
                    background: "#1D9E75",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.9)",
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Arc (beneath) + active shape + radial assets */}
      <div
        style={{
          position: "relative",
          width: ARC_WRAP_PX,
          height: ARC_WRAP_PX,
          margin: "0 auto",
        }}
      >
        <XpArcRing
          progress01={prog.progress01}
          inactiveColor={typeof inactiveStroke === "string" ? inactiveStroke : "#e2e8f0"}
          activeColor={activeManifest.color_active}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}
        >
          <CompositeLayerViews
            layers={compositeLayers}
            activeManifest={activeManifest}
            bumpPulse={bumpPulse}
            loc={loc}
            cx={ARC_WRAP_PX / 2}
            cy={ARC_WRAP_PX / 2}
          />
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", maxWidth: 280 }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {mergedCore.toLocaleString(loc === "ko" ? "ko-KR" : "en-US")} /{" "}
          {prog.nextThresholdXp != null
            ? prog.nextThresholdXp.toLocaleString(loc === "ko" ? "ko-KR" : "en-US")
            : thresholds[4].toLocaleString(loc === "ko" ? "ko-KR" : "en-US")}{" "}
          Core XP
        </span>
        <div style={{ marginTop: 4, fontSize: 10, opacity: 0.85 }}>
          {thresholds.map((n) => n.toLocaleString(loc === "ko" ? "ko-KR" : "en-US")).join(" · ")}
        </div>
      </div>
    </div>
  );
});

AvatarComposite.displayName = "AvatarComposite";
