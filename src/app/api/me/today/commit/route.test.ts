/**
 * /api/me/today/commit — auth, validation, first-commit-wins status codes, cross-user safety.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockCommit = vi.fn();
const mockGet = vi.fn();
const mockGetAdmin = vi.fn();

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

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: () => Promise.resolve({ auth: { getUser: () => mockGetUser() } }),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => mockGetAdmin() }));
vi.mock("@/lib/bty/daily/todayRelationshipCommitment.server", () => ({
  commitTodayRelationship: (...a: unknown[]) => mockCommit(...a),
  getTodayCommitment: (...a: unknown[]) => mockGet(...a),
}));

import { GET, POST } from "./route";

const commitment = (relationship: string) => ({
  relationship,
  suggestedRelationship: null,
  dayKey: "2026-07-13",
  confirmedAt: "2026-07-12T20:30:00.000Z",
  locale: "en",
  timezoneSnapshot: "Asia/Seoul",
  tzFallback: false,
});

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/me/today/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const getReq = (tz?: string) =>
  new NextRequest(`http://localhost/api/me/today/commit${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`);

const authed = () => mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
const unauthed = () => mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

describe("/api/me/today/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdmin.mockReturnValue({}); // admin available by default
  });

  it("POST unauthenticated → 401, no write", async () => {
    unauthed();
    const res = await POST(postReq({ relationship: "self" }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it("GET unauthenticated → 401", async () => {
    unauthed();
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("POST malformed relationship → 400, no write", async () => {
    authed();
    for (const bad of [{ relationship: "Self" }, { relationship: "friend" }, {}, { relationship: 3 }]) {
      const res = await POST(postReq(bad));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_RELATIONSHIP");
    }
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it("first POST creates → 201 created:true", async () => {
    authed();
    mockCommit.mockResolvedValue({ status: "created", commitment: commitment("self") });
    const res = await POST(postReq({ relationship: "self", suggestedRelationship: "others", locale: "en", timeZone: "Asia/Seoul" }));
    expect(res.status).toBe(201);
    const d = await res.json();
    expect(d).toMatchObject({ ok: true, created: true });
    expect(d.commitment.relationship).toBe("self");
  });

  it("same-relationship retry → 200 created:false (no duplicate, existing row)", async () => {
    authed();
    mockCommit.mockResolvedValue({ status: "exists", commitment: commitment("self") });
    const res = await POST(postReq({ relationship: "self", timeZone: "Asia/Seoul" }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d).toMatchObject({ ok: true, created: false });
    expect(d.commitment.relationship).toBe("self");
  });

  it("different relationship → 409 COMMITMENT_LOCKED with canonical existing row", async () => {
    authed();
    mockCommit.mockResolvedValue({ status: "locked", commitment: commitment("others") });
    const res = await POST(postReq({ relationship: "self", timeZone: "Asia/Seoul" }));
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.code).toBe("COMMITMENT_LOCKED");
    expect(d.commitment.relationship).toBe("others"); // never overwritten
  });

  it("POST ignores a client-supplied user_id — always the authenticated id", async () => {
    authed();
    mockCommit.mockResolvedValue({ status: "created", commitment: commitment("self") });
    await POST(postReq({ relationship: "self", user_id: "attacker", userId: "attacker", timeZone: "Asia/Seoul" }));
    // service called with the authenticated user id, not any body field
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockCommit.mock.calls[0][1]).toBe("user-1");
  });

  it("GET returns current-day commitment for the authenticated user only", async () => {
    authed();
    mockGet.mockResolvedValue(commitment("world"));
    const res = await GET(getReq("Asia/Seoul"));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d).toMatchObject({ ok: true });
    expect(d.commitment.relationship).toBe("world");
    expect(mockGet.mock.calls[0][1]).toBe("user-1"); // scoped to auth id
  });

  it("GET returns null when no commitment today", async () => {
    authed();
    mockGet.mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect((await res.json()).commitment).toBeNull();
  });

  it("persistence unavailable (admin null) → 503, retryable, no fabricated success", async () => {
    authed();
    mockGetAdmin.mockReturnValue(null);
    const res = await POST(postReq({ relationship: "self" }));
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });

  it("service throw → 503, retryable (never fabricates confirmation)", async () => {
    authed();
    mockCommit.mockRejectedValue(new Error("db down"));
    const res = await POST(postReq({ relationship: "self" }));
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });
});
