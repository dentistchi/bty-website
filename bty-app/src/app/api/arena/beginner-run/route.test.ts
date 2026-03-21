/**
 * POST /api/arena/beginner-run — 401·400 (SPRINT 65 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ARENA_SCENARIO_ID_MAX_LENGTH } from "@/domain/arena/scenarios";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("POST /api/arena/beginner-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "sc-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when scenarioId is missing", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("returns 400 when scenarioId is empty string", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  /** S90 TASK9: domain `arenaScenarioIdFromUnknown` — align with `POST /api/arena/run`. */
  it("returns 400 when scenarioId is whitespace-only", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "  \n\t  " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("returns 400 when scenarioId exceeds max length", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "z".repeat(ARENA_SCENARIO_ID_MAX_LENGTH + 1) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("inserts trimmed scenario_id", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { run_id: "r1", scenario_id: "b-sc", started_at: "t", status: "IN_PROGRESS" },
      error: null,
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });
    const req = new Request("http://localhost/api/arena/beginner-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "  b-sc  " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ scenario_id: "b-sc" }),
    );
  });
});
