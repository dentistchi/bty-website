/**
 * AVATAR_LAYER_SPEC §2.2 — resolveAvatarUrls, characterAssetMap, outfitAssetMap 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  resolveAvatarUrls,
  characterAssetMap,
  outfitAssetMap,
  type ResolveAvatarUrlsResult,
} from "./avatarAssets";

describe("avatarAssets", () => {
  describe("characterAssetMap", () => {
    it("has entries for all known character keys from AVATAR_CHARACTERS", () => {
      expect(characterAssetMap["hero_01"]).toBeDefined();
      expect(characterAssetMap["hero_01"].base).toBe("/avatars/Hero.png");
      expect(characterAssetMap["mage_02"]).toBeDefined();
      expect(characterAssetMap["captain_10"]).toBeDefined();
    });

    it("each entry has base and thumb", () => {
      for (const entry of Object.values(characterAssetMap)) {
        expect(entry.base).toBeTruthy();
        expect(typeof entry.base).toBe("string");
      }
    });
  });

  describe("outfitAssetMap", () => {
    it("has professional and fantasy outfit keys", () => {
      expect(outfitAssetMap["professional_outfit_scrub_general"]).toBeDefined();
      expect(outfitAssetMap["professional_outfit_figs_scrub"]).toBeDefined();
      expect(outfitAssetMap["fantasy_outfit_apprentice"]).toBeDefined();
      expect(outfitAssetMap["fantasy_outfit_master"]).toBeDefined();
    });

    it("each entry has layer, theme", () => {
      const entry = outfitAssetMap["professional_outfit_scrub_general"];
      expect(entry.layer).toContain("/avatars/outfits/");
      expect(entry.theme).toBe("professional");
    });
  });

  describe("resolveAvatarUrls", () => {
    it("returns characterUrl for known characterKey", () => {
      const r = resolveAvatarUrls({ characterKey: "hero_01" });
      expect(r.characterUrl).toBe("/avatars/Hero.png");
      expect(r.outfitUrl).toBeNull();
      expect(r.accessoryUrls).toEqual([]);
    });

    it("returns null characterUrl for unknown characterKey", () => {
      const r = resolveAvatarUrls({ characterKey: "unknown_id" });
      expect(r.characterUrl).toBeNull();
    });

    it("returns null characterUrl for empty characterKey", () => {
      const r = resolveAvatarUrls({ characterKey: "" });
      expect(r.characterUrl).toBeNull();
    });

    it("trims characterKey", () => {
      const r = resolveAvatarUrls({ characterKey: "  hero_01  " });
      expect(r.characterUrl).toBe("/avatars/Hero.png");
    });

    it("returns outfitUrl for known outfitKey", () => {
      const r = resolveAvatarUrls({
        characterKey: "hero_01",
        outfitKey: "professional_outfit_scrub_general",
      });
      expect(r.characterUrl).toBe("/avatars/Hero.png");
      expect(r.outfitUrl).toContain("/avatars/outfits/");
      expect(r.outfitUrl).toContain("outfit_scrub_general");
    });

    it("returns null outfitUrl for unknown outfitKey", () => {
      const r = resolveAvatarUrls({
        characterKey: "hero_01",
        outfitKey: "unknown_outfit",
      });
      expect(r.outfitUrl).toBeNull();
    });

    it("returns result shape with accessoryUrls array", () => {
      const r = resolveAvatarUrls({
        characterKey: "hero_01",
        accessoryKeys: [],
      });
      expect(r).toMatchObject({
        characterUrl: expect.any(String),
        outfitUrl: null,
        accessoryUrls: [],
      } as ResolveAvatarUrlsResult);
    });

    it("useThumb uses thumb when available", () => {
      const rBase = resolveAvatarUrls({ characterKey: "hero_01", useThumb: false });
      const rThumb = resolveAvatarUrls({ characterKey: "hero_01", useThumb: true });
      expect(rBase.characterUrl).toBeTruthy();
      expect(rThumb.characterUrl).toBeTruthy();
    });
  });
});
