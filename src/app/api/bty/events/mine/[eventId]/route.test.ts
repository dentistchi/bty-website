import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
/*
  R9B.2: these routes now require CURRENT consent. This suite is about the route's own behaviour,
  and its subject has always been an ordinary consented learner — so the consent primitive says so
  explicitly. The consent VERDICT itself is proven by `requireConsentedUser.test.ts` and
  `learnerConsentGuard.route.test.ts`, which do not mock it.
*/
vi.mock("@/lib/legal/activeConsent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/activeConsent")>()),
  isConsentCurrent: async () => true,
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

// Fake admin: bty_events owner-scoped maybeSingle; bty_event_participation order; arena_profiles in().
let EVENT_ROW: Record<string, unknown> | null = null;
let PARTICIPATION: Array<{ user_id: string; scanned_at: string }> = [];
let PROFILES: Array<{ user_id: string; display_name: string | null }> = [];
const eventEqCapture = vi.fn();
const adminFrom = vi.fn((table: string) => {
  if (table === "bty_events") {
    return {
      select: () => ({
        eq: (c1: string, v1: string) => ({
          eq: (c2: string, v2: string) => {
            eventEqCapture(c1, v1, c2, v2);
            return { maybeSingle: async () => ({ data: EVENT_ROW, error: null }) };
          },
        }),
      }),
    };
  }
  if (table === "bty_event_participation") {
    return { select: () => ({ eq: () => ({ order: () => ({ data: PARTICIPATION, error: null }) }) }) };
  }
  // arena_profiles
  return { select: () => ({ in: (_c: string, ids: string[]) => ({ data: PROFILES.filter((p) => ids.includes(p.user_id)), error: null }) }) };
});
// Per-user auth lookup (getUserById — NOT directory-wide listUsers). No `listUsers` is provided,
// so any accidental directory-wide read would throw and fail the test.
const getUserById = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: adminFrom, auth: { admin: { getUserById } } }) }));

import { GET } from "./route";

const USER = { id: "host-A" };
const EVENT_ID = "ev-1";
const params = (id: string) => ({ params: Promise.resolve({ eventId: id }) });
const req = () => new NextRequest("https://app.test/api/bty/events/mine/ev-1?locale=en");
const activeEvent = () => ({ id: EVENT_ID, title: "Morning huddle", status: "active", valid_until: new Date(Date.now() + 3.6e6).toISOString(), created_at: "2026-07-28T00:00:00Z" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EVENT_QR_SECRET", "test-event-secret");
  getUser.mockResolvedValue({ data: { user: USER } });
  getUserById.mockResolvedValue({ data: { user: null } }); // default: no auth record
  EVENT_ROW = activeEvent();
  PARTICIPATION = [];
  PROFILES = [];
});

// Helper: stub auth-admin lookups by user id.
function authUsers(map: Record<string, { user_metadata?: Record<string, unknown>; email?: string | null }>) {
  getUserById.mockImplementation(async (id: string) => ({ data: { user: map[id] ? { ...map[id] } : null } }));
}

describe("GET /api/bty/events/mine/[eventId] (3.2E-EVENT-HOST-R1)", () => {
  it("(1) anonymous → 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req(), params(EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("(2) owner receives detail scoped by id AND creator_id (never client-supplied)", async () => {
    const res = await GET(req(), params(EVENT_ID));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(eventEqCapture).toHaveBeenCalledWith("id", EVENT_ID, "creator_id", "host-A");
    expect(json.event).toMatchObject({ eventId: EVENT_ID, title: "Morning huddle", state: "ACTIVE" });
  });

  it("(3/4/5) a non-owned/unknown event → 404 (non-disclosing)", async () => {
    EVENT_ROW = null; // owner-scoped query returns nothing for another Host / participant / unknown id
    const res = await GET(req(), params(EVENT_ID));
    expect(res.status).toBe(404);
  });

  it("(6/8/9) roster count matches, resolves display names, ordered by participation time", async () => {
    PARTICIPATION = [
      { user_id: "u1", scanned_at: "2026-07-28T01:00:00Z" },
      { user_id: "u2", scanned_at: "2026-07-28T02:00:00Z" },
    ];
    PROFILES = [{ user_id: "u1", display_name: "Alex" }, { user_id: "u2", display_name: null }];
    const res = await GET(req(), params(EVENT_ID));
    const json = await res.json();
    expect(json.event.participationCount).toBe(2);
    expect(json.participants).toEqual([
      { displayName: "Alex", participatedAt: "2026-07-28T01:00:00Z" },
      { displayName: null, participatedAt: "2026-07-28T02:00:00Z" }, // null → client fallback
    ]);
  });

  it("(10) payload contains NO user_id / email / creator_id / org / token-hash", async () => {
    PARTICIPATION = [{ user_id: "u1", scanned_at: "2026-07-28T01:00:00Z" }];
    PROFILES = [{ user_id: "u1", display_name: "Alex" }];
    const res = await GET(req(), params(EVENT_ID));
    const blob = JSON.stringify(await res.json());
    for (const forbidden of ["u1", "creator_id", "user_id", "organization", "email", "host-A"]) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it("(QR) an ACTIVE event returns a re-derived scannable QR payload for the owner", async () => {
    const res = await GET(req(), params(EVENT_ID));
    const json = await res.json();
    expect(json.event.qr.available).toBe(true);
    expect(json.event.qr.payload).toMatch(/\/bty\/events\/scan\?ev=btyev1\./); // canonical btyev1 deep link
  });

  it("(QR) an ENDED event does not offer a QR (would only scan to expired)", async () => {
    EVENT_ROW = { ...activeEvent(), valid_until: new Date(Date.now() - 1000).toISOString() };
    const res = await GET(req(), params(EVENT_ID));
    const json = await res.json();
    expect(json.event.state).toBe("ENDED");
    expect(json.event.qr.available).toBe(false);
    expect(json.event.qr.payload).toBeUndefined();
  });
});

describe("participant identity precedence (3.2E-EVENT-HOST-R2)", () => {
  const at = "2026-07-28T01:00:00Z";
  async function labels(): Promise<Array<string | null>> {
    const res = await GET(req(), params(EVENT_ID));
    const json = await res.json();
    return json.participants.map((p: { displayName: string | null }) => p.displayName);
  }

  it("(1) prefers arena_profiles.display_name (no auth lookup needed)", async () => {
    PARTICIPATION = [{ user_id: "u1", scanned_at: at }];
    PROFILES = [{ user_id: "u1", display_name: "Nick" }];
    authUsers({ u1: { user_metadata: { full_name: "Ignored" }, email: "ignored@e.com" } });
    expect(await labels()).toEqual(["Nick"]);
    expect(getUserById).not.toHaveBeenCalled(); // display_name present → no per-user lookup
  });

  it("(2) falls back to auth metadata full_name", async () => {
    PARTICIPATION = [{ user_id: "u1", scanned_at: at }];
    PROFILES = [{ user_id: "u1", display_name: null }];
    authUsers({ u1: { user_metadata: { full_name: "Full Name" }, email: "x@e.com" } });
    expect(await labels()).toEqual(["Full Name"]);
  });

  it("(3) falls back to auth metadata name", async () => {
    PARTICIPATION = [{ user_id: "u1", scanned_at: at }];
    PROFILES = [{ user_id: "u1", display_name: null }];
    authUsers({ u1: { user_metadata: { name: "TheName" }, email: "x@e.com" } });
    expect(await labels()).toEqual(["TheName"]);
  });

  it("(4) falls back to canonical email (as the single displayName)", async () => {
    PARTICIPATION = [{ user_id: "u1", scanned_at: at }];
    PROFILES = [{ user_id: "u1", display_name: null }];
    authUsers({ u1: { user_metadata: {}, email: "person@example.com" } });
    expect(await labels()).toEqual(["person@example.com"]);
  });

  it("(5) truly-missing identity → null (client shows the generic last resort)", async () => {
    PARTICIPATION = [{ user_id: "u1", scanned_at: at }];
    PROFILES = [{ user_id: "u1", display_name: null }];
    authUsers({}); // no auth record
    expect(await labels()).toEqual([null]);
  });

  it("(6/7) two accounts resolve to DISTINCT labels; Unicode/Korean preserved; empties rejected", async () => {
    PARTICIPATION = [
      { user_id: "u1", scanned_at: "2026-07-28T01:00:00Z" },
      { user_id: "u2", scanned_at: "2026-07-28T02:00:00Z" },
      { user_id: "u3", scanned_at: "2026-07-28T03:00:00Z" },
    ];
    PROFILES = [{ user_id: "u1", display_name: "김한빛" }, { user_id: "u2", display_name: "   " }];
    authUsers({ u2: { user_metadata: { full_name: "Bo Park" } }, u3: { email: "c@e.com" } });
    const out = await labels();
    expect(out).toEqual(["김한빛", "Bo Park", "c@e.com"]); // whitespace-only display_name rejected → auth fallback
    expect(new Set(out).size).toBe(3); // all distinguishable
  });

  it("(11) uses per-user getUserById only for missing users, deduped — never a directory listing", async () => {
    PARTICIPATION = [
      { user_id: "u1", scanned_at: "2026-07-28T01:00:00Z" }, // has display_name → no lookup
      { user_id: "u2", scanned_at: "2026-07-28T02:00:00Z" }, // missing → 1 lookup
      { user_id: "u2", scanned_at: "2026-07-28T03:00:00Z" }, // same user → NOT looked up again
    ];
    PROFILES = [{ user_id: "u1", display_name: "Nick" }];
    authUsers({ u2: { email: "u2@e.com" } });
    await labels();
    expect(getUserById).toHaveBeenCalledTimes(1); // deduped, only the one missing user
    expect(getUserById).toHaveBeenCalledWith("u2");
  });
});
