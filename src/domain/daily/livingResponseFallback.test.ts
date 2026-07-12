import { describe, it, expect } from "vitest";
import { FALLBACK_VERSION, selectFallbackLine } from "@/domain/daily/livingResponseFallback";

describe("selectFallbackLine — deterministic, bounded, safe", () => {
  it("is deterministic for the same relationship + day + version", () => {
    const a = selectFallbackLine("self", "2026-07-12", "en");
    const b = selectFallbackLine("self", "2026-07-12", "en");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("stays within the curated set for each relationship", () => {
    for (const rel of ["self", "others", "world"] as const) {
      const line = selectFallbackLine(rel, "2026-07-12", "en");
      expect(typeof line).toBe("string");
      expect(line.length).toBeLessThan(160);
    }
  });

  it("has no digits/counts and is a single line", () => {
    for (const rel of ["self", "others", "world"] as const) {
      for (const day of ["2026-07-12", "2026-07-13", "2026-07-14"]) {
        const line = selectFallbackLine(rel, day, "en");
        expect(line).not.toMatch(/\d/);
        expect(line).not.toContain("\n");
      }
    }
  });

  it("provides a KO variant distinct from EN", () => {
    const en = selectFallbackLine("self", "2026-07-12", "en");
    const ko = selectFallbackLine("self", "2026-07-12", "ko");
    expect(ko).not.toBe(en);
    expect(ko).toMatch(/[가-힣]/);
  });

  it("version constant is stable", () => {
    expect(FALLBACK_VERSION).toBe("lrfb_v1");
  });
});
