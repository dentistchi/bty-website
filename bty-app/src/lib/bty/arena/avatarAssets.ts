/**
 * AVATAR_LAYER_SPEC §2.2: 키 → URL 매핑 및 resolveAvatarUrls.
 * characterAssetMap, outfitAssetMap, accessoryAssetMap + resolveAvatarUrls({ characterKey, outfitKey?, accessoryKeys?, useThumb? }).
 *
 * §1·§3 avatar-assets.json 연동: outfit/accessory ID 목록은 avatar-assets.data(→ public/avatars/avatar-assets.json)와 동기화.
 * URL 규칙: 캐릭터·옷은 실제 에셋 파일명 매핑(avatarCharacters/avatarOutfits), 악세사리 /avatars/accessories/{id}.svg|.png.
 */

import { AVATAR_CHARACTERS } from "@/lib/bty/arena/avatarCharacters";
import {
  getAccessoryImageUrl,
  getOutfitImageUrlForBodyType,
  type AvatarOutfitTheme,
} from "@/lib/bty/arena/avatarOutfits";
import {
  OUTFITS_PROFESSIONAL,
  OUTFITS_FANTASY,
  ACCESSORY_IDS_ALL,
} from "@/lib/bty/arena/avatar-assets.data";

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

function buildOutfitAssetMap(): Record<string, OutfitAssetEntry> {
  const map: Record<string, OutfitAssetEntry> = {};
  for (const id of OUTFITS_PROFESSIONAL) {
    const key = `professional_outfit_${id}`;
    const url = getOutfitImageUrlForBodyType(id);
    map[key] = { layer: url, thumb: url, theme: "professional" };
  }
  for (const id of OUTFITS_FANTASY) {
    const key = `fantasy_outfit_${id}`;
    const url = getOutfitImageUrlForBodyType(id);
    map[key] = { layer: url, thumb: url, theme: "fantasy" };
  }
  return map;
}

export const outfitAssetMap: Record<string, OutfitAssetEntry> =
  buildOutfitAssetMap();

/** 악세사리 키 → layer URL, thumb(선택). avatar-assets.json dental+game 전체. */
export type AccessoryAssetEntry = { layer: string; thumb?: string };

export const accessoryAssetMap: Record<string, AccessoryAssetEntry> =
  Object.fromEntries(
    ACCESSORY_IDS_ALL.map((id) => {
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
