/**
 * GET /api/emotional-stats/second-awakening — 401·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetSecondAwakening = vi.fn();
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: NextRequest, _base: Response) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/emotional-stats/secondAwakening", () => ({
  getSecondAwakening: (...args: unknown[]) => mockGetSecondAwakening(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/emotional-stats/second-awakening");
}

describe("GET /api/emotional-stats/second-awakening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: new Response() });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetSecondAwakening).not.toHaveBeenCalled();
  });

  it("returns 500 when getSecondAwakening throws", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });
    mockGetSecondAwakening.mockRejectedValue(new Error("db_error"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to load Second Awakening");
    expect(data.eligible).toBe(false);
    expect(data.completed).toBe(false);
  });

  it("returns 200 with result when authenticated", async () => {
    const base = new Response();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base,
    });
    mockGetSecondAwakening.mockResolvedValue({ eligible: true, completed: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(true);
    expect(data.completed).toBe(false);
    expect(mockGetSecondAwakening).toHaveBeenCalledWith({}, "u1");
  });
});
