/**
 * arenaIsoTimestampFromUnknown — 경계 (S85 TASK8 / C3; **S99** ZWSP·S98 `arenaIsoDateOnly` 라인 미중복). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import {
  ARENA_ISO_TIMESTAMP_MAX_LENGTH,
  arenaIsoTimestampFromUnknown,
} from "./arenaIsoTimestampFromUnknown";

describe("arenaIsoTimestampFromUnknown (edges)", () => {
  it("returns trimmed string when Date.parse accepts", () => {
    expect(arenaIsoTimestampFromUnknown("  2026-03-20T12:00:00.000Z  ")).toBe(
      "2026-03-20T12:00:00.000Z"
    );
    expect(arenaIsoTimestampFromUnknown("2026-01-01")).toBe("2026-01-01");
  });

  it("returns null for empty, over max length, or unparseable", () => {
    expect(arenaIsoTimestampFromUnknown("")).toBeNull();
    expect(arenaIsoTimestampFromUnknown("   ")).toBeNull();
    expect(arenaIsoTimestampFromUnknown("not-a-date")).toBeNull();
    expect(
      arenaIsoTimestampFromUnknown("x".repeat(ARENA_ISO_TIMESTAMP_MAX_LENGTH + 1))
    ).toBeNull();
  });

  it("returns null for non-strings", () => {
    expect(arenaIsoTimestampFromUnknown(null)).toBeNull();
    expect(arenaIsoTimestampFromUnknown(undefined)).toBeNull();
    expect(arenaIsoTimestampFromUnknown(1760956800000)).toBeNull();
    expect(arenaIsoTimestampFromUnknown({})).toBeNull();
  });

  /** S92 TASK12: ISO-shaped but calendar-invalid → Date.parse NaN. */
  it("returns null when string looks ISO-like but is not a valid instant", () => {
    expect(arenaIsoTimestampFromUnknown("2026-13-40T99:99:99.000Z")).toBeNull();
  });

  /** S99 TASK8: trailing ZWSP — `trim()` does not strip U+200B → `Date.parse` NaN (≠ date-only NBSP-between-digits). */
  it("returns null when a zero-width space remains after trim", () => {
    expect(arenaIsoTimestampFromUnknown("2026-03-20T12:00:00.000Z\u200B")).toBeNull();
    expect(arenaIsoTimestampFromUnknown("  2026-01-01\u200B  ")).toBeNull();
  });

  /** S99 TASK8: inner newline — not removed by trim → `Date.parse` NaN. */
  it("returns null when the string contains an embedded newline", () => {
    expect(arenaIsoTimestampFromUnknown("2026-06-15\nT12:00:00.000Z")).toBeNull();
  });
});
