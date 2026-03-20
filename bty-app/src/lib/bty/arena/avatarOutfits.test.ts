/**
 * AVATAR_LAYER_SPEC §6, §7 — 허용 outfit/accessory 슬롯 검증 단위 테스트.
 * getAllowedOutfitsForLevel, getOutfitById, accessorySlotsFromTier 및 슬롯 검증 규칙.
 */

import { describe, it, expect } from "vitest";
import {
  getAllowedOutfitsForLevel,
  getOutfitById,
  accessorySlotsFromTier,
  profileToAvatarCompositeKeys,
} from "./avatarOutfits";

// ---------------------------------------------------------------------------
// getAllowedOutfitsForLevel(theme, levelId)
// ---------------------------------------------------------------------------

describe("getAllowedOutfitsForLevel", () => {
  it("returns one outfit for S1 (first level)", () => {
    const pro = getAllowedOutfitsForLevel("professional", "S1");
    const fan = getAllowedOutfitsForLevel("fantasy", "S1");
    expect(pro).toHaveLength(1);
    expect(fan).toHaveLength(1);
    expect(pro[0].key).toBe("professional_outfit_scrub_general");
    expect(pro[0].name).toBe("일반 스크럽");
    expect(fan[0].key).toBe("fantasy_outfit_apprentice");
    expect(fan[0].name).toBe("견습");
  });

  it("returns cumulative outfits up to level (professional)", () => {
    const s1 = getAllowedOutfitsForLevel("professional", "S1");
    const s2 = getAllowedOutfitsForLevel("professional", "S2");
    const s3 = getAllowedOutfitsForLevel("professional", "S3");
    const l1 = getAllowedOutfitsForLevel("professional", "L1");
    expect(s1.length).toBeLessThanOrEqual(s2.length);
    expect(s2.length).toBeLessThanOrEqual(s3.length);
    expect(s3.length).toBeLessThanOrEqual(l1.length);
    const keys = new Set(l1.map((o) => o.key));
    expect(keys.has("professional_outfit_scrub_general")).toBe(true);
    expect(keys.has("professional_outfit_figs_scrub")).toBe(true);
    expect(keys.has("professional_outfit_doctor_gown")).toBe(true);
    expect(keys.has("professional_outfit_surgery_coat_suit")).toBe(true);
  });

  it("returns cumulative outfits up to level (fantasy)", () => {
    const l4 = getAllowedOutfitsForLevel("fantasy", "L4");
    const keys = l4.map((o) => o.key);
    expect(keys).toContain("fantasy_outfit_apprentice");
    expect(keys).toContain("fantasy_outfit_adventurer");
    expect(keys).toContain("fantasy_outfit_master");
  });

  it("uses key format theme_outfit_outfitId", () => {
    const outfits = getAllowedOutfitsForLevel("professional", "L4");
    for (const o of outfits) {
      expect(o.key).toMatch(/^(professional|fantasy)_outfit_[a-z0-9_]+$/);
      expect(o.name).toBeTruthy();
    }
  });

  it("returns 7 entries for L4 professional (all levels unlocked)", () => {
    const out = getAllowedOutfitsForLevel("professional", "L4");
    expect(out).toHaveLength(7);
  });

  it("returns 7 entries for L4 fantasy", () => {
    const out = getAllowedOutfitsForLevel("fantasy", "L4");
    expect(out).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// getOutfitById(theme, outfitId)
// ---------------------------------------------------------------------------

describe("getOutfitById", () => {
  const professionalOutfits = [
    "scrub_general",
    "figs_scrub",
    "doctor_gown",
    "surgery_coat_suit",
    "brand_suit",
    "figs_scrub_short",
    "shorts_tee",
  ];
  const fantasyOutfits = [
    "apprentice",
    "adventurer",
    "journeyer",
    "warrior_mage_mid",
    "senior",
    "senior_plus",
    "master",
  ];

  it("returns outfit result for valid professional outfit id with URL under /avatars/outfits/", () => {
    for (const id of professionalOutfits) {
      const result = getOutfitById("professional", id);
      expect(result).not.toBeNull();
      expect(result!.outfitId).toBe(id);
      expect(result!.outfitLabel).toBeTruthy();
      expect(Array.isArray(result!.accessoryIds)).toBe(true);
      expect(result!.imageUrl).toMatch(/^\/avatars\/outfits\/.+/);
      expect(result!.imageUrl.endsWith(".png")).toBe(true);
    }
  });

  it("returns outfit result for valid fantasy outfit id with URL under /avatars/outfits/", () => {
    for (const id of fantasyOutfits) {
      const result = getOutfitById("fantasy", id);
      expect(result).not.toBeNull();
      expect(result!.outfitId).toBe(id);
      expect(result!.imageUrl).toMatch(/^\/avatars\/outfits\/.+/);
      expect(result!.imageUrl.endsWith(".png")).toBe(true);
    }
  });

  it("returns null for wrong theme", () => {
    expect(getOutfitById("professional", "apprentice")).toBeNull();
    expect(getOutfitById("fantasy", "scrub_general")).toBeNull();
  });

  it("returns null for unknown outfit id", () => {
    expect(getOutfitById("professional", "unknown_outfit")).toBeNull();
    expect(getOutfitById("fantasy", "invalid")).toBeNull();
  });

  it("returns null for null/undefined/empty outfitId", () => {
    expect(getOutfitById("professional", null)).toBeNull();
    expect(getOutfitById("professional", undefined)).toBeNull();
    expect(getOutfitById("professional", "")).toBeNull();
    expect(getOutfitById("fantasy", "  ")).toBeNull();
  });

  it("treats null theme as professional (default)", () => {
    const result = getOutfitById(null, "figs_scrub");
    expect(result).not.toBeNull();
    expect(result!.outfitId).toBe("figs_scrub");
  });
});

// ---------------------------------------------------------------------------
// accessorySlotsFromTier(tier)
// ---------------------------------------------------------------------------

describe("accessorySlotsFromTier", () => {
  it("returns 0 for tier 0", () => {
    expect(accessorySlotsFromTier(0)).toBe(0);
  });

  it("returns 0 for tier 1–24", () => {
    expect(accessorySlotsFromTier(1)).toBe(0);
    expect(accessorySlotsFromTier(24)).toBe(0);
  });

  it("returns 1 for tier 25–49 (tier 25마다 1슬롯)", () => {
    expect(accessorySlotsFromTier(25)).toBe(1);
    expect(accessorySlotsFromTier(49)).toBe(1);
  });

  it("returns 2 for tier 50–74", () => {
    expect(accessorySlotsFromTier(50)).toBe(2);
    expect(accessorySlotsFromTier(74)).toBe(2);
  });

  it("returns 3 for tier 75–99", () => {
    expect(accessorySlotsFromTier(75)).toBe(3);
    expect(accessorySlotsFromTier(99)).toBe(3);
  });

  it("returns non-negative for negative tier (clamped)", () => {
    expect(accessorySlotsFromTier(-1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Validation rule: accessoryKeys.length <= accessorySlotsFromTier(tier)
// ---------------------------------------------------------------------------

describe("accessory slots validation rule", () => {
  it("allows empty array when slots is 0", () => {
    const slots = accessorySlotsFromTier(10);
    expect(slots).toBe(0);
    const keys: string[] = [];
    expect(keys.length <= slots).toBe(true);
  });

  it("rejects more keys than slots at tier 25", () => {
    const slots = accessorySlotsFromTier(25);
    expect(slots).toBe(1);
    expect(["acc_01"].length <= slots).toBe(true);
    expect(["acc_01", "acc_02"].length <= slots).toBe(false);
  });

  it("allows up to 2 keys at tier 50", () => {
    const slots = accessorySlotsFromTier(50);
    expect(slots).toBe(2);
    expect(["a", "b"].length <= slots).toBe(true);
    expect(["a", "b", "c"].length <= slots).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// profileToAvatarCompositeKeys (AVATAR_LAYER_SPEC §4)
// ---------------------------------------------------------------------------

describe("profileToAvatarCompositeKeys", () => {
  it("returns characterKey, theme, outfitKey, accessoryKeys", () => {
    const keys = profileToAvatarCompositeKeys({
      avatarCharacterId: "hero_01",
      avatarOutfitTheme: "professional",
      avatarSelectedOutfitId: "figs_scrub",
      avatarAccessoryIds: ["acc_handpiece"],
    });
    expect(keys.characterKey).toBe("hero_01");
    expect(keys.theme).toBe("professional");
    expect(keys.outfitKey).toBe("professional_outfit_figs_scrub");
    expect(keys.accessoryKeys).toEqual(["acc_handpiece"]);
  });

  it("returns null outfitKey when outfitId is null", () => {
    const keys = profileToAvatarCompositeKeys({
      avatarCharacterId: "mage_02",
      avatarOutfitTheme: "fantasy",
      avatarSelectedOutfitId: null,
      avatarAccessoryIds: [],
    });
    expect(keys.outfitKey).toBeNull();
    expect(keys.theme).toBe("fantasy");
    expect(keys.accessoryKeys).toEqual([]);
  });

  it("defaults characterKey to hero_01 when empty", () => {
    const keys = profileToAvatarCompositeKeys({
      avatarCharacterId: "",
      avatarOutfitTheme: "professional",
      avatarSelectedOutfitId: null,
      avatarAccessoryIds: [],
    });
    expect(keys.characterKey).toBe("hero_01");
  });
});
