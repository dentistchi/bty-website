/**
 * runs cursor base64url — 길이·UUID variant 경계 (SPRINT 49 TASK 8 / 255 C3).
 */
import { describe, it, expect } from "vitest";
import {
  parseRunsListCursorOrNull,
  isValidRunsListCursorEncoding,
} from "./runsCursorValidation";

function btoaUnurl(json: string): string {
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("runsCursorValidation edges (255)", () => {
  const validSa = "2026-01-15T12:00:00.000Z";

  it("rejects cursor raw longer than 4096 chars", () => {
    const long = "a".repeat(4097);
    expect(parseRunsListCursorOrNull(long)).toBeNull();
    expect(isValidRunsListCursorEncoding(long)).toBe(false);
  });

  it("rejects UUID when variant nibble is not 8/9/a/b", () => {
    const badVariant = "550e8400-e29b-41d4-c716-446655440000";
    const cur = btoaUnurl(JSON.stringify({ sa: validSa, rid: badVariant }));
    expect(parseRunsListCursorOrNull(cur)).toBeNull();
  });

  it("rejects rid with wrong version digit in UUID", () => {
    const badVer = "550e8400-e29b-61d4-a716-446655440000";
    const cur = btoaUnurl(JSON.stringify({ sa: validSa, rid: badVer }));
    expect(parseRunsListCursorOrNull(cur)).toBeNull();
  });
});
