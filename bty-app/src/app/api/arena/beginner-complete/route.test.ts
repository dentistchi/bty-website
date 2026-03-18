/**
 * POST /api/arena/beginner-complete — 401·400 (SPRINT 51 TASK 9 / 257 C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("POST /api/arena/beginner-complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/beginner-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "550e8400-e29b-41d4-a716-446655440000",
          scenarioId: "x",
        }),
      })
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when runId or scenarioId missing", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/beginner-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("runId and scenarioId required");
  });
});
