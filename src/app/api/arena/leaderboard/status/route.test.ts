/**
 * GET /api/arena/leaderboard/status — 401·500 (Arena §6·§7·§8).
 * 인증 실패(401)·에러 응답(500) 테스트.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("GET /api/arena/leaderboard/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with message when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(data.message).toBe("Sign in to see leaderboard");
  });

  it("returns 500 when weekly_xp query fails", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: "db error" } }),
            }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  /** SPRINT 48 TASK 9 / 254: 200 진단 본문. */
  it("returns 200 with hasWeeklyXpRow false when no weekly_xp row", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hasWeeklyXpRow).toBe(false);
    expect(data.xpTotal).toBe(0);
    expect(data.updatedAt).toBeNull();
  });

  it("returns 200 with xpTotal when weekly_xp row exists", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    xp_total: 42,
                    updated_at: "2025-03-10T08:00:00.000Z",
                  },
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
    expect(data.hasWeeklyXpRow).toBe(true);
    expect(data.xpTotal).toBe(42);
    expect(data.updatedAt).toBe("2025-03-10T08:00:00.000Z");
  });
});
