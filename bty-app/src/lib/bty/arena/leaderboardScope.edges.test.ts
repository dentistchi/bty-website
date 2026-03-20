/**
 * Edge-case tests for leaderboardScope (Arena 6차).
 * TASK 3(mentorRequest)과 다른 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import {
  parseLeaderboardScope,
  roleToScopeLabel,
  LEADERBOARD_SCOPE_TYPES,
  LEADERBOARD_EXPOSED_FIELDS,
} from "./leaderboardScope";

describe("leaderboardScope (edges)", () => {
  it("parseLeaderboardScope returns overall for null or invalid param", () => {
    expect(parseLeaderboardScope(null)).toBe("overall");
    expect(parseLeaderboardScope("invalid")).toBe("overall");
    expect(parseLeaderboardScope("  ")).toBe("overall");
  });

  it("parseLeaderboardScope trims param and returns valid scope", () => {
    expect(parseLeaderboardScope("role ")).toBe("role");
    expect(parseLeaderboardScope(" office")).toBe("office");
  });

  it("roleToScopeLabel trims and lowercases before mapping", () => {
    expect(roleToScopeLabel("  DOCTOR  ")).toBe("Doctor");
    expect(roleToScopeLabel("  Staff  ")).toBe("Staff");
  });

  it("LEADERBOARD_SCOPE_TYPES and LEADERBOARD_EXPOSED_FIELDS have expected lengths", () => {
    expect(LEADERBOARD_SCOPE_TYPES).toHaveLength(3);
    expect(LEADERBOARD_EXPOSED_FIELDS).toHaveLength(6);
  });
});
