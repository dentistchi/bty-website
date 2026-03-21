/**
 * AVATAR_LAYER_SPEC §2.2 — resolveAvatarUrls, characterAssetMap, outfitAssetMap, accessoryAssetMap 단위 테스트.
 * 캐릭터·옷 URL은 실제 에셋 파일명 매핑 사용.
 */
import { describe, it, expect } from "vitest";
import {
  resolveAvatarUrls,
  characterAssetMap,
  outfitAssetMap,
  accessoryAssetMap,
  type ResolveAvatarUrlsResult,
} from "./avatarAssets";
import { OUTFITS_PROFESSIONAL, OUTFITS_FANTASY, ACCESSORY_IDS_ALL } from "./avatar-assets.data";

const OUTFIT_URL_PATTERN = /^\/avatars\/outfits\/.+/;
const ACCESSORY_URL_PATTERN = /^\/avatars\/accessories\/[^/]+\.(svg|png)$/;

describe("avatarAssets", () => {
  describe("characterAssetMap", () => {
    it("has entries for all known character keys from AVATAR_CHARACTERS", () => {
      expect(characterAssetMap["hero_01"]).toBeDefined();
      expect(characterAssetMap["hero_01"].base.startsWith("/avatars/")).toBe(true);
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

    it("each entry has layer under /avatars/outfits/ and theme", () => {
      for (const key of Object.keys(outfitAssetMap)) {
        const entry = outfitAssetMap[key];
        expect(entry.layer).toMatch(OUTFIT_URL_PATTERN);
        expect(entry.theme).toBeDefined();
        expect(["professional", "fantasy"]).toContain(entry.theme);
      }
    });

    it("keys are theme_outfit_{id} for OUTFITS_PROFESSIONAL and OUTFITS_FANTASY", () => {
      for (const id of OUTFITS_PROFESSIONAL) {
        expect(outfitAssetMap[`professional_outfit_${id}`]).toBeDefined();
        expect(outfitAssetMap[`professional_outfit_${id}`].layer.startsWith("/avatars/outfits/")).toBe(true);
      }
      for (const id of OUTFITS_FANTASY) {
        expect(outfitAssetMap[`fantasy_outfit_${id}`]).toBeDefined();
        expect(outfitAssetMap[`fantasy_outfit_${id}`].layer.startsWith("/avatars/outfits/")).toBe(true);
      }
    });
  });

  describe("accessoryAssetMap", () => {
    it("has entry for every ACCESSORY_IDS_ALL id", () => {
      for (const id of ACCESSORY_IDS_ALL) {
        expect(accessoryAssetMap[id]).toBeDefined();
        expect(accessoryAssetMap[id].layer).toBeTruthy();
      }
    });

    it("each entry layer matches /avatars/accessories/*.svg or .png", () => {
      for (const entry of Object.values(accessoryAssetMap)) {
        expect(entry.layer).toMatch(ACCESSORY_URL_PATTERN);
        expect(entry.layer.startsWith("/avatars/accessories/")).toBe(true);
        expect(entry.layer.endsWith(".svg") || entry.layer.endsWith(".png")).toBe(true);
      }
    });
  });

  describe("resolveAvatarUrls", () => {
    it("returns characterUrl for known characterKey", () => {
      const r = resolveAvatarUrls({ characterKey: "hero_01" });
      expect(r.characterUrl).toBeTruthy();
      expect(r.characterUrl!.startsWith("/avatars/")).toBe(true);
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
      expect(r.characterUrl).toBeTruthy();
      expect(r.characterUrl!.startsWith("/avatars/")).toBe(true);
    });

    it("returns outfitUrl for known outfitKey under /avatars/outfits/", () => {
      const r = resolveAvatarUrls({
        characterKey: "hero_01",
        outfitKey: "professional_outfit_scrub_general",
      });
      expect(r.characterUrl).toBeTruthy();
      expect(r.characterUrl!.startsWith("/avatars/")).toBe(true);
      expect(r.outfitUrl).toMatch(OUTFIT_URL_PATTERN);
      expect(r.outfitUrl!.startsWith("/avatars/outfits/")).toBe(true);
    });

    it("uses bodyType-specific outfit filename when bodyType is set", () => {
      const base = resolveAvatarUrls({
        characterKey: "hero_01",
        outfitKey: "professional_outfit_scrub_general",
      });
      const withBody = resolveAvatarUrls({
        characterKey: "hero_01",
        outfitKey: "professional_outfit_scrub_general",
        bodyType: "A",
      });
      expect(withBody.outfitUrl).toContain("/avatars/outfits/");
      expect(withBody.outfitUrl).not.toBe(base.outfitUrl);
      expect(withBody.outfitUrl).toMatch(/_A\.png|%5FA\.png/);
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

    it("returns accessoryUrls for known accessoryKeys matching /avatars/accessories/*.svg|.png", () => {
      const r = resolveAvatarUrls({
        characterKey: "hero_01",
        accessoryKeys: ["handpiece", "weapon"],
      });
      expect(r.characterUrl).toBeTruthy();
      expect(r.characterUrl!.startsWith("/avatars/")).toBe(true);
      expect(r.accessoryUrls).toHaveLength(2);
      for (const url of r.accessoryUrls) {
        expect(url).toMatch(ACCESSORY_URL_PATTERN);
        expect(url.startsWith("/avatars/accessories/")).toBe(true);
      }
      expect(r.accessoryUrls).toContain("/avatars/accessories/handpiece.svg");
      expect(r.accessoryUrls).toContain("/avatars/accessories/weapon.png");
    });
  });
});
