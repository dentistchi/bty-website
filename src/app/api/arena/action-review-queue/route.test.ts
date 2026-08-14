/**
 * GET /api/arena/action-review-queue — queue route contract (Slice 3.1B-3N Phase 5B).
 * Auth 401; empty 200 for non-Host; DTO shape; no private fields leak; fail-soft.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockList = vi.fn();
const mockCounts = vi.fn();
const ZERO_COUNTS = { verificationPending: 0, needsRevision: 0, reviewedAccepted: 0, awaitingResolution: 0 };

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  requireConsentedUser: async (...a: unknown[]) => ({ ...(await mockRequireUser(...a)), consentDenied: null }),
  unauthenticated: () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/arena/hostActionReviewQueue.server", () => ({
  listHostActionReviewQueue: (...a: unknown[]) => mockList(...a),
  getHostActionReviewStageCounts: (...a: unknown[]) => mockCounts(...a),
}));

import { GET } from "./route";

const req = () => new NextRequest("https://x.test/api/arena/action-review-queue?locale=en");

describe("GET /api/arena/action-review-queue", () => {
  beforeEach(() => {
    mockRequireUser.mockReset();
    mockList.mockReset();
    mockCounts.mockReset();
    mockCounts.mockResolvedValue({ ...ZERO_COUNTS });
  });

  it("401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("200 empty list for a non-Host / no-edge actor", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, base: {} });
    mockList.mockResolvedValue([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], stageCounts: ZERO_COUNTS });
  });

  it("returns the queue DTO and leaks no private fields", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "host-a" }, base: {} });
    mockList.mockResolvedValue([
      {
        actionContractId: "c1",
        learnerLabel: "Nickname",
        actionSummary: "Do the thing",
        submittedAt: "2026-07-01T00:00:00Z",
        originalDeadline: "2026-07-05T00:00:00Z",
        verificationMode: "hybrid",
        statusLabel: "Awaiting your review",
      },
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    const serialized = JSON.stringify(body);
    for (const forbidden of ["user_id", "email", "membership", "organization", "authorityId", "reason", "raw_text", "response_text", "who", "what"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("fail-soft: a service throw yields an empty list, never a 500", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, base: {} });
    mockList.mockRejectedValue(new Error("boom"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], stageCounts: ZERO_COUNTS });
  });
});
