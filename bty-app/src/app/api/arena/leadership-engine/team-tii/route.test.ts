/**
 * GET /api/arena/leadership-engine/team-tii — membership + snapshot.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetTeamTIISnapshot = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/engine/integrity/tii-calculator.service", () => ({
  getTeamTIISnapshot: (...args: unknown[]) => mockGetTeamTIISnapshot(...args),
}));

function makeRequest(teamId?: string): NextRequest {
  const u = teamId
    ? `http://localhost/api/arena/leadership-engine/team-tii?teamId=${encodeURIComponent(teamId)}`
    : "http://localhost/api/arena/leadership-engine/team-tii";
  return new NextRequest(u);
}

function membershipSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === "exact") {
          return {
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          };
        }
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { league_id: "L1" }, error: null }),
            })),
          })),
        };
      }),
    })),
  };
}

describe("GET /api/arena/leadership-engine/team-tii", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest("L1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when teamId missing", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const res = await GET(new NextRequest("http://localhost/api/arena/leadership-engine/team-tii"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("MISSING_TEAM_ID");
  });

  it("returns 403 when not a league member", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });
    const res = await GET(makeRequest("L1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with metrics and member_count when member and snapshot exists", async () => {
    const supabase = membershipSupabase();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });
    mockGetTeamTIISnapshot.mockResolvedValue({
      tii: 0.82,
      avg_air: 0.85,
      avg_mwd: 0.2,
      tsp: 4,
      calculated_at: "2026-03-20T12:00:00.000Z",
    });

    const res = await GET(makeRequest("L1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tii).toBe(0.82);
    expect(data.member_count).toBe(5);
    expect(data.last_calculated_at).toBe("2026-03-20T12:00:00.000Z");
  });

  it("returns 200 with nulls when no snapshot row", async () => {
    const supabase = membershipSupabase();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });
    mockGetTeamTIISnapshot.mockResolvedValue(null);

    const res = await GET(makeRequest("L1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tii).toBeNull();
    expect(data.last_calculated_at).toBeNull();
    expect(data.member_count).toBe(5);
  });

  it("returns 503 when admin client missing for snapshot", async () => {
    const supabase = membershipSupabase();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });
    mockGetTeamTIISnapshot.mockRejectedValue(
      new Error("getTeamTIISnapshot: Supabase service role not configured")
    );

    const res = await GET(makeRequest("L1"));
    expect(res.status).toBe(503);
  });
});
