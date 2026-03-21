/**
 * arenaIsoDateOnlyFromUnknown — 경계 (S89 TASK11 / C3; **S98** NBSP·윤년·S96 라인 미중복).
 */
import { describe, it, expect } from "vitest";
import { arenaIsoDateOnlyFromUnknown } from "./arenaIsoDateOnlyFromUnknown";

describe("arenaIsoDateOnlyFromUnknown (edges)", () => {
  it("accepts valid YYYY-MM-DD including from datetime prefix", () => {
    expect(arenaIsoDateOnlyFromUnknown("2024-06-15")).toBe("2024-06-15");
    expect(arenaIsoDateOnlyFromUnknown("  2024-06-15T12:00:00Z  ")).toBe("2024-06-15");
  });

  it("returns null for non-string, wrong length, bad calendar, invalid pattern", () => {
    expect(arenaIsoDateOnlyFromUnknown(null)).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("")).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("2024-1-01")).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("2024-01-1")).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("2024-00-10")).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("2024-02-30")).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("not-a-date")).toBeNull();
  });

  /** S98 TASK8: NBSP/ideographic space inside token (≠ S96 lifecycle / runId lines). */
  it("returns null when NBSP or ideographic space breaks the digit-hyphen pattern", () => {
    expect(arenaIsoDateOnlyFromUnknown("2024-06\u00A015")).toBeNull();
    expect(arenaIsoDateOnlyFromUnknown("2024\u3000-06-15")).toBeNull();
  });

  /** S98 TASK8: leap year — valid Feb 29 vs invalid on non-leap year. */
  it("accepts Feb 29 on leap year and rejects Feb 29 on non-leap year", () => {
    expect(arenaIsoDateOnlyFromUnknown("2024-02-29")).toBe("2024-02-29");
    expect(arenaIsoDateOnlyFromUnknown("2023-02-29")).toBeNull();
  });
});
