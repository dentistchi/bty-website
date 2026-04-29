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

  /** S91 TASK8: trim-only padding; internal newlines/tabs are content (not collapsed). */
  it("accepts exactly max length after surrounding trim", () => {
    const core = "m".repeat(ARENA_SYSTEM_MESSAGE_MAX_LENGTH);
    expect(arenaSystemMessageFromUnknown(` \n${core}\t `)).toBe(core);
  });

  it("preserves internal newlines and tabs", () => {
    expect(arenaSystemMessageFromUnknown("  line1\nline2\tend  ")).toBe("line1\nline2\tend");
  });

  /**
   * S127 C3 TASK8 — **S126** resolve-outcome·**S91** trim 라인과 구분 (비문자 스칼라).
   */
  it("S127: returns null for Symbol and bigint", () => {
    expect(arenaSystemMessageFromUnknown(Symbol("SYS"))).toBeNull();
    expect(arenaSystemMessageFromUnknown(BigInt(1))).toBeNull();
  });
});
