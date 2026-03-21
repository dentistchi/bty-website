/**
 * avatarCharacters — getAvatarCharacterIds, isValidAvatarCharacterId, getAvatarCharacter 단위 테스트.
 * imageUrl: `{id}.png` under `/avatars/characters/`.
 */
import { describe, it, expect } from "vitest";
import {
  getAvatarCharacterIds,
  isValidAvatarCharacterId,
  getAvatarCharacter,
  getVisibleAvatarCharacters,
  AVATAR_CHARACTERS,
} from "./avatarCharacters";

describe("avatarCharacters", () => {
  describe("AVATAR_CHARACTERS imageUrl", () => {
    it("every character imageUrl is under /avatars/characters/ and ends with .png", () => {
      for (const c of AVATAR_CHARACTERS) {
        expect(c.imageUrl.startsWith("/avatars/characters/")).toBe(true);
        expect(c.imageUrl.endsWith(".png")).toBe(true);
      }
    });
  });

  describe("getAvatarCharacterIds", () => {
    it("returns array of all character ids", () => {
      const ids = getAvatarCharacterIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBe(AVATAR_CHARACTERS.length);
      expect(ids).toContain("hero_01");
      expect(ids).toContain("captain_10");
    });

    it("matches AVATAR_CHARACTERS id order", () => {
      const ids = getAvatarCharacterIds();
      AVATAR_CHARACTERS.forEach((c, i) => {
        expect(ids[i]).toBe(c.id);
      });
    });
  });

  describe("isValidAvatarCharacterId", () => {
    it("returns true for null or undefined", () => {
      expect(isValidAvatarCharacterId(null)).toBe(true);
      expect(isValidAvatarCharacterId(undefined)).toBe(true);
    });

    it("returns true for valid id", () => {
      expect(isValidAvatarCharacterId("hero_01")).toBe(true);
      expect(isValidAvatarCharacterId("mage_02")).toBe(true);
      expect(isValidAvatarCharacterId("  hero_01  ")).toBe(true);
    });

    it("returns false for unknown id", () => {
      expect(isValidAvatarCharacterId("unknown")).toBe(false);
      expect(isValidAvatarCharacterId("")).toBe(false);
    });
  });

  describe("getAvatarCharacter", () => {
    it("returns character for valid id with imageUrl under /avatars/characters/ and label from asset", () => {
      const c = getAvatarCharacter("hero_01");
      expect(c).not.toBeNull();
      expect(c!.id).toBe("hero_01");
      expect(c!.label).toBe("Mentor");
      expect(c!.imageUrl.startsWith("/avatars/characters/")).toBe(true);
      expect(c!.imageUrl.endsWith(".png")).toBe(true);
    });

    it("trims id", () => {
      const c = getAvatarCharacter("  hero_01  ");
      expect(c).not.toBeNull();
      expect(c!.id).toBe("hero_01");
    });

    it("returns null for null or undefined", () => {
      expect(getAvatarCharacter(null)).toBeNull();
      expect(getAvatarCharacter(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(getAvatarCharacter("")).toBeNull();
    });

    it("returns null for unknown id", () => {
      expect(getAvatarCharacter("unknown")).toBeNull();
    });
  });
});
