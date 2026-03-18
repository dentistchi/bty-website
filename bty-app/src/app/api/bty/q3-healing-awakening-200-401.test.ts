/**
 * Q3: GET bty/healing, bty/awakening — 200·401 batch.
 */
import { NextRequest, NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() =>
    NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

const { GET: getHealing } = await import("./healing/route");
const { GET: getAwakening } = await import("./awakening/route");

function supabaseActsEmpty() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { from: vi.fn(() => chain) };
}

describe("Q3 GET bty/healing · bty/awakening — 200·401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      user: null,
      supabase: {},
      base: {},
    });
  });

  it("401 unauthenticated; 200 with phase and acts payload", async () => {
    const h401 = await getHealing(
      new NextRequest("http://localhost/api/bty/healing"),
    );
    expect(h401.status).toBe(401);
    expect((await h401.json()).error).toBe("UNAUTHENTICATED");

    const a401 = await getAwakening(
      new NextRequest("http://localhost/api/bty/awakening"),
    );
    expect(a401.status).toBe(401);
    expect((await a401.json()).error).toBe("UNAUTHENTICATED");

    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseActsEmpty(),
      base: {},
    });

    const h200 = await getHealing(
      new NextRequest("http://localhost/api/bty/healing"),
    );
    expect(h200.status).toBe(200);
    const jh = await h200.json();
    expect(jh.ok).toBe(true);
    expect(jh.phase).toBeDefined();
    expect(jh.content?.ringType).toBeDefined();

    const a200 = await getAwakening(
      new NextRequest("http://localhost/api/bty/awakening"),
    );
    expect(a200.status).toBe(200);
    const ja = await a200.json();
    expect(ja.ok).toBe(true);
    expect(ja.acts["1"]).toBe("Reflection Chamber");
    expect(ja.acts["2"]).toBe("Transition");
    expect(ja.acts["3"]).toBe("Awakening");
    expect(ja.trigger?.type).toBe("day_based");
  });
});
