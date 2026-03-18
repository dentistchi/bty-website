/**
 * C6 242 — GET /api/bty/awakening 401→200 스모크 1건.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./awakening/route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
  copyCookiesAndDebug: vi.fn(),
}));

function supabaseActsEmpty() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { from: vi.fn(() => chain) };
}

describe("242 GET /api/bty/awakening smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 unauthenticated then 200 with acts and trigger when authed", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: null, supabase: {}, base: {} });
    const r401 = await GET(new NextRequest("http://localhost/api/bty/awakening"));
    expect(r401.status).toBe(401);

    mockRequireUser.mockResolvedValue({
      user: { id: "u242" },
      supabase: supabaseActsEmpty(),
      base: {},
    });
    const r200 = await GET(new NextRequest("http://localhost/api/bty/awakening"));
    expect(r200.status).toBe(200);
    const j = await r200.json();
    expect(j.ok).toBe(true);
    expect(j.acts).toBeDefined();
    expect(j.trigger?.day).toBe(30);
    expect(Array.isArray(j.completedActs)).toBe(true);
  });
});
