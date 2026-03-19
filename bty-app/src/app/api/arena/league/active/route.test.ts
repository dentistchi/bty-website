/**
 * GET /api/arena/league/active — 401·503·200 (SPRINT 64 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();
const mockGetActiveLeague = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

vi.mock("@/lib/bty/arena/activeLeague", () => ({
  getActiveLeague: (...args: unknown[]) => mockGetActiveLeague(...args),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({})),
}));

describe("GET /api/arena/league/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 503 when active league is unavailable", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    mockGetActiveLeague.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("ACTIVE_LEAGUE_UNAVAILABLE");
  });

  it("returns 200 with league_id, start_at, end_at, name when authenticated and league exists", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    mockGetActiveLeague.mockResolvedValue({
      league_id: "league-1",
      start_at: "2026-01-01T00:00:00Z",
      end_at: "2026-01-31T23:59:59Z",
      name: "January 2026",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.league_id).toBe("league-1");
    expect(data.start_at).toBe("2026-01-01T00:00:00Z");
    expect(data.end_at).toBe("2026-01-31T23:59:59Z");
    expect(data.name).toBe("January 2026");
  });

  it("returns 200 with name null when league has no name", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    mockGetActiveLeague.mockResolvedValue({
      league_id: "league-2",
      start_at: "2026-02-01T00:00:00Z",
      end_at: "2026-02-28T23:59:59Z",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBeNull();
  });
});
