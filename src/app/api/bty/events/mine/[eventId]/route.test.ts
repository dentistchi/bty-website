import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
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
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: adminFrom }) }));

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
  EVENT_ROW = activeEvent();
  PARTICIPATION = [];
  PROFILES = [];
});

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
