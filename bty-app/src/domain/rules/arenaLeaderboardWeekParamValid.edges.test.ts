import { describe, it, expect } from "vitest";
import { arenaLeaderboardWeekParamValid } from "./arenaLeaderboardWeekParamValid";

const THIS_MONDAY = "2026-03-16";

describe("arenaLeaderboardWeekParamValid (edges)", () => {
  it("returns ok for null, undefined, empty, current", () => {
    expect(arenaLeaderboardWeekParamValid(null, THIS_MONDAY)).toEqual({ ok: true });
    expect(arenaLeaderboardWeekParamValid(undefined, THIS_MONDAY)).toEqual({ ok: true });
    expect(arenaLeaderboardWeekParamValid("", THIS_MONDAY)).toEqual({ ok: true });
    expect(arenaLeaderboardWeekParamValid("current", THIS_MONDAY)).toEqual({ ok: true });
    expect(arenaLeaderboardWeekParamValid("  current  ", THIS_MONDAY)).toEqual({ ok: true });
  });

  it("returns ok when YYYY-MM-DD is Monday and equals currentMondayUtc", () => {
    expect(arenaLeaderboardWeekParamValid("2026-03-16", THIS_MONDAY)).toEqual({ ok: true });
  });

  it("returns INVALID_WEEK for non-YYYY-MM-DD format", () => {
    const r = arenaLeaderboardWeekParamValid("not-a-date", THIS_MONDAY);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("INVALID_WEEK");
      expect(r.message).toMatch(/YYYY-MM-DD|Monday/);
    }
    expect(arenaLeaderboardWeekParamValid("2026/03/16", THIS_MONDAY).ok).toBe(false);
    expect(arenaLeaderboardWeekParamValid("xyz", THIS_MONDAY).ok).toBe(false);
  });

  it("returns INVALID_WEEK when date is not Monday", () => {
    const r = arenaLeaderboardWeekParamValid("2026-03-17", THIS_MONDAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Monday/);
  });

  it("returns INVALID_WEEK when week is not current week", () => {
    const r = arenaLeaderboardWeekParamValid("2026-03-09", THIS_MONDAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/current/);
  });
});
