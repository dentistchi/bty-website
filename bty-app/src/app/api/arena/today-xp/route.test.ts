/**
 * GET /api/arena/today-xp — 200·401·응답 body 검증 (today-growth).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("GET /api/arena/today-xp", () => {
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

  it("returns 200 with xpToday when authenticated and query succeeds", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () =>
              Promise.resolve({
                data: [{ xp: 10 }, { xp: 20 }],
                error: null,
              }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("xpToday");
    expect(typeof data.xpToday).toBe("number");
    expect(data.xpToday).toBe(30);
  });

  it("returns 200 with xpToday 0 when no rows", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.xpToday).toBe(0);
  });

  it("returns 500 when arena_events query errors", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () =>
              Promise.resolve({ data: null, error: { message: "db error" } }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db error");
  });
});
