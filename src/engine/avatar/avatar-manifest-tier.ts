/**
 * Tier manifest only — **no** equip-conflict / unlock-data / DB imports.
 * Safe for client-only bundles (e.g. Arena {@link AvatarComposite} in `src/components/bty-arena`).
 *
 * Full compositing + tint resolution: `avatar-manifest.service.ts` re-exports this module and adds
 * {@link resolveCompositeAssets}.
 */

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
