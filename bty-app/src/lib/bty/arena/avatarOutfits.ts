/**
 * Track D: Outfit (저장 필드는 `avatar_outfit_theme` + `avatar_selected_outfit_id`; 테마는 레거시·호환용).
 * 매니페스트 옷은 **단일 목록** (`OUTFIT_IDS`); API/UI 키는 `outfit_{outfitId}`.
 * 향후 code/tier 해금은 `getUnifiedOutfitManifestAllowed` 등에서 필터.
 *
 * §1·§3: 옷 데이터·URL은 avatarOutfits·avatarAssets를 통해 Preview/썸네일에 전달.
 * 키 형식: `outfit_{outfitId}` (레거시: `professional_outfit_*` / `fantasy_outfit_*`).
 * 옷 이미지: /avatars/outfits/outfit_{outfitId}.png. 악세사리: /avatars/accessories/{id}.svg|.png (game→png).
 */

import type { LevelId } from "@/lib/bty/arena/tenure";
import type { AvatarCompositeKeys } from "@/types/arena";
import { getAvatarCharacter, type BodyType } from "@/lib/bty/arena/avatarCharacters";
import {
  GAME_ACCESSORY_IDS,
  ACCESSORY_IDS_ALL,
  OUTFIT_IDS,
} from "@/lib/bty/arena/avatar-assets.data";

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

/** 악세사리 카탈로그: id → 표시명. avatar-assets.json dental+game 전체 ID 포함, 누락 시 id 사용. */
const ACCESSORY_LABELS: Record<string, string> = {
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
  weapon: "무기",
  hat: "모자",
  glasses: "안경",
  accessory: "악세사리",
};
export const ACCESSORY_CATALOG: Record<string, string> = {
  ...ACCESSORY_LABELS,
  ...Object.fromEntries(
    ACCESSORY_IDS_ALL.filter((id) => !(id in ACCESSORY_LABELS)).map((id) => [id, id])
  ),
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

/** 레거시 플래그. 옷 UI는 통합 매니페스트만 사용. */
export const FANTASY_THEME_UI_READY = true;

/** 옷 이미지 베이스 (실제 파일명은 OUTFIT_ID_TO_FILENAME 매핑 사용) */
const OUTFIT_IMAGE_BASE = "/avatars/outfits";

/**
 * outfitId → 실제 파일명 매핑 (public/avatars/outfits/ 에 있는 파일 기준).
 * Professional 7종만 매핑; Fantasy/캐릭터용 옷은 에셋 추가 전까지 fallback.
 */
/** `public/avatars/outfits/` 파일명 — README `outfit_{outfitId}.png` 규칙과 동일 (공백·한글 제거). */
const OUTFIT_ID_TO_FILENAME: Record<string, string> = {
  scrub_general: "outfit_scrub_general.png",
  figs_scrub: "outfit_figs_scrub.png",
  doctor_gown: "outfit_doctor_gown.png",
  surgery_coat_suit: "outfit_surgery_coat_suit.png",
  brand_suit: "outfit_brand_suit.png",
  figs_scrub_short: "outfit_figs_scrub_short.png",
  shorts_tee: "outfit_shorts_tee.png",
};

/** outfitId → `public/avatars/outfits/` 파일명 (체형 접미사 전). */
export function getOutfitFilename(outfitId: string): string {
  return OUTFIT_ID_TO_FILENAME[outfitId] ?? `outfit_${outfitId}.png`;
}

/** 매니페스트 기준 유효 outfit id 집합 (단일 목록). */
const MANIFEST_SET = new Set(OUTFIT_IDS);

function findLevelMapEntryByOutfitId(id: string) {
  const pro = (
    Object.values(PROFESSIONAL_LEVEL_MAP) as {
      outfitId: string;
      outfitLabel: string;
      accessoryIds: string[];
    }[]
  ).find((e) => e.outfitId === id);
  if (pro) return pro;
  return (
    Object.values(FANTASY_LEVEL_MAP) as {
      outfitId: string;
      outfitLabel: string;
      accessoryIds: string[];
    }[]
  ).find((e) => e.outfitId === id);
}

function buildLegacyOutfitResult(entry: {
  outfitId: string;
  outfitLabel: string;
  accessoryIds: string[];
}): OutfitResult {
  const accessoryLabels = entry.accessoryIds.map((aid) => ACCESSORY_CATALOG[aid] ?? aid);
  return {
    outfitId: entry.outfitId,
    outfitLabel: entry.outfitLabel,
    accessoryIds: entry.accessoryIds,
    accessoryLabels,
    imageUrl: `${OUTFIT_IMAGE_BASE}/${encodeURIComponent(getOutfitFilename(entry.outfitId))}`,
  };
}

function getLegacyOutfitByTheme(theme: AvatarOutfitTheme, id: string): OutfitResult | null {
  const map = theme === "fantasy" ? FANTASY_LEVEL_MAP : PROFESSIONAL_LEVEL_MAP;
  const legacySet = theme === "fantasy" ? FANTASY_OUTFIT_IDS : PROFESSIONAL_OUTFIT_IDS;
  if (!legacySet.has(id)) return null;
  const entry = (
    Object.values(map) as {
      outfitId: string;
      outfitLabel: string;
      accessoryIds: string[];
    }[]
  ).find((e) => e.outfitId === id);
  if (!entry) return null;
  return buildLegacyOutfitResult(entry);
}

/**
 * 매니페스트 outfit id → UI 표시용 라벨 (예: `10_pediatric_dentistry_uniform` → "Pediatric Dentistry Uniform").
 * 선행 숫자+언더스코어는 제거 후 단어별 타이틀 케이스.
 */
export function outfitIdToDisplayLabel(outfitId: string): string {
  const core = outfitId.replace(/^\d+_/, "");
  return core
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * §4.2 bodyType별 옷 URL.
 * 체형 에셋이 있으면 `파일명_A.png` … `파일명_D.png` 규칙(확장자 앞에 `_${bodyType}`).
 * 해당 파일이 아직 없으면 404 → AvatarComposite가 레이어 숨김; 기본 파일만 있으면 bodyType 생략 권장.
 */
export function getOutfitImageUrlForBodyType(
  outfitId: string,
  bodyType?: BodyType | null
): string {
  const file = getOutfitFilename(outfitId);
  if (!bodyType) {
    return `${OUTFIT_IMAGE_BASE}/${encodeURIComponent(file)}`;
  }
  const bodyFile = file.replace(/\.png$/i, `_${bodyType}.png`);
  return `${OUTFIT_IMAGE_BASE}/${encodeURIComponent(bodyFile)}`;
}

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
  if (!file) return null;
  const filename = getOutfitFilename(file);
  return `${OUTFIT_IMAGE_BASE}/${encodeURIComponent(filename)}`;
}

/** 악세서리 이미지: avatar-assets.json game은 .png, dental은 .svg. 규칙: /avatars/accessories/{id}.svg|.png */
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
  const imageUrl = `${OUTFIT_IMAGE_BASE}/${encodeURIComponent(getOutfitFilename(entry.outfitId))}`;
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

/** AVATAR_LAYER_SPEC §3.2: UI용 허용 옷 한 건 (key = theme_outfit_outfitId) */
export type AllowedOutfitEntry = { key: string; name: string; rarity?: "common" | "rare" | "epic" };

/**
 * levelId 기준으로 열린 옷만 반환 (해당 레벨 이하에서 언락된 outfit id 수집).
 * key = `outfit_{outfitId}`.
 */
export function getAllowedOutfitsForLevel(
  theme: AvatarOutfitTheme,
  levelId: LevelId
): AllowedOutfitEntry[] {
  const map = theme === "fantasy" ? FANTASY_LEVEL_MAP : PROFESSIONAL_LEVEL_MAP;
  const levelIndex = OUTFIT_LEVEL_IDS.indexOf(levelId);
  const upTo = levelIndex < 0 ? 0 : levelIndex + 1;
  const seen = new Set<string>();
  const out: AllowedOutfitEntry[] = [];
  for (let i = 0; i < upTo; i++) {
    const lid = OUTFIT_LEVEL_IDS[i];
    const entry = map[lid];
    if (entry && !seen.has(entry.outfitId)) {
      seen.add(entry.outfitId);
      out.push({ key: `outfit_${entry.outfitId}`, name: entry.outfitLabel });
    }
  }
  return out;
}

/** tier 기반 악세사리 슬롯 수 (예: tier 25마다 1슬롯). */
export function accessorySlotsFromTier(tier: number): number {
  return Math.max(0, Math.floor(tier / 25));
}

/** 옷 선택 옵션 (id, label). 대시보드 등 — `avatar-assets.json` 매니페스트 전체. */
export type OutfitOption = { outfitId: string; outfitLabel: string };

/** 통합 매니페스트만 사용 (pro/fantasy 구분 없음). */
export const OUTFIT_OPTIONS_ALL: OutfitOption[] = OUTFIT_IDS.map((outfitId) => ({
  outfitId,
  outfitLabel: outfitIdToDisplayLabel(outfitId),
}));

/** @deprecated 레거시 호출부용. `getOutfitsForTheme`·`OUTFIT_OPTIONS_ALL` 사용. */
export const OUTFIT_OPTIONS_BY_THEME: Record<"professional" | "fantasy", OutfitOption[]> = {
  professional: OUTFIT_OPTIONS_ALL,
  fantasy: [],
};

/**
 * 프로필/아바타 UI용 허용 목록 — **전체 매니페스트** (해금 규칙은 추후 tier/code 필터).
 * 키 형식: `outfit_{id}`.
 */
export function getUnifiedOutfitManifestAllowed(): AllowedOutfitEntry[] {
  return OUTFIT_OPTIONS_ALL.map((o) => ({
    key: `outfit_${o.outfitId}`,
    name: o.outfitLabel,
  }));
}

/**
 * `avatar_selected_outfit_id`만으로 테마 추론 (레거시 레벨 맵 id만).
 * 매니페스트 id(`OUTFIT_IDS`)는 테마 구분 없음 → null.
 */
export function inferAvatarOutfitThemeFromOutfitId(outfitId: string): AvatarOutfitTheme | null {
  const id = outfitId.trim();
  if (!id) return null;
  if (MANIFEST_SET.has(id)) return null;
  if (PROFESSIONAL_OUTFIT_IDS.has(id) && !FANTASY_OUTFIT_IDS.has(id)) return "professional";
  if (FANTASY_OUTFIT_IDS.has(id) && !PROFESSIONAL_OUTFIT_IDS.has(id)) return "fantasy";
  return null;
}

/** 레벨 구간별로 pro+fantasy에서 열린 옷을 합친 목록 (레거시 레벨 맵 기준). */
export function getAllowedOutfitsForLevelUnified(levelId: LevelId): AllowedOutfitEntry[] {
  const pro = getAllowedOutfitsForLevel("professional", levelId);
  const fan = getAllowedOutfitsForLevel("fantasy", levelId);
  const byKey = new Map<string, AllowedOutfitEntry>();
  for (const o of pro) byKey.set(o.key, o);
  for (const o of fan) byKey.set(o.key, o);
  return Array.from(byKey.values());
}

/** 테마별 옷 목록 — 통합 매니페스트만 사용 (theme 무시). */
export function getOutfitsForTheme(_theme: AvatarOutfitTheme): OutfitOption[] {
  return OUTFIT_OPTIONS_ALL;
}

/**
 * 테마 + outfit id로 옷 정보 반환.
 * - 매니페스트 id(`OUTFIT_IDS`)는 테마 무시.
 * - 레거시 레벨 맵 id는 `theme`이 `fantasy`/`professional`일 때 해당 맵만; `theme`이 null/undefined면 pro→fantasy 순으로 시도.
 */
export function getOutfitById(
  theme: AvatarOutfitTheme | null | undefined,
  outfitId: string | null | undefined
): OutfitResult | null {
  if (!outfitId || typeof outfitId !== "string") return null;
  const id = outfitId.trim();
  if (!id) return null;

  if (MANIFEST_SET.has(id)) {
    const levelEntry = findLevelMapEntryByOutfitId(id);
    const accessoryIds = levelEntry?.accessoryIds ?? [];
    const accessoryLabels = accessoryIds.map((aid) => ACCESSORY_CATALOG[aid] ?? aid);
    return {
      outfitId: id,
      outfitLabel: levelEntry?.outfitLabel ?? outfitIdToDisplayLabel(id),
      accessoryIds,
      accessoryLabels,
      imageUrl: `${OUTFIT_IMAGE_BASE}/${encodeURIComponent(getOutfitFilename(id))}`,
    };
  }

  if (theme === "fantasy") return getLegacyOutfitByTheme("fantasy", id);
  if (theme === "professional") return getLegacyOutfitByTheme("professional", id);

  return getLegacyOutfitByTheme("professional", id) ?? getLegacyOutfitByTheme("fantasy", id);
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
  /** When set, use this outfit instead of level-based default. */
  avatarSelectedOutfitId?: string | null;
};

export type AvatarLayers = {
  /** Layer 1: character base (face+body). When customAvatarUrl is set, this is the only layer. */
  characterImageUrl: string | null;
  /** Layer 2: outfit overlay. Null = no outfit layer (show only character or custom). */
  outfitImageUrl: string | null;
};

/**
 * Resolve avatar as two layers for frontend composition (§3.3 B).
 * Returns character base URL and outfit URL so UI can stack them (character under, outfit on top).
 */
export function resolveDisplayAvatarLayers(
  options: ResolveDisplayAvatarOptions
): AvatarLayers {
  const {
    customAvatarUrl,
    avatarCharacterId,
    avatarOutfitTheme,
    levelId,
    avatarSelectedOutfitId,
  } = options;

  if (customAvatarUrl && customAvatarUrl.trim()) {
    return { characterImageUrl: customAvatarUrl.trim(), outfitImageUrl: null };
  }

  const outfit =
    avatarSelectedOutfitId != null
      ? getOutfitById(avatarOutfitTheme, avatarSelectedOutfitId)
      : null;
  const outfitByLevel = getOutfitForLevel(avatarOutfitTheme, levelId);
  const effectiveOutfit = outfit ?? outfitByLevel;

  let characterImageUrl: string | null = null;
  if (avatarCharacterId) {
    const character = getAvatarCharacter(avatarCharacterId);
    if (character?.imageUrl) characterImageUrl = character.imageUrl;
  }
  // When no character, fantasy theme may use character-outfit combo as single image (legacy)
  if (!characterImageUrl && avatarOutfitTheme === "fantasy") {
    const characterOutfitUrl = getCharacterOutfitImageUrl(avatarCharacterId);
    if (characterOutfitUrl) {
      return { characterImageUrl: characterOutfitUrl, outfitImageUrl: null };
    }
  }
  if (!characterImageUrl && effectiveOutfit.imageUrl) {
    characterImageUrl = effectiveOutfit.imageUrl;
    return { characterImageUrl, outfitImageUrl: null };
  }
  return {
    characterImageUrl,
    outfitImageUrl: characterImageUrl && effectiveOutfit.imageUrl ? effectiveOutfit.imageUrl : null,
  };
}

/**
 * Resolve avatar URL for display (leaderboard, dashboard).
 * When avatarSelectedOutfitId is provided, outfit is resolved from it; otherwise level-based.
 * For layer composition use resolveDisplayAvatarLayers instead.
 */
export function resolveDisplayAvatarUrl(options: ResolveDisplayAvatarOptions): string | null {
  const { customAvatarUrl, avatarCharacterId, avatarOutfitTheme, levelId, avatarSelectedOutfitId } = options;
  if (customAvatarUrl && customAvatarUrl.trim()) return customAvatarUrl.trim();

  const outfit =
    avatarSelectedOutfitId != null
      ? getOutfitById(avatarOutfitTheme, avatarSelectedOutfitId)
      : null;
  const outfitByLevel = getOutfitForLevel(avatarOutfitTheme, levelId);
  const effectiveOutfit = outfit ?? outfitByLevel;

  if (avatarCharacterId) {
    const character = getAvatarCharacter(avatarCharacterId);
    if (character?.imageUrl) return character.imageUrl;
  }
  if (avatarOutfitTheme === "fantasy") {
    const characterOutfitUrl = getCharacterOutfitImageUrl(avatarCharacterId);
    if (characterOutfitUrl) return characterOutfitUrl;
  }
  if (effectiveOutfit.imageUrl) return effectiveOutfit.imageUrl;
  return null;
}

/** AVATAR_LAYER_SPEC §4: 프로필 필드 → 아바타 복합 키 (리더보드/API 응답용). 순수 함수. */
export type ProfileAvatarFields = {
  avatarCharacterId: string | null;
  avatarOutfitTheme: "professional" | "fantasy" | null;
  avatarSelectedOutfitId: string | null;
  avatarAccessoryIds: string[];
  /**
   * DB에 `avatar_selected_outfit_id`가 없을 때 레벨 기본 옷 키를 쓰기 위한 표시용 레벨.
   * 리더보드 등에서 전달. 없으면 S1 기본(일반 스크럽 / fantasy 견습)으로 간주.
   */
  displayLevelId?: LevelId;
};

/** 통합 키: `outfit_{outfitId}`. */
export function toUnifiedOutfitKey(outfitId: string | null): string | null {
  if (!outfitId?.trim()) return null;
  return `outfit_${outfitId.trim()}`;
}

/**
 * `outfit_*` / 레거시 `professional_outfit_*` / `fantasy_outfit_*` 에서 테마·outfitId 추출.
 * 합성 URL용: 매니페스트 id는 `inferAvatarOutfitThemeFromOutfitId`가 null이면 theme을 `professional`로 둠.
 */
export function parseCompositeOutfitKey(outfitKey: string | null | undefined): {
  theme: "professional" | "fantasy";
  outfitId: string;
} | null {
  if (!outfitKey || typeof outfitKey !== "string") return null;
  const s = outfitKey.trim();
  if (s.startsWith("outfit_")) {
    const outfitId = s.slice("outfit_".length);
    const inferred = inferAvatarOutfitThemeFromOutfitId(outfitId);
    return { theme: inferred ?? "professional", outfitId };
  }
  if (s.startsWith("professional_outfit_")) {
    return { theme: "professional", outfitId: s.slice("professional_outfit_".length) };
  }
  if (s.startsWith("fantasy_outfit_")) {
    return { theme: "fantasy", outfitId: s.slice("fantasy_outfit_".length) };
  }
  return null;
}

/**
 * PATCH `outfitKey` → `avatar_selected_outfit_id` + DB `avatar_outfit_theme` (null = 매니페스트 id).
 */
export function parseApiOutfitKey(outfitKey: string | null | undefined): {
  outfitId: string;
  avatarOutfitTheme: "professional" | "fantasy" | null;
} | null {
  if (!outfitKey || typeof outfitKey !== "string") return null;
  const s = outfitKey.trim();
  if (s.startsWith("outfit_")) {
    const outfitId = s.slice("outfit_".length);
    return { outfitId, avatarOutfitTheme: inferAvatarOutfitThemeFromOutfitId(outfitId) };
  }
  if (s.startsWith("professional_outfit_")) {
    return { outfitId: s.slice("professional_outfit_".length), avatarOutfitTheme: "professional" };
  }
  if (s.startsWith("fantasy_outfit_")) {
    return { outfitId: s.slice("fantasy_outfit_".length), avatarOutfitTheme: "fantasy" };
  }
  return null;
}

export function profileToAvatarCompositeKeys(fields: ProfileAvatarFields): AvatarCompositeKeys {
  const theme: "professional" | "fantasy" =
    fields.avatarOutfitTheme === "fantasy" ? "fantasy" : "professional";
  const characterKey = (fields.avatarCharacterId ?? "").trim() || "hero_01";
  let outfitId = fields.avatarSelectedOutfitId?.trim() ?? null;
  if (!outfitId) {
    const levelId = fields.displayLevelId ?? "S1";
    outfitId = getOutfitForLevel(theme, levelId).outfitId;
  }
  const outfitKey = toUnifiedOutfitKey(outfitId);
  const accessoryKeys = Array.isArray(fields.avatarAccessoryIds)
    ? fields.avatarAccessoryIds.filter((x): x is string => typeof x === "string")
    : [];
  return { characterKey, theme, outfitKey, accessoryKeys };
}
