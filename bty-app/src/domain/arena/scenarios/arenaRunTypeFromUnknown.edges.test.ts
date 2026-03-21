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
});
