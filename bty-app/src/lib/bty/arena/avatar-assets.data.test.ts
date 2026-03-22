/**
 * avatar-assets.data — JSON 로드 결과 검증 (목록 길이·필수 키).
 * 단일 소스: public/avatars/avatar-assets.json. 갱신: `npm run generate:avatar-manifest` (옷 20·악세 스캔 시).
 */
import { describe, it, expect } from "vitest";
import {
  ACCESSORIES_DENTAL,
  ACCESSORIES_GAME,
  ACCESSORY_IDS_ALL,
  OUTFIT_IDS,
} from "./avatar-assets.data";
import {
  AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES,
  AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES,
} from "./avatar-manifest-constants";

describe("avatar-assets.data", () => {
  it("has required keys: accessories.dental, accessories.game, outfits[]", () => {
    expect(ACCESSORIES_DENTAL).toBeDefined();
    expect(ACCESSORIES_GAME).toBeDefined();
    expect(OUTFIT_IDS).toBeDefined();
    expect(Array.isArray(ACCESSORIES_DENTAL)).toBe(true);
    expect(Array.isArray(ACCESSORIES_GAME)).toBe(true);
    expect(Array.isArray(OUTFIT_IDS)).toBe(true);
  });

  it("accessories total matches manifest target (dental-only .svg 가능)", () => {
    expect(ACCESSORIES_DENTAL.length + ACCESSORIES_GAME.length).toBe(AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES);
  });

  it("ACCESSORY_IDS_ALL is dental + game concatenation", () => {
    expect(ACCESSORY_IDS_ALL.length).toBe(ACCESSORIES_DENTAL.length + ACCESSORIES_GAME.length);
  });

  it("outfits count matches manifest target", () => {
    expect(OUTFIT_IDS.length).toBe(AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES);
  });

  it("all ids are non-empty strings", () => {
    for (const id of ACCESSORY_IDS_ALL) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
    for (const id of OUTFIT_IDS) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
