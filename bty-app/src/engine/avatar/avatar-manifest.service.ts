/**
 * Single source of truth for avatar tier display: thresholds, labels, badge shapes,
 * colors, accessory slot limits, and **outfit layer compositing** (z-order, defaults).
 * Consumed by {@link AvatarRenderer}, {@link AvatarComposite}, and {@link computeTier}
 * via {@link AVATAR_TIER_THRESHOLDS}.
 */

import { assetTypeForEquipConflict } from "./avatar-outfit-unlock.service";

export type AvatarManifestTierId = 0 | 1 | 2 | 3 | 4;

export type TierBadgeShape = "circle" | "shield" | "diamond" | "crown" | "star";

export type AvatarAssetLayerType = "base" | "outfit" | "accessory" | "badge";

/**
 * One drawable layer in the composite stack. `default_asset_id` matches
 * {@link ASSET_UNLOCK_MAP} / `user_avatar_assets.asset_id` where applicable.
 */
export type OutfitLayer = {
  layer_id: string;
  z_index: number;
  asset_type: AvatarAssetLayerType;
  default_asset_id: string;
};

export type AvatarTierManifest = {
  tier: AvatarManifestTierId;
  label_ko: string;
  label_en: string;
  shape: TierBadgeShape;
  color_active: "#1D9E75";
  color_inactive: "#B4B2A9";
  xp_threshold: 0 | 500 | 1500 | 3500 | 7000;
  asset_slots: 1 | 2 | 3 | 4 | 5;
  /** Per-tier compositing order (bottom → top); length matches `asset_slots`. */
  outfit_layers: OutfitLayer[];
};

/** Ordered list of five tier rows (tier 0 → 4). */
export type AvatarManifest = readonly AvatarTierManifest[];

const ACTIVE = "#1D9E75" as const;
const INACTIVE = "#B4B2A9" as const;

/**
 * Z-ordered layer definitions per tier (tier0 = 1 layer … tier4 = 5 layers).
 * Aligns with {@link ASSET_UNLOCK_MAP} in `avatar-assets.service.ts`.
 */
export const OUTFIT_MANIFEST: Record<AvatarManifestTierId, OutfitLayer[]> = {
  0: [
    {
      layer_id: "base",
      z_index: 0,
      asset_type: "base",
      default_asset_id: "avatar_base",
    },
  ],
  1: [
    {
      layer_id: "base",
      z_index: 0,
      asset_type: "base",
      default_asset_id: "avatar_base",
    },
    {
      layer_id: "accessory_1",
      z_index: 1,
      asset_type: "accessory",
      default_asset_id: "accessory_slot_1",
    },
  ],
  2: [
    {
      layer_id: "base",
      z_index: 0,
      asset_type: "base",
      default_asset_id: "avatar_base",
    },
    {
      layer_id: "outfit_pro",
      z_index: 1,
      asset_type: "outfit",
      default_asset_id: "outfit_theme_professional",
    },
    {
      layer_id: "accessory_2",
      z_index: 2,
      asset_type: "accessory",
      default_asset_id: "accessory_slot_2",
    },
  ],
  3: [
    {
      layer_id: "base",
      z_index: 0,
      asset_type: "base",
      default_asset_id: "avatar_base",
    },
    {
      layer_id: "outfit_fantasy",
      z_index: 1,
      asset_type: "outfit",
      default_asset_id: "outfit_theme_fantasy",
    },
    {
      layer_id: "accessory_3",
      z_index: 2,
      asset_type: "accessory",
      default_asset_id: "accessory_slot_3",
    },
    {
      layer_id: "palette_basic",
      z_index: 3,
      asset_type: "accessory",
      default_asset_id: "palette_basic",
    },
  ],
  4: [
    {
      layer_id: "base",
      z_index: 0,
      asset_type: "base",
      default_asset_id: "avatar_base",
    },
    {
      layer_id: "character",
      z_index: 1,
      asset_type: "base",
      default_asset_id: "character_default",
    },
    {
      layer_id: "outfit_fantasy",
      z_index: 2,
      asset_type: "outfit",
      default_asset_id: "outfit_theme_fantasy",
    },
    {
      layer_id: "accessory_4",
      z_index: 3,
      asset_type: "accessory",
      default_asset_id: "accessory_slot_4",
    },
    {
      layer_id: "frame_legend",
      z_index: 4,
      asset_type: "badge",
      default_asset_id: "frame_legend",
    },
  ],
};

/**
 * Canonical tier table: Core XP lower bounds, KO/EN labels, badge geometry, UI colors,
 * max accessory image layers, and {@link outfit_layers} for {@link AvatarComposite}.
 */
export const AVATAR_MANIFEST: AvatarManifest = [
  {
    tier: 0,
    label_ko: "스타터",
    label_en: "Starter",
    shape: "circle",
    color_active: ACTIVE,
    color_inactive: INACTIVE,
    xp_threshold: 0,
    asset_slots: 1,
    outfit_layers: OUTFIT_MANIFEST[0],
  },
  {
    tier: 1,
    label_ko: "루키",
    label_en: "Rookie",
    shape: "shield",
    color_active: ACTIVE,
    color_inactive: INACTIVE,
    xp_threshold: 500,
    asset_slots: 2,
    outfit_layers: OUTFIT_MANIFEST[1],
  },
  {
    tier: 2,
    label_ko: "프로",
    label_en: "Pro",
    shape: "diamond",
    color_active: ACTIVE,
    color_inactive: INACTIVE,
    xp_threshold: 1500,
    asset_slots: 3,
    outfit_layers: OUTFIT_MANIFEST[2],
  },
  {
    tier: 3,
    label_ko: "엘리트",
    label_en: "Elite",
    shape: "crown",
    color_active: ACTIVE,
    color_inactive: INACTIVE,
    xp_threshold: 3500,
    asset_slots: 4,
    outfit_layers: OUTFIT_MANIFEST[3],
  },
  {
    tier: 4,
    label_ko: "레전드",
    label_en: "Legend",
    shape: "star",
    color_active: ACTIVE,
    color_inactive: INACTIVE,
    xp_threshold: 7000,
    asset_slots: 5,
    outfit_layers: OUTFIT_MANIFEST[4],
  },
];

/** Core XP band lower bounds — aligned with {@link AVATAR_MANIFEST} `xp_threshold`. */
export const AVATAR_TIER_THRESHOLDS = [
  AVATAR_MANIFEST[0].xp_threshold,
  AVATAR_MANIFEST[1].xp_threshold,
  AVATAR_MANIFEST[2].xp_threshold,
  AVATAR_MANIFEST[3].xp_threshold,
  AVATAR_MANIFEST[4].xp_threshold,
] as const;

export function getManifestForTier(tier: number): AvatarTierManifest {
  if (!Number.isInteger(tier) || tier < 0 || tier > 4) {
    throw new Error(`Invalid avatar tier: ${String(tier)}`);
  }
  return AVATAR_MANIFEST[tier];
}

export function getFullManifest(): AvatarManifest {
  return AVATAR_MANIFEST;
}

/** Compositing layer stack for `tier` (same reference as `getManifestForTier(tier).outfit_layers`). */
export function getOutfitLayers(tier: AvatarManifestTierId): OutfitLayer[] {
  if (!Number.isInteger(tier) || tier < 0 || tier > 4) {
    throw new Error(`Invalid avatar tier: ${String(tier)}`);
  }
  return OUTFIT_MANIFEST[tier];
}

function outfitTintForAssetId(assetId: string): string {
  if (assetId.includes("professional")) return "rgba(30, 64, 175, 0.95)";
  if (assetId.includes("fantasy")) return "rgba(124, 58, 237, 0.95)";
  return "rgba(29, 158, 117, 0.95)";
}

/** Canonical palette aligned with {@link AVATAR_MANIFEST} `color_active` (teal) + five alternates. */
export const OUTFIT_TINT_SWATCHES = [
  { key: "teal", hex: "#1D9E75", label_ko: "틸" },
  { key: "amber", hex: "#BA7517", label_ko: "앰버" },
  { key: "purple", hex: "#7F77DD", label_ko: "퍼플" },
  { key: "coral", hex: "#D85A30", label_ko: "코랄" },
  { key: "blue", hex: "#378ADD", label_ko: "블루" },
  { key: "gray", hex: "#888780", label_ko: "그레이" },
] as const;

/**
 * Stored #RGB / #RRGGBB → multiply tint rgba for outfit layer (matches previous defaults’ alpha).
 */
export function outfitTintCssFromStored(stored: string): string {
  const s = stored.trim();
  const hex6 = /^#([0-9A-Fa-f]{6})$/;
  const hex3 = /^#([0-9A-Fa-f]{3})$/;
  let r: number;
  let g: number;
  let b: number;
  const m6 = s.match(hex6);
  if (m6) {
    r = parseInt(m6[1]!.slice(0, 2), 16);
    g = parseInt(m6[1]!.slice(2, 4), 16);
    b = parseInt(m6[1]!.slice(4, 6), 16);
    return `rgba(${r},${g},${b},0.95)`;
  }
  const m3 = s.match(hex3);
  if (m3) {
    const h = m3[1]!;
    r = parseInt(h[0]! + h[0]!, 16);
    g = parseInt(h[1]! + h[1]!, 16);
    b = parseInt(h[2]! + h[2]!, 16);
    return `rgba(${r},${g},${b},0.95)`;
  }
  return s;
}

/**
 * Z-ordered drawable layers for {@link AvatarComposite}: manifest defaults + unlock flags,
 * outfit tint, radial accessory indices, and tier badge copy.
 */
export type ResolvedLayer = {
  layer_id: string;
  z_index: number;
  asset_type: AvatarAssetLayerType;
  asset_id: string;
  unlocked: boolean;
  /** Outfit multiply tint (CSS color); set when `asset_type === "outfit"`. */
  tint?: string;
  /** Accessory slot on the radial ring; set when `asset_type === "accessory"`. */
  radial_index?: number;
  radial_total?: number;
  /** Tier name under badge; set when `asset_type === "badge"`. */
  label_ko?: string;
  label_en?: string;
};

function partitionEquippedForLayers(
  equippedAssets: string[] | undefined,
  unlocked: Set<string>,
): {
  base: string[];
  outfit: string[];
  accessory: string[];
  badge: string[];
} {
  const out = {
    base: [] as string[],
    outfit: [] as string[],
    accessory: [] as string[],
    badge: [] as string[],
  };
  if (!equippedAssets?.length) return out;
  for (const id of equippedAssets) {
    if (!unlocked.has(id)) continue;
    const t = assetTypeForEquipConflict(id);
    if (t === "base") out.base.push(id);
    else if (t === "outfit") out.outfit.push(id);
    else if (t === "accessory") out.accessory.push(id);
    else out.badge.push(id);
  }
  return out;
}

/**
 * Resolves drawable layers. Optional `equippedBySlot` (index = `z_index`) overrides per layer when
 * the id is unlocked. Otherwise optional `equippedAssets` pools by asset type in z-order.
 */
export function resolveCompositeAssets(
  tier: AvatarManifestTierId,
  unlockedAssets: string[],
  equippedAssets?: string[],
  /** When set (per `z_index` 0..4), overrides that layer’s `asset_id` if the id is unlocked. */
  equippedBySlot?: (string | null)[] | null,
  /** Per `asset_id` stored hex (e.g. `#1D9E75`) → outfit multiply tint override. */
  outfitTintByAssetId?: Record<string, string> | null,
): ResolvedLayer[] {
  const unlocked = new Set(unlockedAssets);
  const sorted = getOutfitLayers(tier)
    .slice()
    .sort((a, b) => a.z_index - b.z_index);

  const pools = partitionEquippedForLayers(equippedAssets, unlocked);
  const pb = [...pools.base];
  const po = [...pools.outfit];
  const pa = [...pools.accessory];
  const pbd = [...pools.badge];

  const resolved: { L: (typeof sorted)[number]; asset_id: string }[] = sorted.map((L) => {
    let asset_id = L.default_asset_id;
    const slotOverride = equippedBySlot?.[L.z_index];
    if (
      typeof slotOverride === "string" &&
      slotOverride.trim() !== "" &&
      unlocked.has(slotOverride)
    ) {
      asset_id = slotOverride;
    } else if (equippedAssets?.length) {
      if (L.asset_type === "base") asset_id = pb.shift() ?? L.default_asset_id;
      else if (L.asset_type === "outfit") asset_id = po.shift() ?? L.default_asset_id;
      else if (L.asset_type === "accessory") asset_id = pa.shift() ?? L.default_asset_id;
      else if (L.asset_type === "badge") asset_id = pbd.shift() ?? L.default_asset_id;
    }

    return { L, asset_id };
  });

  const accessoryOnly = resolved.filter((x) => x.L.asset_type === "accessory");
  const radialTotal = accessoryOnly.length;
  const manifestRow = AVATAR_MANIFEST[tier];

  return resolved.map(({ L, asset_id }) => {
    const base = {
      layer_id: L.layer_id,
      z_index: L.z_index,
      asset_type: L.asset_type,
      asset_id,
      unlocked: unlocked.has(asset_id),
    };

    if (L.asset_type === "outfit") {
      const stored = outfitTintByAssetId?.[asset_id];
      return {
        ...base,
        tint: stored
          ? outfitTintCssFromStored(stored)
          : outfitTintForAssetId(asset_id),
      };
    }
    if (L.asset_type === "accessory") {
      const radialIndex = accessoryOnly.findIndex((x) => x.L.layer_id === L.layer_id);
      return {
        ...base,
        radial_index: radialIndex >= 0 ? radialIndex : 0,
        radial_total: Math.max(1, radialTotal),
      };
    }
    if (L.asset_type === "badge") {
      return {
        ...base,
        label_ko: manifestRow.label_ko,
        label_en: manifestRow.label_en,
      };
    }
    return base;
  });
}
