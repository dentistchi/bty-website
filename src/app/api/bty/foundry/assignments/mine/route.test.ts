/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Slice 3.1B-3E learner read route. Proves auth is REQUIRED (401), identity is
 * server-derived (the service is called with auth.getUser().id, never a client value),
 * and the Room URL is composed from the minted token + request origin.
 */

const getSupabaseAdmin = vi.fn();
const getSupabaseServerClient = vi.fn();
const listMyAssignments = vi.fn();

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

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => getSupabaseServerClient(),
}));
vi.mock("@/lib/bty/foundry/events/foundryLearnerAssignmentService", () => ({
  listMyAssignments: (...a: unknown[]) => listMyAssignments(...a),
}));

let GET: typeof import("./route").GET;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
});

const BASE = "https://bty-arena-staging.example.workers.dev/api/bty/foundry/assignments/mine";
function req() {
  return new NextRequest(BASE, { headers: { origin: "https://bty-arena-staging.example.workers.dev" } });
}
function authed(userId: string | null) {
  getSupabaseServerClient.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }) },
  });
}

describe("GET /api/bty/foundry/assignments/mine — authorization", () => {
  it("503 when the service-role client is unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("401 for an unauthenticated caller — the service is NEVER reached", async () => {
    getSupabaseAdmin.mockReturnValue({});
    authed(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthenticated" });
    expect(listMyAssignments).not.toHaveBeenCalled();
  });
});

describe("GET /api/bty/foundry/assignments/mine — contract", () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReturnValue({ __admin: true });
    authed("user-hanbit");
  });

  it("reads the caller's OWN id (server-derived) — the client supplies no user id", async () => {
    listMyAssignments.mockResolvedValue([]);
    await GET(req());
    expect(listMyAssignments).toHaveBeenCalledWith({ __admin: true }, "user-hanbit");
  });

  it("composes roomUrl from the request origin + minted token and returns only justified fields", async () => {
    listMyAssignments.mockResolvedValue([
      {
        assignmentId: "a1",
        eventId: "e5",
        status: "completed",
        title: "Onboarding Care",
        assignedAt: "2026-07-01T00:00:00Z",
        completedAt: "2026-07-10T00:00:00Z",
        joinToken: "btyfr1.abc.def",
        participationMode: "assigned_overlay",
      },
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; assignments: Record<string, unknown>[] };
    expect(body.ok).toBe(true);
    expect(body.assignments).toHaveLength(1);
    expect(body.assignments[0]).toEqual({
      assignmentId: "a1",
      eventId: "e5",
      status: "completed",
      title: "Onboarding Care",
      assignedAt: "2026-07-01T00:00:00Z",
      completedAt: "2026-07-10T00:00:00Z",
      roomUrl: "https://bty-arena-staging.example.workers.dev/f/btyfr1.abc.def",
      participationMode: "assigned_overlay",
    });
    // No leakage of internal-only fields.
    expect(body.assignments[0]).not.toHaveProperty("joinToken");
    expect(body.assignments[0]).not.toHaveProperty("membershipId");
  });
});
