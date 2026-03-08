import { describe, it, expect } from "vitest";
import { QUESTIONS } from "./questions";
import type { DimensionKey } from "./types";

const DIMENSIONS: DimensionKey[] = [
  "core_self_esteem",
  "self_compassion",
  "self_esteem_stability",
  "growth_mindset",
  "social_self_esteem",
];

describe("assessment/questions", () => {
  it("QUESTIONS has 50 items", () => {
    expect(QUESTIONS).toHaveLength(50);
  });

  it("each question has id, text_en, text_ko, dimension, reverse", () => {
    for (const q of QUESTIONS) {
      expect(typeof q.id).toBe("string");
      expect(typeof q.text_en).toBe("string");
      expect(typeof q.text_ko).toBe("string");
      expect(DIMENSIONS).toContain(q.dimension);
      expect(typeof q.reverse).toBe("boolean");
    }
  });

  it("has 10 questions per dimension", () => {
    for (const dim of DIMENSIONS) {
      const count = QUESTIONS.filter((q) => q.dimension === dim).length;
      expect(count).toBe(10);
    }
  });

  it("ids are unique and sequential q01..q50", () => {
    const ids = QUESTIONS.map((q) => q.id).sort();
    expect(ids).toHaveLength(50);
    for (let i = 1; i <= 50; i++) {
      expect(ids[i - 1]).toBe(`q${String(i).padStart(2, "0")}`);
    }
  });
});
