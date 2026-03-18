/**
 * GET /api/arena/weekly-xp — 401·200 (SPRINT 53 TASK 9 / 259 C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockGetActiveLeague = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

vi.mock("@/lib/bty/arena/activeLeague", () => ({
  getActiveLeague: (...args: unknown[]) => mockGetActiveLeague(...args),
}));

describe("GET /api/arena/weekly-xp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue({});
    mockGetActiveLeague.mockResolvedValue(null);
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

  it("returns 200 with xpTotal when no league row", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              maybeSingle: () =>
                Promise.resolve({
                  data: { xp_total: 77, updated_at: "2025-06-01T12:00:00.000Z" },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.xpTotal).toBe(77);
    expect(data.updatedAt).toBe("2025-06-01T12:00:00.000Z");
    expect(data.season).toBeNull();
    expect(typeof data.weekStartISO).toBe("string");
    expect(typeof data.weekEndISO).toBe("string");
  });
});
