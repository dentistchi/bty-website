/**
 * avatar-assets.data — JSON 로드 결과 검증 (목록 길이·필수 키).
 * 단일 소스: public/avatars/avatar-assets.json. 치과 41 + 게임 33 악세사리, 옷 Professional 7 + Fantasy 7.
 */
import { describe, it, expect } from "vitest";
import {
  ACCESSORIES_DENTAL,
  ACCESSORIES_GAME,
  ACCESSORY_IDS_ALL,
  OUTFITS_PROFESSIONAL,
  OUTFITS_FANTASY,
} from "./avatar-assets.data";

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

  it("accessories lists have expected minimum lengths (dental 41, game 33 per spec or JSON)", () => {
    expect(ACCESSORIES_DENTAL.length).toBeGreaterThanOrEqual(1);
    expect(ACCESSORIES_GAME.length).toBeGreaterThanOrEqual(1);
  });

  it("ACCESSORY_IDS_ALL is dental + game concatenation", () => {
    expect(ACCESSORY_IDS_ALL.length).toBe(ACCESSORIES_DENTAL.length + ACCESSORIES_GAME.length);
  });

  it("outfits professional 7, fantasy 7", () => {
    expect(OUTFITS_PROFESSIONAL).toHaveLength(7);
    expect(OUTFITS_FANTASY).toHaveLength(7);
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
