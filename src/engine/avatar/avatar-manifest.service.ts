/**
 * Avatar tier manifest + compositing resolution.
 *
 * Tier-only constants/helpers (no equip-conflict): `avatar-manifest-tier.ts` — use that module from
 * client-only UI (e.g. Arena `AvatarComposite`) to keep bundles free of `resolveCompositeAssets`.
 */

export * from "./avatar-manifest-tier";

import { assetTypeForEquipConflict } from "./avatar-equip-conflict";
import {
  AVATAR_MANIFEST,
  getOutfitLayers,
  type AvatarAssetLayerType,
  type AvatarManifestTierId,
} from "./avatar-manifest-tier";

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
 * Z-ordered drawable layers for Foundry {@link AvatarComposite}: manifest defaults + unlock flags,
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
