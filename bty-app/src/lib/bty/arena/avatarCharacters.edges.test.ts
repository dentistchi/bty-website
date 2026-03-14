/**
 * Edge-case tests for avatarCharacters (Arena 13차).
 * TASK 2(weeklyQuest)·11차(program)·12차(unlock)와 다른 미커버 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  AVATAR_CHARACTERS,
  getAvatarCharacterIds,
  isValidAvatarCharacterId,
  getAvatarCharacter,
} from "./avatarCharacters";

describe("avatarCharacters (edges)", () => {
  describe("AVATAR_CHARACTERS shape", () => {
    it("has exactly 10 characters", () => {
      expect(AVATAR_CHARACTERS).toHaveLength(10);
    });
    it("every entry has id, label, imageUrl", () => {
      for (const c of AVATAR_CHARACTERS) {
        expect(typeof c.id).toBe("string");
        expect(c.id.length).toBeGreaterThan(0);
        expect(typeof c.label).toBe("string");
        expect(c.imageUrl).toMatch(/^\/avatars\/.+\.png$/);
      }
    });
    it("all ids are unique", () => {
      const ids = AVATAR_CHARACTERS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
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
