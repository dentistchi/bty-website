import { describe, it, expect } from "vitest";
import {
  xpAwardEventDedupKey,
  isXpAwardDuplicateEvent,
} from "./xpAwardDedup";

describe("xpAwardDedup", () => {
  it("xpAwardEventDedupKey stable shape", () => {
    expect(xpAwardEventDedupKey("u1", "run_complete", "run-abc")).toBe(
      "u1|run_complete|run-abc"
    );
  });

  it("isXpAwardDuplicateEvent", () => {
    const set = new Set(["u1|arena|e1"]);
    expect(isXpAwardDuplicateEvent("u1|arena|e1", set)).toBe(true);
    expect(isXpAwardDuplicateEvent("u1|arena|e2", set)).toBe(false);
    expect(isXpAwardDuplicateEvent("", set)).toBe(false);
  });
});
