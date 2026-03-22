import { describe, it, expect } from "vitest";
import {
  outfitIdFromOutfitFilename,
  outfitIdFromAnyOutfitPngFilename,
  slugifyOutfitAssetBasename,
  accessoryIdAndKindFromFilename,
  accessoryIdAndKindFromAnyFilename,
  partitionOutfitsAlphabetical,
  partitionOutfitsFromSplit,
} from "./avatar-manifest-scan";

describe("avatar-manifest-scan", () => {
  it("outfitIdFromOutfitFilename parses base outfit_*.png", () => {
    expect(outfitIdFromOutfitFilename("outfit_scrub_general.png")).toBe("scrub_general");
    expect(outfitIdFromOutfitFilename("outfit_figs_scrub_short.png")).toBe("figs_scrub_short");
  });

  it("outfitIdFromOutfitFilename rejects body variants", () => {
    expect(outfitIdFromOutfitFilename("outfit_figs_scrub_short_A.png")).toBeNull();
    expect(outfitIdFromOutfitFilename("outfit_x_D.png")).toBeNull();
  });

  it("slugifyOutfitAssetBasename handles spaced names", () => {
    expect(slugifyOutfitAssetBasename("1 Basic Clinic Scrubs")).toBe("1_basic_clinic_scrubs");
  });

  it("outfitIdFromAnyOutfitPngFilename accepts loose filenames", () => {
    expect(outfitIdFromAnyOutfitPngFilename("1 Basic Clinic Scrubs.png")).toBe("1_basic_clinic_scrubs");
    expect(outfitIdFromAnyOutfitPngFilename("outfit_scrub_general.png")).toBe("scrub_general");
  });

  it("accessoryIdAndKindFromFilename maps svg→dental, png→game", () => {
    expect(accessoryIdAndKindFromFilename("mask.svg")).toEqual({ id: "mask", kind: "dental" });
    expect(accessoryIdAndKindFromFilename("sword.png")).toEqual({ id: "sword", kind: "game" });
    expect(accessoryIdAndKindFromFilename("README.md")).toBeNull();
  });

  it("accessoryIdAndKindFromAnyFilename slugifies loose names", () => {
    expect(accessoryIdAndKindFromAnyFilename("Arena core.png")).toEqual({ id: "arena_core", kind: "game" });
    expect(accessoryIdAndKindFromAnyFilename("Dental Mirror.svg")).toEqual({ id: "dental_mirror", kind: "dental" });
  });

  it("partitionOutfitsAlphabetical splits 20 into 10+10", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id_${String(i).padStart(2, "0")}`);
    const { professional, fantasy } = partitionOutfitsAlphabetical(ids);
    expect(professional.length).toBe(10);
    expect(fantasy.length).toBe(10);
    expect([...professional, ...fantasy].sort()).toEqual([...ids].sort());
  });

  it("partitionOutfitsFromSplit validates exact partition", () => {
    const scanned = ["a", "b", "c"];
    const r = partitionOutfitsFromSplit(scanned, { professional: ["a", "b"], fantasy: ["c"] });
    expect(r.professional).toEqual(["a", "b"]);
    expect(r.fantasy).toEqual(["c"]);
  });

  it("partitionOutfitsFromSplit throws on mismatch", () => {
    expect(() =>
      partitionOutfitsFromSplit(["a", "b"], { professional: ["a"], fantasy: [] }),
    ).toThrow();
  });
});
