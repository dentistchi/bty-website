/**
 * GET /api/arena/leadership-engine/tii — 401·200 (Foundry Leader 팀 TII).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetActiveLeague = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/arena/activeLeague", () => ({
  getActiveLeague: (...args: unknown[]) => mockGetActiveLeague(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/leadership-engine/tii");
}

describe("GET /api/arena/leadership-engine/tii", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    mockGetSupabaseAdmin.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetActiveLeague).not.toHaveBeenCalled();
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with tii null when no league", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetActiveLeague.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["avg_air", "avg_mwd", "tii", "tsp"].sort());
    expect(data.tii).toBeNull();
    expect(data.avg_air).toBeNull();
    expect(data.avg_mwd).toBeNull();
    expect(data.tsp).toBeNull();
  });

  it("returns 200 with tii and metrics when league and row exist", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: { tii: 0.75, avg_air: 0.8, avg_mwd: 0.25, tsp: 4 },
        error: null,
      }),
    };
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { tii: 0.75, avg_air: 0.8, avg_mwd: 0.25, tsp: 4 },
      error: null,
    });
    chain.limit.mockReturnValue({ maybeSingle });
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetSupabaseAdmin.mockReturnValue(chain);
    mockGetActiveLeague.mockResolvedValue({ league_id: "L1" });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tii).toBe(0.75);
    expect(data.avg_air).toBe(0.8);
    expect(data.avg_mwd).toBe(0.25);
    expect(data.tsp).toBe(4);
  });

  it("returns 200 with exactly tii, avg_air, avg_mwd, tsp keys", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetActiveLeague.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["avg_air", "avg_mwd", "tii", "tsp"].sort());
  });
});
