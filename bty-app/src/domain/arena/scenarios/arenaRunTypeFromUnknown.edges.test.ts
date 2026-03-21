/**
 * arenaRunTypeFromUnknown — 경계 (SPRINT 83 TASK42 / C3). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import { arenaRunTypeFromUnknown } from "./arenaRunTypeFromUnknown";

describe("arenaRunTypeFromUnknown (edges)", () => {
  it("returns canonical type for exact spellings", () => {
    expect(arenaRunTypeFromUnknown("lab")).toBe("lab");
    expect(arenaRunTypeFromUnknown("mission")).toBe("mission");
    expect(arenaRunTypeFromUnknown("beginner")).toBe("beginner");
  });

  it("accepts case-insensitive after trim", () => {
    expect(arenaRunTypeFromUnknown("  LAB ")).toBe("lab");
    expect(arenaRunTypeFromUnknown("Mission")).toBe("mission");
    expect(arenaRunTypeFromUnknown("BEGINNER")).toBe("beginner");
  });

  it("returns null for empty, unknown, or non-strings", () => {
    expect(arenaRunTypeFromUnknown("")).toBeNull();
    expect(arenaRunTypeFromUnknown("   ")).toBeNull();
    expect(arenaRunTypeFromUnknown("run")).toBeNull();
    expect(arenaRunTypeFromUnknown("lab_extra")).toBeNull();
    expect(arenaRunTypeFromUnknown(null)).toBeNull();
    expect(arenaRunTypeFromUnknown(undefined)).toBeNull();
    expect(arenaRunTypeFromUnknown(1)).toBeNull();
  });

  it("rejects plural, hyphenated, or spaced near-misses", () => {
    expect(arenaRunTypeFromUnknown("labs")).toBeNull();
    expect(arenaRunTypeFromUnknown("missions")).toBeNull();
    expect(arenaRunTypeFromUnknown("beginners")).toBeNull();
    expect(arenaRunTypeFromUnknown("lab-run")).toBeNull();
    expect(arenaRunTypeFromUnknown("lab run")).toBeNull();
    expect(arenaRunTypeFromUnknown("mission-mode")).toBeNull();
  });

  /**
   * S106 TASK8 — **S105** difficulty·event·**S104** copy/interpret 라인과 구분:
   * BOM trim → canonical, boxed String, ZWSP / fullwidth homoglyphs inside token.
   */
  it("S106: BOM prefix normalizes; boxed strings and homoglyph near-misses reject", () => {
    expect(arenaRunTypeFromUnknown("\uFEFFbeginner")).toBe("beginner");
    expect(arenaRunTypeFromUnknown("\uFEFF  lab  ")).toBe("lab");
    expect(arenaRunTypeFromUnknown(Object("mission"))).toBeNull();
    expect(arenaRunTypeFromUnknown(Object("lab"))).toBeNull();
    expect(arenaRunTypeFromUnknown("mi\u200bssion")).toBeNull();
    expect(arenaRunTypeFromUnknown("ｌab")).toBeNull();
    expect(arenaRunTypeFromUnknown("lab\uFF3C")).toBeNull();
  });

  /**
   * S119 C3 TASK8 — **S118** `arenaScenarioIdFromUnknown` Symbol·bigint·**S106** BOM 라인과 구분 (run **type** 축).
   */
  it("S119: returns null for Symbol and bigint", () => {
    expect(arenaRunTypeFromUnknown(Symbol("lab"))).toBeNull();
    expect(arenaRunTypeFromUnknown(BigInt(1))).toBeNull();
  });
});
