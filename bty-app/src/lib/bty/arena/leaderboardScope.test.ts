import { describe, it, expect } from "vitest";
import {
  LEADERBOARD_SCOPE_TYPES,
  LEADERBOARD_EXPOSED_FIELDS,
  parseLeaderboardScope,
  roleToScopeLabel,
} from "./leaderboardScope";

describe("leaderboardScope", () => {
  describe("parseLeaderboardScope", () => {
    it("returns role when param is role", () => {
      expect(parseLeaderboardScope("role")).toBe("role");
    });
    it("returns office when param is office", () => {
      expect(parseLeaderboardScope("office")).toBe("office");
    });
    it("returns overall for null or invalid", () => {
      expect(parseLeaderboardScope(null)).toBe("overall");
      expect(parseLeaderboardScope("")).toBe("overall");
      expect(parseLeaderboardScope("invalid")).toBe("overall");
      expect(parseLeaderboardScope("OVERALL")).toBe("overall");
    });
  });

  describe("roleToScopeLabel", () => {
    it("maps doctor to Doctor", () => {
      expect(roleToScopeLabel("doctor")).toBe("Doctor");
      expect(roleToScopeLabel("Doctor")).toBe("Doctor");
    });
    it("maps office_manager and regional_manager to Manager", () => {
      expect(roleToScopeLabel("office_manager")).toBe("Manager");
      expect(roleToScopeLabel("regional_manager")).toBe("Manager");
    });
    it("maps staff to Staff, dso to DSO", () => {
      expect(roleToScopeLabel("staff")).toBe("Staff");
      expect(roleToScopeLabel("dso")).toBe("DSO");
    });
    it("returns role as-is for unknown, empty returns Role", () => {
      expect(roleToScopeLabel("custom_role")).toBe("custom_role");
      expect(roleToScopeLabel("")).toBe("Role");
    });
  });

  describe("LEADERBOARD_SCOPE_TYPES / LEADERBOARD_EXPOSED_FIELDS", () => {
    it("scope types include overall, role, office", () => {
      expect(LEADERBOARD_SCOPE_TYPES).toEqual(["overall", "role", "office"]);
    });
    it("exposed fields include rank, seasonalXp, coreXp, codeName, subName, avatar", () => {
      expect(LEADERBOARD_EXPOSED_FIELDS).toContain("rank");
      expect(LEADERBOARD_EXPOSED_FIELDS).toContain("seasonalXp");
      expect(LEADERBOARD_EXPOSED_FIELDS).toContain("coreXp");
      expect(LEADERBOARD_EXPOSED_FIELDS).toContain("codeName");
      expect(LEADERBOARD_EXPOSED_FIELDS).toContain("subName");
      expect(LEADERBOARD_EXPOSED_FIELDS).toContain("avatar");
    });
  });
});
