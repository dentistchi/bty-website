/**
 * Lane 7 — resolveDisplayAvatarLayers must NOT clothe a user who has made no
 * explicit avatar choice. With no character, no selected outfit, and no theme,
 * the resolver returns empty layers (UI shows its initials placeholder) instead
 * of falling through to the level-based outfit (basic clinic scrubs).
 */
import { describe, it, expect } from "vitest";
import { resolveDisplayAvatarLayers } from "./avatarOutfits";

describe("resolveDisplayAvatarLayers — Lane 7 no-selection guard", () => {
  it("returns empty layers when the user has no character, outfit, or theme", () => {
    const out = resolveDisplayAvatarLayers({
      customAvatarUrl: null,
      avatarCharacterId: null,
      avatarOutfitTheme: null,
      levelId: "S1",
      avatarSelectedOutfitId: null,
    });
    expect(out).toEqual({ characterImageUrl: null, outfitImageUrl: null });
  });

  it("still returns empty at a higher level when nothing is selected (no grandfathering)", () => {
    const out = resolveDisplayAvatarLayers({
      customAvatarUrl: null,
      avatarCharacterId: null,
      avatarOutfitTheme: null,
      levelId: "L4",
      avatarSelectedOutfitId: null,
    });
    expect(out).toEqual({ characterImageUrl: null, outfitImageUrl: null });
  });

  it("honors a custom avatar url (guard does not apply)", () => {
    const out = resolveDisplayAvatarLayers({
      customAvatarUrl: "https://cdn.example/me.png",
      avatarCharacterId: null,
      avatarOutfitTheme: null,
      levelId: "S1",
      avatarSelectedOutfitId: null,
    });
    expect(out.characterImageUrl).toBe("https://cdn.example/me.png");
  });

  it("resolves an avatar once the user picks a character (not bare)", () => {
    const out = resolveDisplayAvatarLayers({
      customAvatarUrl: null,
      avatarCharacterId: "hero_01",
      avatarOutfitTheme: null,
      levelId: "S1",
      avatarSelectedOutfitId: null,
    });
    expect(out.characterImageUrl).toBeTruthy();
  });

  it("resolves the level outfit once the user picks a theme (not bare)", () => {
    const out = resolveDisplayAvatarLayers({
      customAvatarUrl: null,
      avatarCharacterId: null,
      avatarOutfitTheme: "professional",
      levelId: "S1",
      avatarSelectedOutfitId: null,
    });
    expect(out.characterImageUrl).toBeTruthy();
  });
});
