/**
 * Track C: 게임 느낌 2D 캐릭터 N종 정의.
 * id는 arena_profiles.avatar_character_id에 저장됨.
 *
 * 12 visible + 1 hidden (Legend). Legend 해금 = 진행 레벨 700 (tier 699), Core XP 700이 아님.
 * URL 규칙: /avatars/characters/{id}.png (public/avatars/characters/).
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

/** 캐릭터 12명 + Legend(숨김, 진행 레벨 700 = tier 699 해금). */
export const AVATAR_CHARACTERS: AvatarCharacter[] = [
  { id: "hero_01", label: "Hero", imageUrl: "/avatars/characters/hero_01.png" },
  { id: "mage_02", label: "Mage", imageUrl: "/avatars/characters/mage_02.png" },
  { id: "scout_03", label: "Scout", imageUrl: "/avatars/characters/scout_03.png" },
  { id: "guardian_04", label: "Guardian", imageUrl: "/avatars/characters/guardian_04.png" },
  { id: "pilot_05", label: "Pilot", imageUrl: "/avatars/characters/pilot_05.png" },
  { id: "heroine_06", label: "Heroine", imageUrl: "/avatars/characters/heroine_06.png" },
  { id: "healer_07", label: "Healer", imageUrl: "/avatars/characters/healer_07.png" },
  { id: "ranger_08", label: "Ranger", imageUrl: "/avatars/characters/ranger_08.png" },
  { id: "sorceress_09", label: "Sorceress", imageUrl: "/avatars/characters/sorceress_09.png" },
  { id: "captain_10", label: "Captain", imageUrl: "/avatars/characters/captain_10.png" },
  { id: "character_11", label: "Character 11", imageUrl: "/avatars/characters/character_11.png" },
  { id: "character_12", label: "Character 12", imageUrl: "/avatars/characters/character_12.png" },
  { id: "legend_13", label: "Legend", imageUrl: "/avatars/characters/legend.png", unlockAtTier: LEGEND_UNLOCK_TIER },
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
