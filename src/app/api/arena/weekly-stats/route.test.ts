/**
 * GET /api/arena/weekly-stats — 401·200 (SPRINT 56 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("GET /api/arena/weekly-stats", () => {
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

  it("returns 200 with zeros when user has no weekly activity", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u-weekly" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "arena_events") {
          return {
            select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                      gte: vi.fn().mockResolvedValue({
                        count: 0,
                        error: null,
                      }),
                    }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              };
            }),
          };
        }
        if (table === "arena_weekly_quest_claims") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reflectionCount).toBe(0);
    expect(typeof data.reflectionTarget).toBe("number");
    expect(data.reflectionQuestClaimed).toBe(false);
    expect(data.weekStartISO).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(data.weekMaxDailyXp).toBe(0);
  });
});
