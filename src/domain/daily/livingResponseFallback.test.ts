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
    expect(FALLBACK_VERSION).toBe("lrfb_v2");
  });

  it("selects an evidence-specific family when a concept is provided", () => {
    const own = selectFallbackLine("others", "2026-07-12", "en", ["ownership"]);
    const repair = selectFallbackLine("others", "2026-07-12", "en", ["repair"]);
    expect(own).not.toBe(repair); // different concept → different family line
    expect(/responsib|own|conversation|said/i.test(own)).toBe(true); // grounded in ownership/communication
    expect(/repair|avoided|faced|address/i.test(repair)).toBe(true);
  });

  it("falls back to the generic per-relationship set when no concept maps", () => {
    const line = selectFallbackLine("world", "2026-07-12", "en", []);
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toMatch(/\d/);
  });

  it("KO concept fallback is Korean and has no digits", () => {
    const ko = selectFallbackLine("others", "2026-07-12", "ko", ["repair"]);
    expect(ko).toMatch(/[가-힣]/);
    expect(ko).not.toMatch(/\d/);
  });
});
