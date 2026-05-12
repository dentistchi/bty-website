/**
 * C6 241 — Healing + Awakening GET 스모크: 401 → 200 (한 플로우).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as healingGET } from "./healing/route";
import { GET as awakeningGET } from "./awakening/route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
  copyCookiesAndDebug: vi.fn(),
}));

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function supabaseActsEmpty() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { from: vi.fn(() => chain) };
}

describe("241 Healing/Awakening GET smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 unauthenticated then 200 for healing and awakening when authed", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: null, supabase: {}, base: {} });
    expect((await healingGET(req("/api/bty/healing"))).status).toBe(401);

    mockRequireUser.mockResolvedValueOnce({ user: null, supabase: {}, base: {} });
    expect((await awakeningGET(req("/api/bty/awakening"))).status).toBe(401);

    mockRequireUser.mockResolvedValue({
      user: { id: "u241" },
      supabase: supabaseActsEmpty(),
      base: {},
    });

    const h = await healingGET(req("/api/bty/healing"));
    expect(h.status).toBe(200);
    const hj = await h.json();
    expect(hj.ok).toBe(true);
    expect(hj.phase).toBeDefined();
    expect(hj.awakeningProgress?.progressPercent).toBeDefined();

    const a = await awakeningGET(req("/api/bty/awakening"));
    expect(a.status).toBe(200);
    const aj = await a.json();
    expect(aj.ok).toBe(true);
    expect(aj.acts).toBeDefined();
    expect(aj.trigger?.type).toBe("day_based");
    expect(Array.isArray(aj.completedActs)).toBe(true);
  });
});
