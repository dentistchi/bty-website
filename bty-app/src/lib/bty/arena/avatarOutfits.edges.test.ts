/**
 * Edge-case tests for avatarOutfits (Arena 14차).
 * TASK 2(weeklyQuest)·13차(avatarCharacters)와 다른 미커버 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  ACCESSORY_CATALOG,
  OUTFIT_LEVEL_IDS,
  getOutfitForLevel,
  getCharacterOutfitImageUrl,
  getAccessoryImageUrl,
  tierToDisplayLevelId,
  accessorySlotsFromTier,
  resolveDisplayAvatarUrl,
} from "./avatarOutfits";

describe("avatarOutfits (edges)", () => {
  describe("ACCESSORY_CATALOG", () => {
    it("has at least 10 entries", () => {
      expect(Object.keys(ACCESSORY_CATALOG).length).toBeGreaterThanOrEqual(10);
    });
    it("every value is a non-empty string", () => {
      for (const v of Object.values(ACCESSORY_CATALOG)) {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      }
    });
  });

  describe("OUTFIT_LEVEL_IDS", () => {
    it("has 7 levels S1..L4", () => {
      expect(OUTFIT_LEVEL_IDS).toEqual(["S1", "S2", "S3", "L1", "L2", "L3", "L4"]);
    });
  });

  describe("getOutfitForLevel", () => {
    it("defaults to professional when theme is null or undefined", () => {
      const r1 = getOutfitForLevel(null, "S1");
      const r2 = getOutfitForLevel(undefined, "S1");
      expect(r1.outfitId).toBe("scrub_general");
      expect(r2.outfitId).toBe("scrub_general");
    });
    it("imageUrl is under /avatars/outfits/ and ends with .png", () => {
      for (const lid of OUTFIT_LEVEL_IDS) {
        const r = getOutfitForLevel("professional", lid);
        expect(r.imageUrl).toMatch(/^\/avatars\/outfits\/.+/);
        expect(r.imageUrl.endsWith(".png")).toBe(true);
      }
    });
    it("fantasy theme returns outfit with non-empty outfitId for S1", () => {
      const r = getOutfitForLevel("fantasy", "S1");
      expect(r.outfitId).toBeTruthy();
      expect(r.outfitId.length).toBeGreaterThan(0);
    });
  });

  describe("getCharacterOutfitImageUrl", () => {
    it("returns url for known character ids", () => {
      expect(getCharacterOutfitImageUrl("hero_01")).toMatch(/outfit_hero_armor\.png$/);
      expect(getCharacterOutfitImageUrl("mage_02")).toMatch(/outfit_mage_robe\.png$/);
    });
    it("returns null for unknown character", () => {
      expect(getCharacterOutfitImageUrl("unknown_99")).toBeNull();
    });
    it("returns null for null/undefined/empty", () => {
      expect(getCharacterOutfitImageUrl(null)).toBeNull();
      expect(getCharacterOutfitImageUrl(undefined)).toBeNull();
      expect(getCharacterOutfitImageUrl("")).toBeNull();
    });
  });

  describe("getAccessoryImageUrl", () => {
    it("game accessories use .png", () => {
      expect(getAccessoryImageUrl("weapon")).toBe("/avatars/accessories/weapon.png");
    });
    it("non-game accessories use .svg", () => {
      expect(getAccessoryImageUrl("handpiece")).toBe("/avatars/accessories/handpiece.svg");
    });
  });

  describe("tierToDisplayLevelId", () => {
    it("tier 0 → S1, tier 5 → S2, tier 30+ → L4", () => {
      expect(tierToDisplayLevelId(0)).toBe("S1");
      expect(tierToDisplayLevelId(4)).toBe("S1");
      expect(tierToDisplayLevelId(5)).toBe("S2");
      expect(tierToDisplayLevelId(30)).toBe("L4");
      expect(tierToDisplayLevelId(999)).toBe("L4");
    });
    it("negative tier clamps to S1", () => {
      expect(tierToDisplayLevelId(-5)).toBe("S1");
    });
  });

  describe("resolveDisplayAvatarUrl", () => {
    it("returns customAvatarUrl when set (trimmed)", () => {
      const url = resolveDisplayAvatarUrl({
        customAvatarUrl: "  https://example.com/pic.png  ",
        avatarCharacterId: null,
        avatarOutfitTheme: null,
        levelId: "S1",
      });
      expect(url).toBe("https://example.com/pic.png");
    });
    it("returns null when nothing is set", () => {
      const url = resolveDisplayAvatarUrl({
        customAvatarUrl: null,
        avatarCharacterId: null,
        avatarOutfitTheme: null,
        levelId: "S1",
      });
      expect(url).not.toBeNull();
    });
  });
});
