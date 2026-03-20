import { describe, it, expect } from "vitest";
import { arenaLeaderboardScopeRoleLabel } from "./arenaLeaderboardScopeRoleLabel";

describe("arenaLeaderboardScopeRoleLabel (edges)", () => {
  it("maps doctor (case-insensitive, trimmed)", () => {
    expect(arenaLeaderboardScopeRoleLabel("doctor")).toBe("Doctor");
    expect(arenaLeaderboardScopeRoleLabel("Doctor")).toBe("Doctor");
    expect(arenaLeaderboardScopeRoleLabel("  DOCTOR  ")).toBe("Doctor");
  });

  it("maps office_manager and regional_manager to Manager", () => {
    expect(arenaLeaderboardScopeRoleLabel("office_manager")).toBe("Manager");
    expect(arenaLeaderboardScopeRoleLabel("regional_manager")).toBe("Manager");
    expect(arenaLeaderboardScopeRoleLabel("  OFFICE_MANAGER ")).toBe("Manager");
  });

  it("maps staff and dso", () => {
    expect(arenaLeaderboardScopeRoleLabel("staff")).toBe("Staff");
    expect(arenaLeaderboardScopeRoleLabel("  Staff  ")).toBe("Staff");
    expect(arenaLeaderboardScopeRoleLabel("dso")).toBe("DSO");
  });

  it("returns Role for null, undefined, empty", () => {
    expect(arenaLeaderboardScopeRoleLabel(null)).toBe("Role");
    expect(arenaLeaderboardScopeRoleLabel(undefined)).toBe("Role");
    expect(arenaLeaderboardScopeRoleLabel("")).toBe("Role");
  });

  it("passes through unknown codes as original string (incl. spacing)", () => {
    expect(arenaLeaderboardScopeRoleLabel("custom_role")).toBe("custom_role");
    expect(arenaLeaderboardScopeRoleLabel("  custom  ")).toBe("  custom  ");
  });

  it("returns whitespace-only input unchanged (raw is truthy; legacy parity)", () => {
    expect(arenaLeaderboardScopeRoleLabel("   ")).toBe("   ");
  });
});
