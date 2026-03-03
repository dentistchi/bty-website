/**
 * AVATAR_LAYER_SPEC §2.2: 키 → URL 매핑 및 resolveAvatarUrls.
 * characterAssetMap, outfitAssetMap, accessoryAssetMap + resolveAvatarUrls({ characterKey, outfitKey?, accessoryKeys?, useThumb? }).
 */

import { AVATAR_CHARACTERS } from "@/lib/bty/arena/avatarCharacters";
import {
  getAccessoryImageUrl,
  type AvatarOutfitTheme,
} from "@/lib/bty/arena/avatarOutfits";
const OUTFIT_IMAGE_BASE = "/avatars/outfits";

/** 캐릭터 키 → base URL, thumb(선택). thumb 없으면 base 사용. */
export const characterAssetMap: Record<
  string,
  { base: string; thumb?: string }
> = Object.fromEntries(
  AVATAR_CHARACTERS.map((c) => [
    c.id,
    { base: c.imageUrl, thumb: c.imageUrl },
  ])
);

/** 옷 키(theme_outfit_outfitId) → layer URL, thumb(선택), theme. */
export type OutfitAssetEntry = {
  layer: string;
  thumb?: string;
  theme: AvatarOutfitTheme;
};

const PROFESSIONAL_OUTFIT_IDS = [
  "scrub_general",
  "figs_scrub",
  "doctor_gown",
  "surgery_coat_suit",
  "brand_suit",
  "figs_scrub_short",
  "shorts_tee",
] as const;
const FANTASY_OUTFIT_IDS = [
  "apprentice",
  "adventurer",
  "journeyer",
  "warrior_mage_mid",
  "senior",
  "senior_plus",
  "master",
] as const;

function buildOutfitAssetMap(): Record<string, OutfitAssetEntry> {
  const map: Record<string, OutfitAssetEntry> = {};
  for (const id of PROFESSIONAL_OUTFIT_IDS) {
    const key = `professional_outfit_${id}`;
    const url = `${OUTFIT_IMAGE_BASE}/outfit_${id}.png`;
    map[key] = { layer: url, thumb: url, theme: "professional" };
  }
  for (const id of FANTASY_OUTFIT_IDS) {
    const key = `fantasy_outfit_${id}`;
    const url = `${OUTFIT_IMAGE_BASE}/outfit_${id}.png`;
    map[key] = { layer: url, thumb: url, theme: "fantasy" };
  }
  return map;
}

export const outfitAssetMap: Record<string, OutfitAssetEntry> =
  buildOutfitAssetMap();

/** 악세사리 키 → layer URL, thumb(선택). */
export type AccessoryAssetEntry = { layer: string; thumb?: string };

const ACCESSORY_IDS = [
  "handpiece",
  "dental_mirror",
  "dental_mirror_premium",
  "explorer",
  "xray_portable",
  "apron",
  "surgical_gloves",
  "mask",
  "loupes",
  "goggles",
  "goggles_premium",
  "weapon",
  "hat",
  "glasses",
  "accessory",
];

export const accessoryAssetMap: Record<string, AccessoryAssetEntry> =
  Object.fromEntries(
    ACCESSORY_IDS.map((id) => {
      const url = getAccessoryImageUrl(id);
      return [id, { layer: url, thumb: url }];
    })
  );

/** acc_ 접두어 제거 후 id로 사용 (예: acc_crown_01 → crown_01). */
function accessoryKeyToUrl(key: string, useThumb: boolean): string | null {
  const entry = accessoryAssetMap[key];
  if (entry) return useThumb ? entry.thumb ?? entry.layer : entry.layer;
  const id = key.startsWith("acc_") ? key.slice(4) : key;
  const url = getAccessoryImageUrl(id);
  return url || null;
}

export type ResolveAvatarUrlsParams = {
  characterKey: string;
  outfitKey?: string | null;
  accessoryKeys?: string[];
  useThumb?: boolean;
};

export type ResolveAvatarUrlsResult = {
  characterUrl: string | null;
  outfitUrl: string | null;
  accessoryUrls: string[];
};

/**
 * 아바타 복합용 URL 해석. 리더보드/대시보드에서는 useThumb: true 권장.
 */
export function resolveAvatarUrls({
  characterKey,
  outfitKey,
  accessoryKeys = [],
  useThumb = false,
}: ResolveAvatarUrlsParams): ResolveAvatarUrlsResult {
  const charEntry = characterKey
    ? characterAssetMap[characterKey.trim()]
    : undefined;
  const characterUrl = charEntry
    ? useThumb
      ? charEntry.thumb ?? charEntry.base
      : charEntry.base
    : null;

  let outfitUrl: string | null = null;
  if (outfitKey && typeof outfitKey === "string") {
    const k = outfitKey.trim();
    const entry = outfitAssetMap[k];
    if (entry) {
      outfitUrl = useThumb ? entry.thumb ?? entry.layer : entry.layer;
    }
  }

  const accessoryUrls = accessoryKeys
    .filter((k): k is string => typeof k === "string" && k.trim() !== "")
    .map((k) => accessoryKeyToUrl(k.trim(), useThumb))
    .filter((u): u is string => u != null);

  return { characterUrl, outfitUrl, accessoryUrls };
}
