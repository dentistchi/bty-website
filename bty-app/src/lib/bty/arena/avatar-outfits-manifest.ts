/**
 * Static manifest for outfit overlays under `public/avatars/outfits/`.
 * File naming: base `outfit_{id}.png` (see {@link OUTFIT_ID_TO_FILENAME} in avatarOutfits.ts);
 * body overlays: `outfit_{id}_A.png` … `_D.png` (suffix before `.png`).
 * Color tone variants 0–3 use the **same** PNG; UI applies CSS hue-rotate (see public/avatars/outfits/README.md).
 */

import { OUTFIT_IDS } from "@/lib/bty/arena/avatar-assets.data";

/** Matches {@link BodyType} in avatarCharacters — overlay filenames use this suffix. */
export const OUTFIT_BODY_TYPES = ["A", "B", "C", "D"] as const;
export type OutfitBodyTypeId = (typeof OUTFIT_BODY_TYPES)[number];

/** CSS / UI color variant indices (0 = default hue, 1–3 = rotated). Same asset URL for all. */
export const OUTFIT_COLOR_VARIANTS = [0, 1, 2, 3] as const;
export type OutfitColorVariantId = (typeof OUTFIT_COLOR_VARIANTS)[number];

export type OutfitRarityTier = 1 | 2 | 3 | 4 | 5;

/** Same basename map as avatarOutfits.ts — keep in sync when adding disk files. */
const OUTFIT_ID_TO_FILENAME: Record<string, string> = {
  scrub_general: "outfit_scrub_general.png",
  figs_scrub: "outfit_figs_scrub.png",
  doctor_gown: "outfit_doctor_gown.png",
  surgery_coat_suit: "outfit_surgery_coat_suit.png",
  brand_suit: "outfit_brand_suit.png",
  figs_scrub_short: "outfit_figs_scrub_short.png",
  shorts_tee: "outfit_shorts_tee.png",
};

const OUTFIT_BASE = "/avatars/outfits";

function filenameForOutfitId(outfitId: string): string {
  return OUTFIT_ID_TO_FILENAME[outfitId] ?? `outfit_${outfitId}.png`;
}

function displayNameForOutfitId(outfitId: string): string {
  const core = outfitId.replace(/^\d+_/, "");
  return core
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Rarity 1–5 by catalog position (common → elite). */
function rarityForIndex(index: number): OutfitRarityTier {
  const step = Math.min(5, Math.max(1, Math.floor(index / 4) + 1));
  return step as OutfitRarityTier;
}

export type AvatarOutfitManifestEntry = {
  id: string;
  name: string;
  rarity: OutfitRarityTier;
  /** Overlay URLs: base PNG, per-body A–D, and four color-variant slots (same base; UI hue-rotate). */
  paths: {
    base: string;
    body: Record<OutfitBodyTypeId, string>;
    colorVariants: Record<OutfitColorVariantId, string>;
  };
};

function buildEntry(outfitId: string, index: number): AvatarOutfitManifestEntry {
  const file = filenameForOutfitId(outfitId);
  const base = `${OUTFIT_BASE}/${file}`;
  const stem = file.replace(/\.png$/i, "");
  const body = Object.fromEntries(
    OUTFIT_BODY_TYPES.map((b) => [b, `${OUTFIT_BASE}/${stem}_${b}.png`]),
  ) as Record<OutfitBodyTypeId, string>;

  const colorVariants = Object.fromEntries(
    OUTFIT_COLOR_VARIANTS.map((v) => [v, base]),
  ) as Record<OutfitColorVariantId, string>;

  return {
    id: outfitId,
    name: displayNameForOutfitId(outfitId),
    rarity: rarityForIndex(index),
    paths: { base, body, colorVariants },
  };
}

/** Full outfit overlay manifest (public/avatars/outfits) — body A–D + four color variant slots. */
export const avatarOutfits: readonly AvatarOutfitManifestEntry[] = OUTFIT_IDS.map((id, i) =>
  buildEntry(id, i),
);
