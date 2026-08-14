import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Chainable admin fake capturing the owner-scope filter + returning canned rows.
const eqCapture = vi.fn();
const orderCapture = vi.fn();
let OWNER_EVENTS: Array<Record<string, unknown>> = [];
let PARTICIPATION: Array<{ event_id: string }> = [];
const adminFrom = vi.fn((table: string) => {
  if (table === "bty_events") {
    return {
      select: () => ({
        eq: (col: string, val: string) => {
          eqCapture(col, val);
          return {
            order: (c: string, o: unknown) => {
              orderCapture(c, o);
              return { data: OWNER_EVENTS, error: null };
            },
          };
        },
      }),
    };
  }
  // bty_event_participation
  return {
    select: () => ({
      in: (_c: string, ids: string[]) => ({ data: PARTICIPATION.filter((p) => ids.includes(p.event_id)), error: null }),
    }),
  };
});
const getSupabaseAdmin = vi.fn(() => ({ from: adminFrom }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

import { GET } from "./route";

const USER = { id: "host-A" };

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: USER } });
  OWNER_EVENTS = [];
  PARTICIPATION = [];
});

describe("GET /api/bty/events/mine (3.2E-EVENT-HOST)", () => {
  it("(1) anonymous → 401, no admin query", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("(2/3) scopes strictly to creator_id = session user (never client-supplied)", async () => {
    OWNER_EVENTS = [{ id: "e1", title: "T1", status: "active", valid_until: new Date(Date.now() + 3.6e6).toISOString(), created_at: "2026-07-28T00:00:00Z" }];
    await GET();
    expect(eqCapture).toHaveBeenCalledWith("creator_id", "host-A");
    expect(orderCapture).toHaveBeenCalledWith("created_at", { ascending: false }); // newest first
  });

  it("(4) participation counts: 0 / 1 / multiple", async () => {
    OWNER_EVENTS = [
      { id: "e1", title: "Two", status: "active", valid_until: new Date(Date.now() + 3.6e6).toISOString(), created_at: "2026-07-28T03:00:00Z" },
      { id: "e2", title: "One", status: "active", valid_until: new Date(Date.now() + 3.6e6).toISOString(), created_at: "2026-07-28T02:00:00Z" },
      { id: "e3", title: "Zero", status: "cancelled", valid_until: new Date(Date.now() - 3.6e6).toISOString(), created_at: "2026-07-28T01:00:00Z" },
    ];
    PARTICIPATION = [{ event_id: "e1" }, { event_id: "e1" }, { event_id: "e2" }];
    const res = await GET();
    const json = await res.json();
    expect(json.events.map((e: { participationCount: number }) => e.participationCount)).toEqual([2, 1, 0]);
    // canonical state reuse: active / cancelled
    const byId = Object.fromEntries(json.events.map((e: { eventId: string; state: string }) => [e.eventId, e.state]));
    expect(byId).toMatchObject({ e1: "ACTIVE", e3: "CANCELLED" });
  });

  it("(6/7) empty owner history → 200 with events: []", async () => {
    OWNER_EVENTS = [];
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ events: [] });
  });

  it("(8) payload contains NO participant PII / creator_id / org / token", async () => {
    OWNER_EVENTS = [{ id: "e1", title: "T", status: "active", valid_until: new Date(Date.now() + 3.6e6).toISOString(), created_at: "2026-07-28T00:00:00Z" }];
    PARTICIPATION = [{ event_id: "e1" }];
    const res = await GET();
    const json = await res.json();
    const keys = Object.keys(json.events[0]).sort();
    expect(keys).toEqual(["closesAt", "createdAt", "eventId", "opensAt", "participationCount", "state", "title"]);
    const blob = JSON.stringify(json);
    for (const forbidden of ["creator_id", "user_id", "email", "organization", "token", "host-A"]) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it("state ENDED when valid_until is in the past (active status)", async () => {
    OWNER_EVENTS = [{ id: "e1", title: "T", status: "active", valid_until: new Date(Date.now() - 1000).toISOString(), created_at: "2026-07-28T00:00:00Z" }];
    const res = await GET();
    const json = await res.json();
    expect(json.events[0].state).toBe("ENDED");
  });
});
