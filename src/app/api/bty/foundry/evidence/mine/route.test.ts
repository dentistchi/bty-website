/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * SLICE 3.2R-R1 — GET /api/bty/foundry/evidence/mine.
 *
 * The route is thin by design, so what this suite exists to prove is the boundary, not the logic:
 * the caller's id comes from the session and never from the request, and the SERIALIZED body
 * carries rung names and row ids and nothing else. The rung rules themselves are proven in
 * `learnerEvidenceService.test.ts`.
 */
const getSupabaseAdmin = vi.fn();
const listMyEvidence = vi.fn();
const requireConsentedUser = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/foundry/events/learnerEvidenceService", () => ({
  listMyEvidence: (...a: unknown[]) => listMyEvidence(...a),
}));
vi.mock("@/lib/supabase/route-client", () => ({
  requireConsentedUser: (...a: unknown[]) => requireConsentedUser(...a),
  unauthenticated: () => NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
  copyCookiesAndDebug: () => undefined,
}));

let GET: typeof import("./route").GET;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
});

const req = (qs = "") =>
  new NextRequest(`https://staging.example.workers.dev/api/bty/foundry/evidence/mine${qs}`);

function session(userId: string | null, consentDenied: NextResponse | null = null) {
  requireConsentedUser.mockResolvedValue({
    user: userId ? { id: userId } : null,
    base: NextResponse.next(),
    consentDenied,
  });
}

describe("GET /api/bty/foundry/evidence/mine", () => {
  it("401 for an anonymous caller — the service is never reached", async () => {
    getSupabaseAdmin.mockReturnValue({});
    session(null);
    expect((await GET(req())).status).toBe(401);
    expect(listMyEvidence).not.toHaveBeenCalled();
  });

  it("403 consent_required is passed through untouched", async () => {
    getSupabaseAdmin.mockReturnValue({});
    session("user-1", NextResponse.json({ error: "consent_required" }, { status: 403 }));
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(listMyEvidence).not.toHaveBeenCalled();
  });

  it("503 when the service-role client is unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    session("user-1");
    expect((await GET(req())).status).toBe(503);
    expect(listMyEvidence).not.toHaveBeenCalled();
  });

  it("scopes to the SESSION user — a query-string user id cannot redirect the read", async () => {
    getSupabaseAdmin.mockReturnValue({});
    session("user-1");
    listMyEvidence.mockResolvedValue([]);
    await GET(req("?userId=user-2&entryId=someone-else"));
    expect(listMyEvidence).toHaveBeenCalledTimes(1);
    expect(listMyEvidence.mock.calls[0]![1]).toBe("user-1");
  });

  it("returns rung names + row ids, and is private, no-store", async () => {
    getSupabaseAdmin.mockReturnValue({});
    session("user-1");
    listMyEvidence.mockResolvedValue([
      { entryId: "prog-1", eventId: "ev-1", evidence: { established: ["exposed", "reflected"], highestEstablished: "reflected" } },
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([
      {
        entryId: "prog-1",
        eventId: "ev-1",
        established: ["exposed", "reflected"],
        highestEstablished: "reflected",
        // Slice 3.2R-R3-R1 — present and empty, never absent: a record with nothing open still
        // states so, so the surface never has to tell "no follow-up" apart from "field missing".
        checkInAgain: [],
      },
    ]);
  });

  it("the serialized body carries NO private text key, even if the service ever leaked one", async () => {
    /*
      The route re-projects field by field rather than spreading the item, so a future widening of
      the service DTO cannot silently reach the wire. This asserts that property directly: the
      service is made to return extra private fields, and none of them appear.
    */
    getSupabaseAdmin.mockReturnValue({});
    session("user-1");
    listMyEvidence.mockResolvedValue([
      {
        entryId: "prog-1",
        eventId: "ev-1",
        evidence: { established: ["exposed"], highestEstablished: "exposed" },
        response_text: "LEAKED PRIVATE ANSWER",
        learner_reflection_text: "LEAKED PRIVATE REFLECTION",
      },
    ]);
    const raw = await (await GET(req())).text();
    expect(raw).not.toContain("LEAKED PRIVATE ANSWER");
    expect(raw).not.toContain("LEAKED PRIVATE REFLECTION");
    expect(raw).not.toContain("response_text");
    expect(raw).not.toContain("learner_reflection_text");
  });

  it("a learner with no completions gets a successful empty list, never a refusal", async () => {
    getSupabaseAdmin.mockReturnValue({});
    session("user-1");
    listMyEvidence.mockResolvedValue([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });
});
