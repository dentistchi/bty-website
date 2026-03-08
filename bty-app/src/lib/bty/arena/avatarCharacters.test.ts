/**
 * avatarCharacters — getAvatarCharacterIds, isValidAvatarCharacterId, getAvatarCharacter 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  getAvatarCharacterIds,
  isValidAvatarCharacterId,
  getAvatarCharacter,
  AVATAR_CHARACTERS,
} from "./avatarCharacters";

describe("avatarCharacters", () => {
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
    it("returns character for valid id", () => {
      const c = getAvatarCharacter("hero_01");
      expect(c).not.toBeNull();
      expect(c!.id).toBe("hero_01");
      expect(c!.label).toBe("Hero");
      expect(c!.imageUrl).toBe("/avatars/Hero.png");
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
