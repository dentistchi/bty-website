/**
 * Track C: 게임 느낌 2D 캐릭터 정의.
 * id는 arena_profiles.avatar_character_id에 저장됨.
 *
 * 총 13종: 일반 선택 12명 + 13번째 Legend. Legend 해금 = 진행 레벨 700(내부 tier 699 이상), Core XP 숫자와 다름.
 * 캐릭터 PNG: public/avatars/characters/ + CHARACTER_ID_TO_FILENAME 매핑.
 * 악세사리: public/avatars/accessories/ (getAccessoryImageUrl, avatar-assets.json).
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

const AVATAR_CHARACTERS_DIR = "/avatars/characters";

/** characterId → 실제 파일명 (public/avatars/characters/). URL 인코딩 후 사용. */
const CHARACTER_ID_TO_FILENAME: Record<string, string> = {
  guardian_04: "1️⃣ Guardian (Korean Male).png",
  hero_01: "1️⃣1️⃣ Mentor (Korean Male).png",
  character_11: "1️⃣2️⃣ Radiologist (Mexican Female).png",
  mage_02: "2️⃣ Architect (White Male).png",
  healer_07: "3️⃣ Healer (Korean Female).png",
  heroine_06: "4️⃣ Innovator (Korean Female).png",
  pilot_05: "5️⃣ Technologist (Filipino Male).png",
  scout_03: "6️⃣ Scout (Filipino Female).png",
  character_12: "7️⃣ Assistant (Filipino Female).png",
  sorceress_09: "8️⃣ Artisan (Mexican Female).png",
  ranger_08: "9️⃣ Hygienist (White Female).png",
  captain_10: "🔟 Alchemist (Black Female).png",
  legend_13: "13 legend.png",
};

function getCharacterImageUrl(id: string): string {
  const file = CHARACTER_ID_TO_FILENAME[id];
  return file
    ? `${AVATAR_CHARACTERS_DIR}/${encodeURIComponent(file)}`
    : `${AVATAR_CHARACTERS_DIR}/${id}.png`;
}

/** 캐릭터 12명 + Legend(숨김, 진행 레벨 700 = tier 699 해금). 라벨·이미지는 실제 에셋명 반영. */
export const AVATAR_CHARACTERS: AvatarCharacter[] = [
  { id: "hero_01", label: "Mentor", imageUrl: getCharacterImageUrl("hero_01") },
  { id: "mage_02", label: "Architect", imageUrl: getCharacterImageUrl("mage_02") },
  { id: "scout_03", label: "Scout", imageUrl: getCharacterImageUrl("scout_03") },
  { id: "guardian_04", label: "Guardian", imageUrl: getCharacterImageUrl("guardian_04") },
  { id: "pilot_05", label: "Technologist", imageUrl: getCharacterImageUrl("pilot_05") },
  { id: "heroine_06", label: "Innovator", imageUrl: getCharacterImageUrl("heroine_06") },
  { id: "healer_07", label: "Healer", imageUrl: getCharacterImageUrl("healer_07") },
  { id: "ranger_08", label: "Hygienist", imageUrl: getCharacterImageUrl("ranger_08") },
  { id: "sorceress_09", label: "Artisan", imageUrl: getCharacterImageUrl("sorceress_09") },
  { id: "captain_10", label: "Alchemist", imageUrl: getCharacterImageUrl("captain_10") },
  { id: "character_11", label: "Radiologist", imageUrl: getCharacterImageUrl("character_11") },
  { id: "character_12", label: "Assistant", imageUrl: getCharacterImageUrl("character_12") },
  { id: "legend_13", label: "Legend", imageUrl: getCharacterImageUrl("legend_13"), unlockAtTier: LEGEND_UNLOCK_TIER },
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
