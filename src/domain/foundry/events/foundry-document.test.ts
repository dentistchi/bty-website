import { describe, it, expect } from "vitest";
import {
  isAllowedPdfMime,
  isPdfFilename,
  validatePageCount,
  computeMinReadSeconds,
  clampReadDeltaMs,
  mergeViewedPages,
  distinctViewedCount,
  sanitizeLastPage,
  isReadingRequirementMet,
  validateIntro,
  FOUNDRY_DOC_MIN_READ_FLOOR,
  FOUNDRY_DOC_MIN_READ_CAP,
  FOUNDRY_DOC_MAX_HEARTBEAT_DELTA_MS,
} from "./foundry-document";

describe("pdf mime + extension guards", () => {
  it("accepts application/pdf (case-insensitive) only", () => {
    expect(isAllowedPdfMime("application/pdf")).toBe(true);
    expect(isAllowedPdfMime("APPLICATION/PDF")).toBe(true);
    expect(isAllowedPdfMime("image/png")).toBe(false);
    expect(isAllowedPdfMime("")).toBe(false);
    expect(isAllowedPdfMime(undefined)).toBe(false);
  });
  it("accepts a .pdf filename only", () => {
    expect(isPdfFilename("training.pdf")).toBe(true);
    expect(isPdfFilename("TRAINING.PDF")).toBe(true);
    expect(isPdfFilename("training.pdf.exe")).toBe(false);
    expect(isPdfFilename("training")).toBe(false);
  });
});

describe("validatePageCount", () => {
  it("accepts positive integers within bound", () => {
    expect(validatePageCount(1)).toEqual({ ok: true, value: 1 });
    expect(validatePageCount("42")).toEqual({ ok: true, value: 42 });
  });
  it("rejects zero/negative/non-integer", () => {
    expect(validatePageCount(0).ok).toBe(false);
    expect(validatePageCount(-3).ok).toBe(false);
    expect(validatePageCount(1.5).ok).toBe(false);
    expect(validatePageCount("x").ok).toBe(false);
  });
  it("rejects absurdly large counts", () => {
    expect(validatePageCount(99999)).toEqual({ ok: false, reason: "page_count_too_large" });
  });
});

describe("computeMinReadSeconds — page-aware, floored, capped", () => {
  it("a one-page doc still asks for the floor", () => {
    expect(computeMinReadSeconds(1)).toBe(FOUNDRY_DOC_MIN_READ_FLOOR);
  });
  it("scales with pages between floor and cap", () => {
    expect(computeMinReadSeconds(10)).toBe(50); // 10 * 5
  });
  it("a huge doc is capped (never punitive)", () => {
    expect(computeMinReadSeconds(1000)).toBe(FOUNDRY_DOC_MIN_READ_CAP);
  });
  it("a one-page and a fifty-page doc do NOT behave identically", () => {
    expect(computeMinReadSeconds(1)).not.toBe(computeMinReadSeconds(50));
  });
});

describe("clampReadDeltaMs — honest active-time accumulation", () => {
  it("clamps an inflated delta to the per-beat cap (no fast-forwarding the gate)", () => {
    expect(clampReadDeltaMs(10_000_000)).toBe(FOUNDRY_DOC_MAX_HEARTBEAT_DELTA_MS);
  });
  it("passes a normal delta through", () => {
    expect(clampReadDeltaMs(8000)).toBe(8000);
  });
  it("treats negative/NaN/absent as zero", () => {
    expect(clampReadDeltaMs(-1)).toBe(0);
    expect(clampReadDeltaMs("nope")).toBe(0);
    expect(clampReadDeltaMs(undefined)).toBe(0);
  });
});

describe("mergeViewedPages — distinct set, never inflated", () => {
  it("unions and de-duplicates; repeated viewing of the same page does not inflate", () => {
    const a = mergeViewedPages([1, 2], [2, 2, 3], 10);
    expect(a).toEqual([1, 2, 3]);
    const b = mergeViewedPages(a, [1, 1, 1], 10);
    expect(b).toEqual([1, 2, 3]); // still 3 distinct
  });
  it("drops pages outside [1, pageCount]", () => {
    expect(mergeViewedPages([], [0, 1, 2, 11, -5], 10)).toEqual([1, 2]);
  });
  it("tolerates junk input", () => {
    expect(mergeViewedPages(null, "x", 5)).toEqual([]);
    expect(mergeViewedPages(undefined, [3], 5)).toEqual([3]);
  });
  it("distinctViewedCount matches the merged set size", () => {
    expect(distinctViewedCount([1, 2, 2, 3], 10)).toBe(3);
  });
});

describe("sanitizeLastPage", () => {
  it("keeps a valid page, rejects out-of-range", () => {
    expect(sanitizeLastPage(3, 10)).toBe(3);
    expect(sanitizeLastPage(0, 10)).toBeNull();
    expect(sanitizeLastPage(11, 10)).toBeNull();
    expect(sanitizeLastPage("x", 10)).toBeNull();
  });
});

describe("isReadingRequirementMet — all pages AND min active time", () => {
  it("false until every page is visited", () => {
    expect(isReadingRequirementMet({ pageCount: 5, distinctViewed: 4, activeReadMs: 999_999, minReadSeconds: 25 })).toBe(false);
  });
  it("false until the min active time is reached", () => {
    expect(isReadingRequirementMet({ pageCount: 5, distinctViewed: 5, activeReadMs: 10_000, minReadSeconds: 25 })).toBe(false);
  });
  it("true when both are satisfied", () => {
    expect(isReadingRequirementMet({ pageCount: 5, distinctViewed: 5, activeReadMs: 25_000, minReadSeconds: 25 })).toBe(true);
  });
});

describe("validateIntro — optional", () => {
  it("absent/blank → null (allowed)", () => {
    expect(validateIntro(undefined)).toEqual({ ok: true, value: null });
    expect(validateIntro("")).toEqual({ ok: true, value: null });
    expect(validateIntro("   ")).toEqual({ ok: true, value: null });
  });
  it("present → trimmed value; keeps newlines", () => {
    expect(validateIntro("  Read carefully.\nThen reflect.  ")).toEqual({ ok: true, value: "Read carefully.\nThen reflect." });
  });
  it("rejects over-long intro", () => {
    expect(validateIntro("x".repeat(601))).toEqual({ ok: false, reason: "intro_too_long" });
  });
});
