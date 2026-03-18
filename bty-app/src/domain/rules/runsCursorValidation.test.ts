import { describe, it, expect } from "vitest";
import {
  parseRunsListCursorOrNull,
  isValidRunsListCursorEncoding,
} from "./runsCursorValidation";

describe("runsCursorValidation", () => {
  const validRid = "550e8400-e29b-41d4-a716-446655440000";
  const validSa = "2026-01-15T12:00:00.000Z";

  it("rejects empty and garbage", () => {
    expect(parseRunsListCursorOrNull("")).toBeNull();
    expect(parseRunsListCursorOrNull("not-base64!!!")).toBeNull();
    expect(isValidRunsListCursorEncoding("")).toBe(false);
  });

  it("rejects invalid JSON or missing fields", () => {
    expect(parseRunsListCursorOrNull("e30")).toBeNull(); // {}
    expect(parseRunsListCursorOrNull(btoaUnurl(JSON.stringify({ sa: validSa })))).toBeNull();
  });

  it("rejects bad uuid or bad date", () => {
    const badRid = btoaUnurl(JSON.stringify({ sa: validSa, rid: "not-a-uuid" }));
    expect(parseRunsListCursorOrNull(badRid)).toBeNull();
    const badSa = btoaUnurl(JSON.stringify({ sa: "not-a-date", rid: validRid }));
    expect(parseRunsListCursorOrNull(badSa)).toBeNull();
  });

  it("accepts valid sa+rid payload (base64url)", () => {
    const payload = JSON.stringify({ sa: validSa, rid: validRid });
    const cur = btoaUnurl(payload);
    const p = parseRunsListCursorOrNull(cur);
    expect(p).toEqual({ sa: validSa, rid: validRid });
    expect(isValidRunsListCursorEncoding(cur)).toBe(true);
  });
});

function btoaUnurl(json: string): string {
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
