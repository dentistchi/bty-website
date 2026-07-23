/**
 * GET /api/arena/action-reviews/[actionContractId] — detail route contract (Slice 3.1B-3N Phase 5B).
 * Auth 401; generic 404 on deny (no existence/reason leak); re-resolves per request; safe DTO only.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockDetail = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  unauthenticated: () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/arena/hostActionReviewQueue.server", () => ({
  getHostActionReviewDetail: (...a: unknown[]) => mockDetail(...a),
}));

import { GET } from "./route";

const ctx = (id: string) => ({ params: Promise.resolve({ actionContractId: id }) });
const req = () => new NextRequest("https://x.test/api/arena/action-reviews/c1?locale=en");

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
