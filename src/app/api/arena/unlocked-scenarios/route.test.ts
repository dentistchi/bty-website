/**
 * GET /api/arena/unlocked-scenarios — 401 (SPRINT 274 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("GET /api/arena/unlocked-scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new NextRequest("http://localhost/api/arena/unlocked-scenarios");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });
});
