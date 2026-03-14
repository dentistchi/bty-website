/**
 * GET /api/arena/leadership-engine/air — 401·200 (Foundry Leader AIR).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/leadership-engine/air");
}

describe("GET /api/arena/leadership-engine/air", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with zeroed air_7d, air_14d, air_90d when no activations", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      },
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.air_7d).toEqual({ air: 0, missedWindows: 0, integritySlip: false });
    expect(data.air_14d).toEqual({ air: 0, missedWindows: 0, integritySlip: false });
    expect(data.air_90d).toEqual({ air: 0, missedWindows: 0, integritySlip: false });
  });

  it("returns 200 with air snapshot when activations exist", async () => {
    const base = new Date("2026-03-10T00:00:00Z");
    const rows = [
      {
        activation_id: "act1",
        user_id: "u1",
        type: "micro_win",
        chosen_at: new Date(base.getTime() - 3 * 86400000).toISOString(),
        due_at: new Date(base.getTime() - 1 * 86400000).toISOString(),
        completed_at: new Date(base.getTime() - 2 * 86400000).toISOString(),
      },
    ];
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        data: rows,
      }),
    };
    const supabase = {
      ...chain,
      from: vi.fn().mockImplementation(function (this: unknown, table: string) {
        if (table === "le_activation_log") {
          return { ...chain, order: vi.fn().mockReturnValue({ data: rows }) };
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ activation_id: "act1", verified: true }] }),
        };
      }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.air_7d).toBeDefined();
    expect(data.air_14d).toBeDefined();
    expect(data.air_90d).toBeDefined();
    expect(typeof data.air_7d.air).toBe("number");
  });
});
