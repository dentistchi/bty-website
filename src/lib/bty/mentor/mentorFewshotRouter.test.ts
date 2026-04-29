/**
 * mentorFewshotRouter — detectBundle, ALL_BUNDLES 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { detectBundle, ALL_BUNDLES, type FewShotBundle, type BundleKey } from "./mentorFewshotRouter";

describe("mentorFewshotRouter", () => {
  describe("ALL_BUNDLES", () => {
    it("contains exactly three bundles", () => {
      expect(ALL_BUNDLES).toHaveLength(3);
    });

    it("each bundle has key, name, keywords, examples", () => {
      const keys: BundleKey[] = ["clinical", "relationship", "learning"];
      for (const b of ALL_BUNDLES as FewShotBundle[]) {
        expect(keys).toContain(b.key);
        expect(typeof b.name).toBe("string");
        expect(Array.isArray(b.keywords)).toBe(true);
        expect(Array.isArray(b.examples)).toBe(true);
      }
    });
  });

  describe("detectBundle", () => {
    it("returns clinical bundle for clinical keywords", () => {
      const r = detectBundle("tooth extraction and implant");
      expect(r.key).toBe("clinical");
    });

    it("returns relationship bundle for relationship keywords", () => {
      const r = detectBundle("team conflict and boundaries");
      expect(r.key).toBe("relationship");
    });

    it("returns learning bundle for learning keywords", () => {
      const r = detectBundle("learning growth and feedback");
      expect(r.key).toBe("learning");
    });

    it("defaults to relationship when no keyword hits", () => {
      const r = detectBundle("hello world");
      expect(r.key).toBe("relationship");
    });

    it("uses topic hint when text has no keyword hits", () => {
      const r = detectBundle("something random", "clinical");
      expect(r.key).toBe("clinical");
    });

    it("trims user text", () => {
      const r = detectBundle("  relationship trust  ");
      expect(r.key).toBe("relationship");
    });
  });
});
