import { describe, it, expect } from "vitest";
import {
  ARENA_SYSTEM_MESSAGE_MAX_LENGTH,
  arenaSystemMessageFromUnknown,
} from "./arenaSystemMessageFromUnknown";

describe("arenaSystemMessageFromUnknown (edges)", () => {
  it("returns trimmed text for a non-empty string within max length", () => {
    expect(arenaSystemMessageFromUnknown("  SYSTEM // ok  ")).toBe("SYSTEM // ok");
  });

  it("returns null for non-string, empty/whitespace-only, or over max length", () => {
    expect(arenaSystemMessageFromUnknown(null)).toBeNull();
    expect(arenaSystemMessageFromUnknown(1)).toBeNull();
    expect(arenaSystemMessageFromUnknown("")).toBeNull();
    expect(arenaSystemMessageFromUnknown("   \n\t  ")).toBeNull();
    expect(
      arenaSystemMessageFromUnknown("x".repeat(ARENA_SYSTEM_MESSAGE_MAX_LENGTH + 1)),
    ).toBeNull();
  });

  it("accepts boundary length", () => {
    const s = "S".repeat(ARENA_SYSTEM_MESSAGE_MAX_LENGTH);
    expect(arenaSystemMessageFromUnknown(s)).toBe(s);
  });
});
