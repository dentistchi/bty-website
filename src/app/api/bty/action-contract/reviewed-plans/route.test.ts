import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockList = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  unauthenticated: () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/action-contract/reviewedActionPlans.server", () => ({
  listMyReviewedActionPlans: (...a: unknown[]) => mockList(...a),
}));

import { GET } from "./route";

const getReq = () => new NextRequest("https://x.test/api/bty/action-contract/reviewed-plans");

describe("reviewed-plans route", () => {
  beforeEach(() => { mockRequireUser.mockReset(); mockList.mockReset(); });

  it("401 when unauthenticated; service never called", async () => {
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("passes the SERVER-resolved user id (never client) and returns items + private no-store", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "learner-1" }, base: {} });
    mockList.mockResolvedValue([{ contractId: "c1" }]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), "learner-1");
    expect((await res.json()).items).toEqual([{ contractId: "c1" }]);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("fail-soft: a service throw yields an empty list, not a 500", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "learner-1" }, base: {} });
    mockList.mockRejectedValue(new Error("boom"));
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
  });
});
