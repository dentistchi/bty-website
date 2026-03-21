/**
 * POST /api/arena/beginner-complete — 401·400 (SPRINT 51 TASK 9 / 257 C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ARENA_SCENARIO_ID_MAX_LENGTH } from "@/domain/arena/scenarios";
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

  it("returns 400 runId_required when runId missing", async () => {
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
    expect((await res.json()).error).toBe("runId_required");
  });

  /** S92 TASK9: domain `arenaRunIdFromUnknown` / `arenaScenarioIdFromUnknown`. */
  it("returns 400 scenarioId_required when scenarioId missing but runId present", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/beginner-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "550e8400-e29b-41d4-a716-446655440000" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("returns 400 runId_required when runId contains whitespace", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/beginner-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "bad id",
          scenarioId: "s1",
        }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId_required");
  });

  it("returns 400 scenarioId_required when scenarioId is whitespace-only", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/beginner-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "550e8400-e29b-41d4-a716-446655440000",
          scenarioId: "  \t\n  ",
        }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("returns 400 scenarioId_required when scenarioId exceeds max length", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/beginner-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "550e8400-e29b-41d4-a716-446655440000",
          scenarioId: "z".repeat(ARENA_SCENARIO_ID_MAX_LENGTH + 1),
        }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });
});
