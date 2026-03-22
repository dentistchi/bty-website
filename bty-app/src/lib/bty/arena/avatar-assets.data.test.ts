/**
 * avatar-assets.data — JSON 로드 결과 검증 (목록 길이·필수 키).
 * 단일 소스: public/avatars/avatar-assets.json. 갱신: `npm run generate:avatar-manifest` (옷 20·악세 24 스캔 시).
 */
import { describe, it, expect } from "vitest";
import {
  ACCESSORIES_DENTAL,
  ACCESSORIES_GAME,
  ACCESSORY_IDS_ALL,
  OUTFITS_PROFESSIONAL,
  OUTFITS_FANTASY,
} from "./avatar-assets.data";
import {
  AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES,
  AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES,
} from "./avatar-manifest-constants";

describe("avatar-assets.data", () => {
  it("has required keys: accessories.dental, accessories.game, outfits.professional, outfits.fantasy", () => {
    expect(ACCESSORIES_DENTAL).toBeDefined();
    expect(ACCESSORIES_GAME).toBeDefined();
    expect(OUTFITS_PROFESSIONAL).toBeDefined();
    expect(OUTFITS_FANTASY).toBeDefined();
    expect(Array.isArray(ACCESSORIES_DENTAL)).toBe(true);
    expect(Array.isArray(ACCESSORIES_GAME)).toBe(true);
    expect(Array.isArray(OUTFITS_PROFESSIONAL)).toBe(true);
    expect(Array.isArray(OUTFITS_FANTASY)).toBe(true);
  });

  it("accessories total matches manifest target (dental-only .svg 가능)", () => {
    expect(ACCESSORIES_DENTAL.length + ACCESSORIES_GAME.length).toBe(AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES);
  });

  it("ACCESSORY_IDS_ALL is dental + game concatenation", () => {
    expect(ACCESSORY_IDS_ALL.length).toBe(ACCESSORIES_DENTAL.length + ACCESSORIES_GAME.length);
  });

  it("outfits total matches manifest target (10+10 등)", () => {
    expect(OUTFITS_PROFESSIONAL.length + OUTFITS_FANTASY.length).toBe(AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES);
  });

  it("all ids are non-empty strings", () => {
    for (const id of ACCESSORY_IDS_ALL) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
    for (const id of OUTFITS_PROFESSIONAL) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
    for (const id of OUTFITS_FANTASY) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
