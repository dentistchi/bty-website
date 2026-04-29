import { describe, it, expect } from "vitest";
import {
  ARENA_LEADERBOARD_SCOPE_VALUES,
  arenaLeaderboardScopeFromParam,
} from "./arenaLeaderboardScopeFromParam";

describe("arenaLeaderboardScopeFromParam (edges)", () => {
  it("returns overall for null, undefined, empty, whitespace", () => {
    expect(arenaLeaderboardScopeFromParam(null)).toBe("overall");
    expect(arenaLeaderboardScopeFromParam(undefined)).toBe("overall");
    expect(arenaLeaderboardScopeFromParam("")).toBe("overall");
    expect(arenaLeaderboardScopeFromParam("   ")).toBe("overall");
  });

  it("returns scope for valid values", () => {
    expect(arenaLeaderboardScopeFromParam("overall")).toBe("overall");
    expect(arenaLeaderboardScopeFromParam("role")).toBe("role");
    expect(arenaLeaderboardScopeFromParam("office")).toBe("office");
    expect(arenaLeaderboardScopeFromParam("  overall  ")).toBe("overall");
  });

  it("returns null for invalid value", () => {
    expect(arenaLeaderboardScopeFromParam("invalid")).toBe(null);
    expect(arenaLeaderboardScopeFromParam("OVERALL")).toBe(null);
  });

  it("constant has three values", () => {
    expect(ARENA_LEADERBOARD_SCOPE_VALUES).toHaveLength(3);
    expect(ARENA_LEADERBOARD_SCOPE_VALUES).toContain("overall");
    expect(ARENA_LEADERBOARD_SCOPE_VALUES).toContain("role");
    expect(ARENA_LEADERBOARD_SCOPE_VALUES).toContain("office");
  });
});
