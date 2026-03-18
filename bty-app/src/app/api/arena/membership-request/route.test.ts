/**
 * GET /api/arena/membership-request — 401·200 (SPRINT 55 TASK 9 / 261 C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("GET /api/arena/membership-request", () => {
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

  it("returns 200 with request null when no row", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.request).toBeNull();
  });
});
