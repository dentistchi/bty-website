/**
 * Track D: Outfit theme (professional / fantasy) and level → outfit + accessories.
 * Professional = 치과 중심: Figs 스크럽, 핸드피스, 치과거울, explorer, X-ray portable, apron, 장갑, 마스크, loupes, 고글 등.
 * 캐릭터는 동일한 옷/악세사리 세트를 착용 가능(나중에 캐릭터별로 옷 바꿈).
 */

import type { LevelId } from "@/lib/bty/arena/tenure";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";

export type AvatarOutfitTheme = "professional" | "fantasy";

export type OutfitResult = {
  outfitId: string;
  outfitLabel: string;
  /** 악세사리 id 목록 (무기, 모자, 안경, 치과 도구 등) */
  accessoryIds: string[];
  /** 악세사리 표시명 (순서 동일) */
  accessoryLabels: string[];
  /** 합성 이미지 URL. 없으면 null → 캐릭터 베이스만 사용 */
  imageUrl: string | null;
};

/** 악세사리 카탈로그: id → 표시명 (치과·일반·판타지) */
export const ACCESSORY_CATALOG: Record<string, string> = {
  // Professional / 치과
  handpiece: "핸드피스",
  dental_mirror: "치과거울",
  dental_mirror_premium: "치과거울(고급)",
  explorer: "Explorer",
  xray_portable: "X-ray Portable",
  apron: "Apron",
  surgical_gloves: "수술 장갑",
  mask: "마스크",
  loupes: "Loupes",
  goggles: "고글",
  goggles_premium: "고글(고급)",
  // Fantasy / 소소한 악세사리
  weapon: "무기",
  hat: "모자",
  glasses: "안경",
  accessory: "악세사리",
};

/** Professional: S1 일반 스크럽 → L4 반바지/반팔티 (요청 매핑) */
const PROFESSIONAL_LEVEL_MAP: Record<
  LevelId,
  { outfitId: string; outfitLabel: string; accessoryIds: string[] }
> = {
  S1: {
    outfitId: "scrub_general",
    outfitLabel: "일반 스크럽",
    accessoryIds: ["apron", "goggles", "surgical_gloves", "mask"],
  },
  S2: {
    outfitId: "figs_scrub",
    outfitLabel: "Figs 스크럽",
    accessoryIds: ["dental_mirror"],
  },
  S3: {
    outfitId: "doctor_gown",
    outfitLabel: "의사 가운",
    accessoryIds: ["loupes", "dental_mirror", "goggles_premium"],
  },
  L1: {
    outfitId: "surgery_coat_suit",
    outfitLabel: "수술 코트 + 정장",
    accessoryIds: ["handpiece", "explorer", "dental_mirror_premium"],
  },
  L2: {
    outfitId: "brand_suit",
    outfitLabel: "브랜드 정장",
    accessoryIds: ["handpiece", "explorer", "loupes", "xray_portable"],
  },
  L3: {
    outfitId: "figs_scrub_short",
    outfitLabel: "반팔 Figs 스크럽",
    accessoryIds: ["explorer", "loupes", "xray_portable", "goggles"],
  },
  L4: {
    outfitId: "shorts_tee",
    outfitLabel: "반바지, 반팔티",
    accessoryIds: ["handpiece", "dental_mirror", "loupes", "xray_portable"],
  },
};

/** Fantasy: 레벨별 옷 + 소소한 무기/모자/안경 등 */
const FANTASY_LEVEL_MAP: Record<
  LevelId,
  { outfitId: string; outfitLabel: string; accessoryIds: string[] }
> = {
  S1: { outfitId: "apprentice", outfitLabel: "견습", accessoryIds: ["hat"] },
  S2: { outfitId: "adventurer", outfitLabel: "모험가", accessoryIds: ["weapon", "hat"] },
  S3: { outfitId: "journeyer", outfitLabel: "여행자", accessoryIds: ["weapon", "hat", "accessory"] },
  L1: {
    outfitId: "warrior_mage_mid",
    outfitLabel: "전사/마법/상인 중급",
    accessoryIds: ["weapon", "hat", "glasses"],
  },
  L2: { outfitId: "senior", outfitLabel: "시니어", accessoryIds: ["weapon", "hat", "glasses", "accessory"] },
  L3: { outfitId: "senior_plus", outfitLabel: "시니어+", accessoryIds: ["weapon", "hat", "glasses", "accessory"] },
  L4: { outfitId: "master", outfitLabel: "마스터", accessoryIds: ["weapon", "hat", "glasses", "accessory"] },
};

const DEFAULT_THEME: AvatarOutfitTheme = "professional";

/** 옷 이미지: /avatars/outfits/outfit_{outfitId}.png (저장 위치: bty-app/public/avatars/outfits/) */
const OUTFIT_IMAGE_BASE = "/avatars/outfits";

/** 캐릭터별 게임 스타일 옷 파일명 (fantasy 테마일 때 선택된 캐릭터에 따라 사용). 6종만 존재. */
const CHARACTER_OUTFIT_FILE: Record<string, string> = {
  hero_01: "hero_armor",
  mage_02: "mage_robe",
  scout_03: "scout_cloak",
  guardian_04: "guardian_armor",
  pilot_05: "pilot_jacket",
  healer_07: "healer_robe",
};

/** fantasy 테마 + 선택 캐릭터에 해당하는 게임 스타일 옷 이미지 URL. 없으면 null. */
export function getCharacterOutfitImageUrl(
  characterId: string | null | undefined
): string | null {
  if (!characterId || typeof characterId !== "string") return null;
  const file = CHARACTER_OUTFIT_FILE[characterId.trim()];
  return file ? `${OUTFIT_IMAGE_BASE}/outfit_${file}.png` : null;
}

/** 악세서리 이미지: 게임 35종은 .png, 나머지(치과 등)는 .svg — public/avatars/accessories/{id}.png|svg */
const GAME_ACCESSORY_IDS = new Set([
  "sword", "shield", "crown", "ring", "cloak", "wings", "halo", "bow", "staff", "potion", "gem", "coin", "key",
  "pet_cat", "pet_dragon", "pet_dog", "map", "compass", "lantern", "book", "scroll", "amulet", "bracelet", "boots",
  "helmet", "gauntlet", "dagger", "wand", "rune", "weapon", "hat", "glasses", "accessory", "quiver", "belt",
]);

export function getAccessoryImageUrl(accessoryId: string): string {
  const ext = GAME_ACCESSORY_IDS.has(accessoryId) ? "png" : "svg";
  return `/avatars/accessories/${accessoryId}.${ext}`;
}

/**
 * 레벨에 맞는 옷 + 악세사리 반환.
 * imageUrl: /avatars/outfits/outfit_{outfitId}.png (Professional 7종 + Fantasy 레벨별는 outfit_apprentice.png 등)
 */
export function getOutfitForLevel(
  theme: AvatarOutfitTheme | null | undefined,
  levelId: LevelId
): OutfitResult {
  const effectiveTheme = theme === "fantasy" ? "fantasy" : DEFAULT_THEME;
  const map = effectiveTheme === "fantasy" ? FANTASY_LEVEL_MAP : PROFESSIONAL_LEVEL_MAP;
  const entry = map[levelId];
  if (!entry) {
    return {
      outfitId: "default",
      outfitLabel: "기본",
      accessoryIds: [],
      accessoryLabels: [],
      imageUrl: null,
    };
  }
  const accessoryLabels = entry.accessoryIds.map(
    (id) => ACCESSORY_CATALOG[id] ?? id
  );
  const imageUrl = `${OUTFIT_IMAGE_BASE}/outfit_${entry.outfitId}.png`;
  return {
    outfitId: entry.outfitId,
    outfitLabel: entry.outfitLabel,
    accessoryIds: entry.accessoryIds,
    accessoryLabels,
    imageUrl,
  };
}

/** 레벨 순서 (스태프 → 리더) */
export const OUTFIT_LEVEL_IDS: LevelId[] = ["S1", "S2", "S3", "L1", "L2", "L3", "L4"];

/** 테마별 사용 가능한 outfit id 목록 (캐릭터 고정+옷 선택용). */
const PROFESSIONAL_OUTFIT_IDS = new Set(
  (Object.values(PROFESSIONAL_LEVEL_MAP) as { outfitId: string }[]).map((e) => e.outfitId)
);
const FANTASY_OUTFIT_IDS = new Set(
  (Object.values(FANTASY_LEVEL_MAP) as { outfitId: string }[]).map((e) => e.outfitId)
);

/** 테마별 옷 선택 옵션 (id, label). 대시보드 등에서 사용. */
export type OutfitOption = { outfitId: string; outfitLabel: string };
export const OUTFIT_OPTIONS_BY_THEME: Record<"professional" | "fantasy", OutfitOption[]> = {
  professional: (Object.values(PROFESSIONAL_LEVEL_MAP) as { outfitId: string; outfitLabel: string }[]).map(
    (e) => ({ outfitId: e.outfitId, outfitLabel: e.outfitLabel })
  ),
  fantasy: (Object.values(FANTASY_LEVEL_MAP) as { outfitId: string; outfitLabel: string }[]).map(
    (e) => ({ outfitId: e.outfitId, outfitLabel: e.outfitLabel })
  ),
};

/**
 * 테마 + outfit id로 옷 정보 반환. (캐릭터 고정+옷 선택: 유저가 고른 옷)
 * 해당 테마에 없는 id면 null.
 */
export function getOutfitById(
  theme: AvatarOutfitTheme | null | undefined,
  outfitId: string | null | undefined
): OutfitResult | null {
  if (!outfitId || typeof outfitId !== "string") return null;
  const id = outfitId.trim();
  const effectiveTheme = theme === "fantasy" ? "fantasy" : DEFAULT_THEME;
  const map = effectiveTheme === "fantasy" ? FANTASY_LEVEL_MAP : PROFESSIONAL_LEVEL_MAP;
  const set = effectiveTheme === "fantasy" ? FANTASY_OUTFIT_IDS : PROFESSIONAL_OUTFIT_IDS;
  if (!set.has(id)) return null;
  const entry = (Object.values(map) as { outfitId: string; outfitLabel: string; accessoryIds: string[] }[]).find(
    (e) => e.outfitId === id
  );
  if (!entry) return null;
  const accessoryLabels = entry.accessoryIds.map((aid) => ACCESSORY_CATALOG[aid] ?? aid);
  return {
    outfitId: entry.outfitId,
    outfitLabel: entry.outfitLabel,
    accessoryIds: entry.accessoryIds,
    accessoryLabels,
    imageUrl: `${OUTFIT_IMAGE_BASE}/outfit_${entry.outfitId}.png`,
  };
}

/**
 * Tier → LevelId for display-only (e.g. leaderboard avatar). Not used for unlock logic.
 * tier 0–4→S1, 5–9→S2, 10–14→S3, 15–19→L1, 20–24→L2, 25–29→L3, 30+→L4.
 */
export function tierToDisplayLevelId(tier: number): LevelId {
  const idx = Math.min(OUTFIT_LEVEL_IDS.length - 1, Math.max(0, Math.floor(tier / 5)));
  return OUTFIT_LEVEL_IDS[idx];
}

export type ResolveDisplayAvatarOptions = {
  customAvatarUrl: string | null;
  avatarCharacterId: string | null;
  avatarOutfitTheme: "professional" | "fantasy" | null;
  levelId: LevelId;
};

/**
 * Resolve avatar URL for display (leaderboard, dashboard).
 * 규칙: 캐릭터를 선택하면 그 캐릭터가 아바타. 옷/테마는 그 위에 레벨별로 표시(악세사리 등).
 */
export function resolveDisplayAvatarUrl(options: ResolveDisplayAvatarOptions): string | null {
  const { customAvatarUrl, avatarCharacterId, avatarOutfitTheme, levelId } = options;
  if (customAvatarUrl && customAvatarUrl.trim()) return customAvatarUrl.trim();

  const outfit = getOutfitForLevel(avatarOutfitTheme, levelId);

  if (avatarOutfitTheme === "fantasy") {
    const characterOutfitUrl = getCharacterOutfitImageUrl(avatarCharacterId);
    if (characterOutfitUrl) return characterOutfitUrl;
  }
  if (avatarCharacterId) {
    const character = getAvatarCharacter(avatarCharacterId);
    if (character?.imageUrl) return character.imageUrl;
  }
  if (outfit.imageUrl) return outfit.imageUrl;
  return null;
}
