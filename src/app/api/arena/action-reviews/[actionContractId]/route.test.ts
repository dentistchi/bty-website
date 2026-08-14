/**
 * GET /api/arena/action-reviews/[actionContractId] — detail route contract (Slice 3.1B-3N Phase 5B).
 * Auth 401; generic 404 on deny (no existence/reason leak); re-resolves per request; safe DTO only.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockDetail = vi.fn();
const mockDecision = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  requireConsentedUser: async (...a: unknown[]) => ({ ...(await mockRequireUser(...a)), consentDenied: null }),
  unauthenticated: () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/arena/hostActionReviewQueue.server", () => ({
  getHostActionReviewDetail: (...a: unknown[]) => mockDetail(...a),
}));
vi.mock("@/lib/bty/arena/actionReviewDecision.server", () => ({
  resolveActionReviewDecision: (...a: unknown[]) => mockDecision(...a),
}));

import { GET, POST } from "./route";

const ctx = (id: string) => ({ params: Promise.resolve({ actionContractId: id }) });
const req = () => new NextRequest("https://x.test/api/arena/action-reviews/c1?locale=en");
const postReq = (body: unknown) =>
  new NextRequest("https://x.test/api/arena/action-reviews/c1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/arena/action-reviews/[actionContractId]", () => {
  beforeEach(() => {
    mockRequireUser.mockReset();
    mockDetail.mockReset();
  });

  it("401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
    const res = await GET(req(), ctx("c1"));
    expect(res.status).toBe(401);
    expect(mockDetail).not.toHaveBeenCalled();
  });

  it("404 generic when the resolver denies (null) — no existence/reason leak", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-b" }, base: {} });
    mockDetail.mockResolvedValue(null); // cross-pair / unknown / revoked all collapse to null
    const res = await GET(req(), ctx("c1"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND" });
  });

  it("re-resolves per request with the exact contract id + actor", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-a" }, base: {} });
    mockDetail.mockResolvedValue(null);
    await GET(req(), ctx("contract-xyz"));
    expect(mockDetail).toHaveBeenCalledTimes(1);
    const args = mockDetail.mock.calls[0];
    expect(args[1]).toBe("host-a"); // actorUserId
    expect(args[2]).toBe("contract-xyz"); // contractId
  });

  it("200 with safe detail on allow; no private fields", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-a" }, base: {} });
    mockDetail.mockResolvedValue({
      actionContractId: "c1",
      learnerLabel: "Nickname",
      actionSummary: "Do the thing",
      submittedAt: "2026-07-01T00:00:00Z",
      originalDeadline: "2026-07-05T00:00:00Z",
      verificationMode: "hybrid",
      statusLabel: "Awaiting your review",
      who: "the team",
      what: "hold a check-in",
      how: "in person",
      stepWhen: "Monday",
    });
    const res = await GET(req(), ctx("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.actionContractId).toBe("c1");
    const serialized = JSON.stringify(body);
    for (const forbidden of ["user_id", "email", "membership", "organization", "authorityId", "reason", "raw_text", "response_text"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("POST /api/arena/action-reviews/[actionContractId] — decision", () => {
  beforeEach(() => {
    mockRequireUser.mockReset();
    mockDecision.mockReset();
  });

  it("401 when unauthenticated; service never called", async () => {
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
    const res = await POST(postReq({ decision: "approve" }), ctx("c1"));
    expect(res.status).toBe(401);
    expect(mockDecision).not.toHaveBeenCalled();
  });

  it("200 on ok; passes server-resolved actor + contract to the service", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-a" }, base: {} });
    mockDecision.mockResolvedValue({
      ok: true,
      decision: "approve",
      previousStatus: "submitted",
      resultingStatus: "approved",
      reviewedAt: "2026-07-23T00:00:00Z",
      revisionNote: null,
      decisionAuditId: "a1",
      completionApplied: true,
    });
    const res = await POST(postReq({ decision: "approve" }), ctx("contract-xyz"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, resultingStatus: "approved" });
    const args = mockDecision.mock.calls[0][1];
    expect(args).toMatchObject({ actorUserId: "host-a", actionContractId: "contract-xyz", decision: "approve" });
  });

  it("422 when the note is required", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-a" }, base: {} });
    mockDecision.mockResolvedValue({ ok: false, code: "note_required" });
    const res = await POST(postReq({ decision: "request_revision" }), ctx("c1"));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("NOTE_REQUIRED");
  });

  it("409 ALREADY_RESOLVED on stale", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-a" }, base: {} });
    mockDecision.mockResolvedValue({ ok: false, code: "already_resolved", currentStatus: "approved" });
    const res = await POST(postReq({ decision: "approve" }), ctx("c1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "ALREADY_RESOLVED", status: "approved" });
  });

  it("unauthorized collapses to a generic 404 NOT_FOUND (no existence leak)", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-b" }, base: {} });
    mockDecision.mockResolvedValue({ ok: false, code: "unauthorized" });
    const res = await POST(postReq({ decision: "approve" }), ctx("c1"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});
