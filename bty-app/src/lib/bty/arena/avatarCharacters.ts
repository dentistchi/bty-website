/**
 * Track C: 게임 느낌 2D 캐릭터 N종 정의.
 * id는 arena_profiles.avatar_character_id에 저장됨.
 */

export type AvatarCharacter = {
  id: string;
  label: string;
  imageUrl: string;
};

/** 캐릭터 목록. public/avatars/ 에 있는 실제 파일명과 일치. */
export const AVATAR_CHARACTERS: AvatarCharacter[] = [
  { id: "hero_01", label: "Hero", imageUrl: "/avatars/Hero.png" },
  { id: "mage_02", label: "Mage", imageUrl: "/avatars/Maga.png" },
  { id: "scout_03", label: "Scout", imageUrl: "/avatars/Scout.png" },
  { id: "guardian_04", label: "Guardian", imageUrl: "/avatars/Guardian.png" },
  { id: "pilot_05", label: "Pilot", imageUrl: "/avatars/pilot.png" },
  { id: "heroine_06", label: "Heroine", imageUrl: "/avatars/Heroine.png" },
  { id: "healer_07", label: "Healer", imageUrl: "/avatars/Healer.png" },
  { id: "ranger_08", label: "Ranger", imageUrl: "/avatars/Ranger.png" },
  { id: "sorceress_09", label: "Sorceress", imageUrl: "/avatars/Sorceress.png" },
  { id: "captain_10", label: "Captain", imageUrl: "/avatars/Captain.png" },
];

const ID_SET = new Set(AVATAR_CHARACTERS.map((c) => c.id));

export function getAvatarCharacterIds(): string[] {
  return AVATAR_CHARACTERS.map((c) => c.id);
}

export function isValidAvatarCharacterId(id: string | null | undefined): boolean {
  if (id === null || id === undefined) return true;
  return typeof id === "string" && ID_SET.has(id.trim());
}

export function getAvatarCharacter(id: string | null | undefined): AvatarCharacter | null {
  if (!id || typeof id !== "string") return null;
  return AVATAR_CHARACTERS.find((c) => c.id === id.trim()) ?? null;
}
