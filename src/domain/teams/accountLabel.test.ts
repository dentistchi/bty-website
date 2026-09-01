import { describe, expect, it } from "vitest";
import { teamsAccountLabel, TEAMS_ACCOUNT_FALLBACK } from "@/domain/teams/accountLabel";

describe("teamsAccountLabel — names the person, never the address", () => {
  it("prefers a curated BTY profile name over a provider-supplied one", () => {
    const r = teamsAccountLabel({ profileDisplayName: "Dr. Chi", fullName: "Dr. Hanbit Chi (hc)", name: "Hanbit Chi" });
    expect(r).toEqual({ who: "Dr. Chi", how: "connected_with_teams", isFallback: false });
  });

  it("uses the canonical user's full_name when no profile name exists — today's real case", () => {
    // Measured on production: arena_profiles.display_name is NULL for every user.
    const r = teamsAccountLabel({ profileDisplayName: null, fullName: "Dr. Hanbit Chi (hc)", name: "Hanbit Chi" });
    expect(r.who).toBe("Dr. Hanbit Chi (hc)");
    expect(r.isFallback).toBe(false);
  });

  it("falls back to `name` when full_name is absent", () => {
    expect(teamsAccountLabel({ name: "Hanbit Chi" }).who).toBe("Hanbit Chi");
  });

  it("NEVER returns an email, at any tier", () => {
    const r = teamsAccountLabel({
      profileDisplayName: "founder@bty.example",
      fullName: "founder@bty.example",
      name: "founder@bty.example",
    });
    expect(r.who).toBe(TEAMS_ACCOUNT_FALLBACK);
    expect(r.isFallback).toBe(true);
    expect(r.who).not.toContain("@");
  });

  it("falls back honestly rather than rendering an empty row — never '…'", () => {
    for (const input of [{}, { fullName: "" }, { fullName: "   " }, { name: 42 }, { fullName: null }]) {
      const r = teamsAccountLabel(input);
      expect(r.who).toBe(TEAMS_ACCOUNT_FALLBACK);
      expect(r.who).not.toBe("…");
      expect(r.isFallback).toBe(true);
    }
  });

  it("refuses an absurdly long value rather than breaking the row", () => {
    expect(teamsAccountLabel({ fullName: "x".repeat(500) }).who).toBe(TEAMS_ACCOUNT_FALLBACK);
  });
});
