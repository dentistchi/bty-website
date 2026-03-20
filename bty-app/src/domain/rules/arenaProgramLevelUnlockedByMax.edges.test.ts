import { describe, it, expect } from "vitest";
import {
  ARENA_LEADER_LEVEL_ORDER,
  ARENA_STAFF_LEVEL_ORDER,
  arenaTrackLevelOrdering,
  isArenaProgramLevelUnlockedByMax,
} from "./arenaProgramLevelUnlockedByMax";

describe("arenaProgramLevelUnlockedByMax (edges)", () => {
  it("staff: S2 max unlocks S1 and S2 only", () => {
    const o = ARENA_STAFF_LEVEL_ORDER;
    expect(isArenaProgramLevelUnlockedByMax("S1", "S2", o)).toBe(true);
    expect(isArenaProgramLevelUnlockedByMax("S2", "S2", o)).toBe(true);
    expect(isArenaProgramLevelUnlockedByMax("S3", "S2", o)).toBe(false);
  });

  it("leader: L4 max unlocks all leader levels", () => {
    const o = ARENA_LEADER_LEVEL_ORDER;
    expect(isArenaProgramLevelUnlockedByMax("L1", "L4", o)).toBe(true);
    expect(isArenaProgramLevelUnlockedByMax("L4", "L4", o)).toBe(true);
  });

  it("unknown max or level → false", () => {
    const o = ARENA_STAFF_LEVEL_ORDER;
    expect(isArenaProgramLevelUnlockedByMax("S1", "X1", o)).toBe(false);
    expect(isArenaProgramLevelUnlockedByMax("Z9", "S3", o)).toBe(false);
  });

  it("arenaTrackLevelOrdering matches staff/leader arrays", () => {
    expect(arenaTrackLevelOrdering("staff")).toEqual(ARENA_STAFF_LEVEL_ORDER);
    expect(arenaTrackLevelOrdering("leader")).toEqual(ARENA_LEADER_LEVEL_ORDER);
  });
});
