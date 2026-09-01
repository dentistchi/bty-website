import { describe, expect, it } from "vitest";
import { escapesTeamsFrame, isTeamsTabPath, shouldAttachBearer } from "@/domain/teams/tabRuntime";

const ORIGIN = "https://arena.btydaily.com";

/**
 * Teams tab runtime predicates (Slice A0).
 *
 * Each of these decides something that fails SILENTLY when it is wrong: a memory-only session on
 * the wrong page breaks first-ever sign-in, a bearer on the wrong host leaks a real credential,
 * and a missed escape blanks the Teams tab with no error. So they are pure and asserted here.
 */

describe("isTeamsTabPath — the tab, never the sign-in popup", () => {
  it("is true for the framed tab itself", () => {
    expect(isTeamsTabPath("/teams")).toBe(true);
    expect(isTeamsTabPath("/teams/")).toBe(true);
  });

  it("is FALSE for the popup, which is top-level and needs ordinary persistence", () => {
    // The PKCE verifier must survive the round trip to Microsoft. It does, because in the popup
    // this origin is first-party — but only if the client is built with persistence.
    expect(isTeamsTabPath("/teams/link")).toBe(false);
    expect(isTeamsTabPath("/teams/link/done")).toBe(false);
  });

  it("is false for every normal BTY route", () => {
    for (const p of ["/", "/en/app", "/ko/app", "/en/bty/login", "/api/me/today/brief", "/teamsy"]) {
      expect(isTeamsTabPath(p)).toBe(false);
    }
  });

  it("is false for absent input rather than throwing", () => {
    expect(isTeamsTabPath(null)).toBe(false);
    expect(isTeamsTabPath(undefined)).toBe(false);
  });
});

describe("shouldAttachBearer — a real Supabase token, so same-origin /api only", () => {
  it("attaches to same-origin BTY API calls, relative or absolute", () => {
    expect(shouldAttachBearer("/api/me/today/brief", ORIGIN)).toBe(true);
    expect(shouldAttachBearer("/api/bty/action-capture/mine?x=1", ORIGIN)).toBe(true);
    expect(shouldAttachBearer(`${ORIGIN}/api/arena/practice`, ORIGIN)).toBe(true);
  });

  it("NEVER attaches to another origin", () => {
    for (const u of [
      "https://graph.microsoft.com/v1.0/me",
      "https://teams.microsoft.com/l/message/x/1",
      "https://cdn.example.com/img.png",
      "https://arena.btydaily.com.evil.test/api/me",
      "http://arena.btydaily.com/api/me",
    ]) {
      expect(shouldAttachBearer(u, ORIGIN)).toBe(false);
    }
  });

  it("never attaches to same-origin NON-api paths", () => {
    for (const p of ["/teams", "/en/app", "/apiary/x", "/favicon.ico", "/_next/static/x.js"]) {
      expect(shouldAttachBearer(p, ORIGIN)).toBe(false);
    }
  });

  it("refuses an unparseable url rather than guessing", () => {
    expect(shouldAttachBearer("::::", ORIGIN)).toBe(false);
  });
});

describe("escapesTeamsFrame — would this blank the tab?", () => {
  it("stays for anything under /teams", () => {
    expect(escapesTeamsFrame("/teams", ORIGIN)).toBe(false);
    expect(escapesTeamsFrame("/teams/link", ORIGIN)).toBe(false);
    expect(escapesTeamsFrame(`${ORIGIN}/teams/link/done`, ORIGIN)).toBe(false);
  });

  it("escapes for every X-Frame-Options: DENY BTY route", () => {
    // These are the real shell deep links: the observe route, the practice hrefs and the Today
    // brief cards. Each is a normal BTY page and each would blank the frame.
    for (const p of ["/en/app", "/ko/app", "/en/observe/abc", "/en/bty/foundry", "/api/me/today/brief"]) {
      expect(escapesTeamsFrame(p, ORIGIN)).toBe(true);
    }
  });

  it("escapes for a different origin", () => {
    expect(escapesTeamsFrame("https://teams.microsoft.com/l/message/x/1", ORIGIN)).toBe(true);
  });

  it("does not treat in-page or non-navigating hrefs as an escape", () => {
    for (const p of ["", "#section", "mailto:a@b.c", "tel:123", "javascript:void(0)"]) {
      expect(escapesTeamsFrame(p, ORIGIN)).toBe(false);
    }
  });
});
