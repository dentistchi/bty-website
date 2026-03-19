/**
 * GET /api/arena/lab/usage — 401·200 (SPRINT 60 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLabAttemptsUsed } from "@/lib/bty/arena/labUsage";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

vi.mock("@/lib/bty/arena/labUsage", () => ({
  getLabAttemptsUsed: vi.fn(),
}));

describe("GET /api/arena/lab/usage", () => {
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

  it("returns 200 with usage fields when authenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u-lab" } } }),
      },
    });
    vi.mocked(getLabAttemptsUsed).mockResolvedValue(2);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.limit).toBe("number");
    expect(data.attemptsUsed).toBe(2);
    expect(data.attemptsRemaining).toBe(
      Math.max(0, data.limit - data.attemptsUsed)
    );
    expect(getLabAttemptsUsed).toHaveBeenCalledWith(
      expect.anything(),
      "u-lab"
    );
  });
});
