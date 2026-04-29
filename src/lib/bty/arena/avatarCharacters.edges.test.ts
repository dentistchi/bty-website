/**
 * Edge-case tests for avatarCharacters (12 visible + 1 Legend at progression level 700 = tier 699).
 */
import { describe, it, expect } from "vitest";
import {
  AVATAR_CHARACTERS,
  AVATAR_CHARACTER_IMAGE_BASE,
  getAvatarCharacterIds,
  getVisibleAvatarCharacters,
  isValidAvatarCharacterId,
  getAvatarCharacter,
  LEGEND_UNLOCK_TIER,
} from "./avatarCharacters";

describe("avatarCharacters (edges)", () => {
  describe("AVATAR_CHARACTERS shape", () => {
    it("has exactly 13 characters (12 visible + 1 Legend)", () => {
      expect(AVATAR_CHARACTERS).toHaveLength(13);
    });
    it("every entry has id, label, imageUrl", () => {
      for (const c of AVATAR_CHARACTERS) {
        expect(typeof c.id).toBe("string");
        expect(c.id.length).toBeGreaterThan(0);
        expect(typeof c.label).toBe("string");
        expect(c.imageUrl).toMatch(
          new RegExp(`^${AVATAR_CHARACTER_IMAGE_BASE.replace(/\//g, "\\/")}\\/.+\\.png$`),
        );
      }
    });
    it("all ids are unique", () => {
      const ids = AVATAR_CHARACTERS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
    it("last character is Legend with unlockAtTier 699 (level 700)", () => {
      const last = AVATAR_CHARACTERS[AVATAR_CHARACTERS.length - 1];
      expect(last.id).toBe("legend_13");
      expect(last.unlockAtTier).toBe(LEGEND_UNLOCK_TIER);
    });
  });

  describe("getVisibleAvatarCharacters", () => {
    it("returns 12 characters when tier < 699 (level < 700)", () => {
      expect(getVisibleAvatarCharacters(0)).toHaveLength(12);
      expect(getVisibleAvatarCharacters(6989)).toHaveLength(12); // tier 698
    });
    it("returns 13 characters when tier >= 699 (level 700)", () => {
      expect(getVisibleAvatarCharacters(6990)).toHaveLength(13); // tier 699
      expect(getVisibleAvatarCharacters(10000)).toHaveLength(13);
    });
    it("includes Legend only when tier >= 699 (progression level 700)", () => {
      const below = getVisibleAvatarCharacters(6989).map((c) => c.id);
      const above = getVisibleAvatarCharacters(6990).map((c) => c.id);
      expect(below).not.toContain("legend_13");
      expect(above).toContain("legend_13");
    });
  });

  describe("getAvatarCharacterIds", () => {
    it("returns same length as AVATAR_CHARACTERS", () => {
      expect(getAvatarCharacterIds()).toHaveLength(AVATAR_CHARACTERS.length);
    });
  });

  describe("isValidAvatarCharacterId edge cases", () => {
    it("null and undefined are valid (optional avatar)", () => {
      expect(isValidAvatarCharacterId(null)).toBe(true);
      expect(isValidAvatarCharacterId(undefined)).toBe(true);
    });
    it("whitespace-only string is invalid", () => {
      expect(isValidAvatarCharacterId("   ")).toBe(false);
    });
    it("last character id is valid", () => {
      const lastId = AVATAR_CHARACTERS[AVATAR_CHARACTERS.length - 1].id;
      expect(isValidAvatarCharacterId(lastId)).toBe(true);
    });
  });

  describe("getAvatarCharacter edge cases", () => {
    it("returns correct imageUrl for last character", () => {
      const last = AVATAR_CHARACTERS[AVATAR_CHARACTERS.length - 1];
      const result = getAvatarCharacter(last.id);
      expect(result).not.toBeNull();
      expect(result!.imageUrl).toBe(last.imageUrl);
    });
  });
});
