/**
 * XP 멱등 키 경계 (SPRINT 53 TASK 8 / 259 C3).
 */
import { describe, it, expect } from "vitest";
import {
  xpAwardEventDedupKey,
  isXpAwardDuplicateEvent,
} from "./xpAwardDedup";

describe("xpAwardDedup edges (259)", () => {
  it("xpAwardEventDedupKey trims and coerces nullish to empty segments", () => {
    expect(xpAwardEventDedupKey("  u1  ", " src ", " id ")).toBe("u1|src|id");
    expect(xpAwardEventDedupKey("", "", "")).toBe("||");
  });

  it("isXpAwardDuplicateEvent: empty dedup key is not duplicate", () => {
    expect(isXpAwardDuplicateEvent("   ", new Set(["a|b|c"]))).toBe(false);
    expect(isXpAwardDuplicateEvent("", new Set())).toBe(false);
  });

  it("isXpAwardDuplicateEvent: trims key before lookup", () => {
    const set = new Set(["u|s|e"]);
    expect(isXpAwardDuplicateEvent("  u|s|e  ", set)).toBe(true);
  });
});
