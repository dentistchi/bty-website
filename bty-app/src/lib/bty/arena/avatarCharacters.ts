/**
 * Track C: 게임 느낌 2D 캐릭터 정의.
 * id는 arena_profiles.avatar_character_id에 저장됨.
 *
 * 총 13종: **기본 12명 + 히든 1명(Legend)**. 기획상 히든은 **CODELESS ZONE(Stage 7)** 진행과 연동.
 * 구현: Legend 해금 = **진행 레벨 700**(내부 tier ≥ `LEGEND_UNLOCK_TIER`), Core XP 숫자와 다름 — `docs/spec/ARENA_PROGRESSION_AND_LEGEND_SPEC.md`.
 * 캐릭터 베이스 PNG(옷·악세 합성 전 단계): `public/avatars/default/characters/{basename}.png` — 11·12번은 `artisan_11` / `assistant_12`. 썸네일(512): `.../thumbs/{basename}.png`.
 * 옷(기획 20종 목표)·악세(기획 24종 목표): 매니페스트 `avatar-assets.json` — `public/avatars/outfits/` · `public/avatars/accessories/` (getAccessoryImageUrl).
 * §4.2 체형: bodyType A/B/C/D (옷 URL 해석은 추후, 에셋 없어도 됨).
 */

import { LEGEND_UNLOCK_TIER } from "@/domain/constants";
import { tierFromCoreXp } from "@/domain/rules/level-tier";

/** 체형 4종 (설계 §4.2). 옷 합성 시 참조, 에셋 없어도 타입만 정의. */
export type BodyType = "A" | "B" | "C" | "D";
export const BODY_TYPES: readonly BodyType[] = ["A", "B", "C", "D"];

export type AvatarCharacter = {
  id: string;
  label: string;
  imageUrl: string;
  /** When set, character is shown only when user's tier >= this value (progression level = tier+1). Legend = 699 → level 700. */
  unlockAtTier?: number;
  /** §4.2 체형. 옷 레이어 URL 해석 시 사용(추후). */
  bodyType?: BodyType;
};

/**
 * 전신 캐릭터 이미지 URL prefix (`/avatars/default/characters`).
 * 합성 파이프라인(옷 레이어·악세사리) 완성 후에는 동일 id로 `characters/` 등으로 옮기며 이 상수만 바꾸면 됨.
 */
export const AVATAR_CHARACTER_IMAGE_BASE = "/avatars/default/characters";

/**
 * Disk PNG basename may differ from logical `id` (stable API / DB id; file renamed on disk).
 * `character_11` / `character_12` → `artisan_11` / `assistant_12` (see `public/avatars/default/characters/`).
 */
const CHARACTER_IMAGE_FILE_BASENAME: Record<string, string> = {
  character_11: "artisan_11",
  character_12: "assistant_12",
};

function getCharacterImageBasename(id: string): string {
  return CHARACTER_IMAGE_FILE_BASENAME[id] ?? id;
}

/**
 * Full-resolution PNG: `public/avatars/default/characters/{basename}.png`.
 */
function getCharacterImageUrl(id: string): string {
  const file = `${getCharacterImageBasename(id)}.png`;
  return `${AVATAR_CHARACTER_IMAGE_BASE}/${encodeURIComponent(file)}`;
}

/**
 * 512px thumbnails: `public/avatars/default/characters/thumbs/{basename}.png` (same basename as full-res).
 */
export function getCharacterThumbImageUrl(id: string): string {
  const file = `${getCharacterImageBasename(id)}.png`;
  return `${AVATAR_CHARACTER_IMAGE_BASE}/thumbs/${encodeURIComponent(file)}`;
}

/** 캐릭터 12명 + Legend(숨김, 진행 레벨 700 = tier 699 해금). 라벨·이미지는 실제 에셋명 반영. */
export const AVATAR_CHARACTERS: AvatarCharacter[] = [
  { id: "hero_01", label: "Mentor", imageUrl: getCharacterImageUrl("hero_01"), bodyType: "A" },
  { id: "mage_02", label: "Architect", imageUrl: getCharacterImageUrl("mage_02"), bodyType: "B" },
  { id: "scout_03", label: "Scout", imageUrl: getCharacterImageUrl("scout_03"), bodyType: "C" },
  { id: "guardian_04", label: "Guardian", imageUrl: getCharacterImageUrl("guardian_04"), bodyType: "D" },
  { id: "pilot_05", label: "Technologist", imageUrl: getCharacterImageUrl("pilot_05"), bodyType: "A" },
  { id: "heroine_06", label: "Innovator", imageUrl: getCharacterImageUrl("heroine_06"), bodyType: "B" },
  { id: "healer_07", label: "Healer", imageUrl: getCharacterImageUrl("healer_07"), bodyType: "C" },
  { id: "ranger_08", label: "Hygienist", imageUrl: getCharacterImageUrl("ranger_08"), bodyType: "D" },
  { id: "sorceress_09", label: "Artisan", imageUrl: getCharacterImageUrl("sorceress_09"), bodyType: "A" },
  { id: "captain_10", label: "Alchemist", imageUrl: getCharacterImageUrl("captain_10"), bodyType: "B" },
  { id: "character_11", label: "Radiologist", imageUrl: getCharacterImageUrl("character_11"), bodyType: "C" },
  { id: "character_12", label: "Assistant", imageUrl: getCharacterImageUrl("character_12"), bodyType: "D" },
  {
    id: "legend_13",
    label: "Legend",
    imageUrl: getCharacterImageUrl("legend_13"),
    unlockAtTier: LEGEND_UNLOCK_TIER,
    bodyType: "A",
  },
];

const ID_SET = new Set(AVATAR_CHARACTERS.map((c) => c.id));

/** 진행 레벨 700 = tier 699 달성 시 Legend 캐릭터 해금 (Core XP 700이 아님). */
export { LEGEND_UNLOCK_TIER };

export function getAvatarCharacterIds(): string[] {
  return AVATAR_CHARACTERS.map((c) => c.id);
}

/**
 * Core XP 기준으로 선택 가능한 캐릭터만 반환. Legend는 tier >= LEGEND_UNLOCK_TIER(진행 레벨 700)일 때만 노출.
 * 대시보드·캐릭터 선택 UI에서 사용.
 */
export function getVisibleAvatarCharacters(coreXpTotal: number): AvatarCharacter[] {
  const tier = tierFromCoreXp(coreXpTotal);
  return AVATAR_CHARACTERS.filter(
    (c) => c.unlockAtTier == null || tier >= c.unlockAtTier
  );
}

export function isValidAvatarCharacterId(id: string | null | undefined): boolean {
  if (id === null || id === undefined) return true;
  return typeof id === "string" && ID_SET.has(id.trim());
}

export function getAvatarCharacter(id: string | null | undefined): AvatarCharacter | null {
  if (!id || typeof id !== "string") return null;
  return AVATAR_CHARACTERS.find((c) => c.id === id.trim()) ?? null;
}
