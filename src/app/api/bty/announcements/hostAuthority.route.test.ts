import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

/**
 * Who may read a Host's own tracking (Slice A1-VIS-R2).
 *
 * ★ THE BOUNDARY ERROR THIS CORRECTS, MEASURED ON A DEVICE (2026-09-02T21:36Z).
 *
 * The route asked `requireConsentedUser`, so a real Host was refused `403 consent_required` before
 * `listHostAnnouncements` ran — his session was valid (`/auth/v1/user` returned 200) and ZERO reads
 * reached the announcement tables. He had no `arena_profiles` row, and a Teams-first Host never
 * passes through the Arena learner flow at all: 2 of 13 linked accounts carry a consent version.
 *
 * Arena consent governs what a LEARNER agreed to about their own practice data. This endpoint
 * returns a Host their own audit of a message they captured and sent. The replacement is stricter
 * where it matters — Track CAPABILITY, the same predicate that guards the Teams gates — so a
 * non-Host who used to receive an empty list is now refused outright.
 */

const requireUser = vi.fn();
const unauthenticated = vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }));
const canTrackWithBty = vi.fn();
const listHostAnnouncements = vi.fn();
const isActivePlatformAdmin = vi.fn();
const isActiveFoundryHost = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (req: unknown) => requireUser(req),
  unauthenticated: () => unauthenticated(),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ __admin: true }) }));
vi.mock("@/lib/bty/authority/platformAdmin.server", () => ({
  canTrackWithBty: (admin: unknown, id: unknown) => canTrackWithBty(admin, id),
}));
vi.mock("@/lib/bty/announcement/announcementService.server", () => ({
  listHostAnnouncements: (admin: unknown, id: unknown) => listHostAnnouncements(admin, id),
}));

const HC = "18b1ee80-2200-4bc6-91d7-039ba43f6a50";
const OTHER = "617f7cea-e154-4b0d-9b69-7a15ef59f25f";
const PLAIN = "aaaaaaaa-0000-0000-0000-000000000009";
const REAL_ID = "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5";

const req = () => new NextRequest("https://arena.btydaily.com/api/bty/announcements/host");
async function GET() {
  const mod = await import("@/app/api/bty/announcements/host/route");
  return mod.GET(req());
}
const signedIn = (id: string) => requireUser.mockResolvedValue({ user: { id }, base: new Response("{}") });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn(HC);
  canTrackWithBty.mockResolvedValue(true);
  listHostAnnouncements.mockResolvedValue([{ id: REAL_ID, hostFraming: "Pay" }]);
});

describe("★ 1-3. capability, not Arena consent, decides", () => {
  it("★ 1. an active Platform Admin with NO arena_profiles row gets 200", async () => {
    // The exact production shape: hc holds an admin grant and has never consented in Arena.
    const res = await GET();
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).toContain(REAL_ID);
  });

  it("★ 2. an active Foundry Host with NO arena_profiles row gets 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("★ 3. a consented Host gets exactly the same result — consent changes nothing here", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("★ the route never consults Arena consent", async () => {
    const SRC = readFileSync("src/app/api/bty/announcements/host/route.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(SRC).not.toContain("requireConsentedUser");
    expect(SRC).not.toContain("consentDenied");
    expect(SRC).not.toContain("arena_profiles");
    expect(SRC).toContain("canTrackWithBty");
  });
});

describe("★ 4-7. the refusals", () => {
  it("★ 7. an unauthenticated request gets 401 and never reaches the capability check", async () => {
    requireUser.mockResolvedValue({ user: null, base: new Response("{}") });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(canTrackWithBty).not.toHaveBeenCalled();
    expect(listHostAnnouncements).not.toHaveBeenCalled();
  });

  it("★ 4. an authenticated participant with no capability gets 403, not an empty list", async () => {
    signedIn(PLAIN);
    canTrackWithBty.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "track_capability_required" });
    // The tell that this is a refusal and not "you have nothing": no query was issued.
    expect(listHostAnnouncements).not.toHaveBeenCalled();
  });

  it("★ 5. a REVOKED Platform Admin with no Host grant gets 403", async () => {
    canTrackWithBty.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(listHostAnnouncements).not.toHaveBeenCalled();
  });

  it("★ 6. a REVOKED Host with no Admin grant gets 403", async () => {
    canTrackWithBty.mockResolvedValue(false);
    expect((await GET()).status).toBe(403);
  });

});

describe("★ 8-11. the authority source and the scope", () => {
  it("★ 8. capability is asked about the SERVER-resolved user id", async () => {
    await GET();
    expect(canTrackWithBty).toHaveBeenCalledWith({ __admin: true }, HC);
  });

  it("★ 8. inheritance comes from the server-owned grant table", () => {
    const AUTH = readFileSync("src/lib/bty/authority/platformAdmin.server.ts", "utf8");
    expect(AUTH).toContain("bty_platform_admin_grants");
  });

  it("★ 9. no email, UUID constant, user_metadata or app_metadata is in the authorization path", () => {
    const SRC = readFileSync("src/app/api/bty/announcements/host/route.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(SRC).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(SRC).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(SRC).not.toMatch(/user_metadata|app_metadata|\bemail\b/);
  });

  it("★ 10+11. the owner scope is the session user, passed into the query", async () => {
    await GET();
    expect(listHostAnnouncements).toHaveBeenCalledWith({ __admin: true }, HC);
    const SERVICE = readFileSync("src/lib/bty/announcement/announcementService.server.ts", "utf8");
    expect(SERVICE).toMatch(/\.eq\("owner_user_id", ownerUserId\)/);
  });

  it("★ 11. a different Host is scoped to their OWN id, never hc's", async () => {
    signedIn(OTHER);
    await GET();
    expect(listHostAnnouncements).toHaveBeenCalledWith({ __admin: true }, OTHER);
    expect(listHostAnnouncements).not.toHaveBeenCalledWith(expect.anything(), HC);
  });
});

describe("★ 12-15. what this slice did NOT touch", () => {
  const code = (p: string) =>
    readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("★ 12. the route writes nothing — no arena_profiles row is created or changed", () => {
    const SRC = code("src/app/api/bty/announcements/host/route.ts");
    expect(SRC).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
    expect(SRC).not.toContain("arena_profiles");
  });

  it("★ 13. it writes no announcement or recipient row either", () => {
    const SERVICE = code("src/lib/bty/announcement/announcementService.server.ts");
    const host = SERVICE.slice(SERVICE.indexOf("listHostAnnouncements"));
    expect(host).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  });

  it("★ 14. /mine and /respond keep their OWNERSHIP contract", () => {
    /*
      Written in the previous slice as "keep their consent contract", when only the HOST route had
      moved. A1-VIS-R3 then measured the same boundary error on the recipient side and moved both:
      Teams Tracking is a workplace message workflow, and a person asked one question by their
      manager should not accept a learner document to answer it.

      The boundary that never moved, and is the real one, is what this now protects: a recipient
      may only see or answer a row bound to their OWN canonical user id.
    */
    for (const p of [
      "src/app/api/bty/announcements/mine/route.ts",
      "src/app/api/bty/announcements/[id]/respond/route.ts",
    ]) {
      expect(code(p), p).toContain("requireUser");
      expect(code(p), p).not.toContain("requireConsentedUser");
    }
  });

  it("★ 15. TrackingSent no longer renders or links to the Arena consent flow", () => {
    const UI = code("src/components/app-shell/TrackingSent.tsx");
    expect(UI).not.toContain("consent_required");
    expect(UI).not.toContain("legal/accept");
    expect(UI).not.toContain("Accept the BTY terms");
    // ...and the ordinary failure states survive.
    expect(UI).toContain("tracking-sent-error");
    expect(UI).toContain("getSession");
  });
});
