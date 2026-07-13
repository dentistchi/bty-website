import { describe, it, expect } from "vitest";
import { FALLBACK_VERSION, selectFallbackLine, selectFrameFallbackLine } from "@/domain/daily/livingResponseFallback";
import { deriveCommitmentFrame, selectProposition } from "@/domain/daily/livingResponseFrame";
import { validateLivingResponse } from "@/lib/bty/daily/livingResponseValidator";
import { guardPhrasesFor } from "@/domain/daily/livingResponseGuardPhrases";

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
    expect(FALLBACK_VERSION).toBe("lrfb_v3");
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

describe("selectFrameFallbackLine — V2.1 frame-specific Golden floor", () => {
  const REL = ["self", "others", "world"] as const;

  it("is deterministic per frame and locale, distinct per frame", () => {
    const lines = REL.map((r) => selectFrameFallbackLine(deriveCommitmentFrame(r)!, "en"));
    expect(new Set(lines).size).toBe(3); // one distinct Golden per frame
    for (const r of REL) {
      const f = deriveCommitmentFrame(r)!;
      expect(selectFrameFallbackLine(f, "en")).toBe(selectFrameFallbackLine(f, "en")); // replay-stable
    }
  });

  it("provides a KO variant with no digits and no newline", () => {
    for (const r of REL) {
      const ko = selectFrameFallbackLine(deriveCommitmentFrame(r)!, "ko");
      expect(ko).toMatch(/[가-힣]/);
      expect(ko).not.toMatch(/\d/);
      expect(ko).not.toContain("\n");
    }
  });

  it("every EN Golden fallback PASSES the real validator against its own proposition", () => {
    for (const r of REL) {
      const frame = deriveCommitmentFrame(r)!;
      const line = selectFrameFallbackLine(frame, "en");
      const proposition = selectProposition(frame, "commitment", [], `2026-07-12:${r}`);
      const res = validateLivingResponse(line, {
        relationship: r,
        guardPhrases: guardPhrasesFor("en", r),
        concepts: [],
        recentTexts: [],
        proposition,
      });
      expect(res.violations).toEqual([]);
      expect(res.ok).toBe(true);
    }
  });

  it("every KO Golden fallback PASSES the real validator against its own proposition", () => {
    for (const r of REL) {
      const frame = deriveCommitmentFrame(r)!;
      const line = selectFrameFallbackLine(frame, "ko");
      const proposition = selectProposition(frame, "commitment", [], `2026-07-12:${r}`);
      const res = validateLivingResponse(line, {
        relationship: r,
        guardPhrases: guardPhrasesFor("ko", r),
        concepts: [],
        recentTexts: [],
        proposition,
      });
      expect(res.ok).toBe(true);
    }
  });
});

describe("selectFrameFallbackLine — V2.2 repetition Golden floor", () => {
  const REP = [
    { rel: "self" as const, code: "SELF_RETURN_STRONG", movement: "repeated_inward_return" as const },
    { rel: "self" as const, code: "SELF_KEEP_STEADY", movement: "repeated_naming" as const },
    { rel: "others" as const, code: "OTHERS_RELATIONAL_STRONG", movement: "repeated_relational_presence" as const },
  ];

  it("returns a distinct recurrence Golden per movement, replay-stable", () => {
    const lines = REP.map(({ rel, movement }) => selectFrameFallbackLine(deriveCommitmentFrame(rel)!, "en", movement));
    expect(new Set(lines).size).toBe(3);
    for (const { rel, movement } of REP) {
      const f = deriveCommitmentFrame(rel)!;
      expect(selectFrameFallbackLine(f, "en", movement)).toBe(selectFrameFallbackLine(f, "en", movement));
    }
  });

  for (const loc of ["en", "ko"] as const) {
    it(`every ${loc.toUpperCase()} repetition Golden PASSES the validator at repetition depth`, () => {
      for (const { rel, code, movement } of REP) {
        const frame = deriveCommitmentFrame(rel)!;
        const line = selectFrameFallbackLine(frame, loc, movement);
        const proposition = selectProposition(frame, "repetition", [code], `2026-07-12:${rel}`);
        expect(proposition.repetition?.movement).toBe(movement); // sanity: proposition really is repetition
        const res = validateLivingResponse(line, {
          relationship: rel,
          guardPhrases: guardPhrasesFor(loc, rel),
          concepts: [],
          recentTexts: [],
          proposition,
        });
        expect(res.violations, `${loc}/${movement}`).toEqual([]);
        expect(res.ok).toBe(true);
      }
    });
  }
});
