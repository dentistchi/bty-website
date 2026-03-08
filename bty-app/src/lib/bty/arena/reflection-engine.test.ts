/**
 * reflection-engine — detectPatterns 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { detectPatterns, type PatternTag } from "./reflection-engine";

describe("reflection-engine", () => {
  describe("detectPatterns", () => {
    const allTags: PatternTag[] = [
      "defensive", "blame", "rushed", "control", "avoidant",
      "people_blame", "short_term", "ego_threat",
    ];

    it("returns zero scores and empty tags for empty or irrelevant text", () => {
      const r = detectPatterns("");
      expect(r.tags).toEqual([]);
      expect(r.topTag).toBeUndefined();
      for (const t of allTags) expect(r.scores[t]).toBe(0);

      const r2 = detectPatterns("hello world");
      expect(r2.tags).toEqual([]);
      for (const t of allTags) expect(r2.scores[t]).toBe(0);
    });

    it("detects defensive pattern (EN)", () => {
      const r = detectPatterns("It was not my fault");
      expect(r.scores.defensive).toBeGreaterThan(0);
      expect(r.tags).toContain("defensive");
    });

    it("detects defensive pattern (KO)", () => {
      const r = detectPatterns("내 탓 아니야");
      expect(r.scores.defensive).toBeGreaterThan(0);
      expect(r.tags).toContain("defensive");
    });

    it("detects blame pattern", () => {
      const r = detectPatterns("It was their fault");
      expect(r.scores.blame).toBeGreaterThan(0);
      expect(r.tags).toContain("blame");
    });

    it("detects rushed pattern", () => {
      const r = detectPatterns("We need this asap");
      expect(r.scores.rushed).toBeGreaterThan(0);
      expect(r.tags).toContain("rushed");
    });

    it("detects control pattern (KO)", () => {
      const r = detectPatterns("무조건 해야 해");
      expect(r.scores.control).toBeGreaterThan(0);
      expect(r.tags).toContain("control");
    });

    it("sets topTag when scores are present", () => {
      const r = detectPatterns("not my fault their fault");
      expect(r.topTag).toBeDefined();
      expect(allTags).toContain(r.topTag);
    });

    it("handles null/undefined as empty string", () => {
      const r = detectPatterns(null as unknown as string);
      expect(r.tags).toEqual([]);
      expect(r.topTag).toBeUndefined();
    });
  });
});
