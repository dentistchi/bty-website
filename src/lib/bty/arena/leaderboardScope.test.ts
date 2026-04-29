import { describe, it, expect } from "vitest";
import {
  LEADERBOARD_SCOPE_TYPES,
  LEADERBOARD_EXPOSED_FIELDS,
  parseLeaderboardScope,
  parseLeaderboardQuery,
  mondayUTCDateString,
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

  describe("parseLeaderboardQuery", () => {
    const wed = new Date("2025-03-12T12:00:00.000Z");
    const thisMonday = mondayUTCDateString(wed);

    it("rejects invalid scope", () => {
      const r = parseLeaderboardQuery("nope", null, wed);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("INVALID_SCOPE");
    });

    it("accepts empty scope as overall", () => {
      const r = parseLeaderboardQuery("", "current", wed);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.scope).toBe("overall");
    });

    it("accepts trimmed role", () => {
      const r = parseLeaderboardQuery("  role  ", null, wed);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.scope).toBe("role");
    });

    it("rejects invalid week string", () => {
      const r = parseLeaderboardQuery(null, "not-a-date", wed);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("INVALID_WEEK");
    });

    it("rejects non-Monday date", () => {
      const r = parseLeaderboardQuery(null, "2025-03-11", wed);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("INVALID_WEEK");
    });

    it("rejects past week Monday", () => {
      const r = parseLeaderboardQuery(null, "2025-03-03", wed);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("INVALID_WEEK");
    });

    it("accepts current week Monday", () => {
      expect(thisMonday).toBe("2025-03-10");
      const r = parseLeaderboardQuery(null, thisMonday, wed);
      expect(r.ok).toBe(true);
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
