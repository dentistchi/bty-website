/**
 * POST /api/arena/run — 401·400·500·200 (start run).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ARENA_SCENARIO_ID_MAX_LENGTH } from "@/domain/arena/scenarios";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));

function makeRequest(body: object = {}): Request {
  return new Request("http://localhost/api/arena/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const res = await POST(makeRequest({ scenarioId: "s1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await POST(makeRequest({ scenarioId: "s1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when scenarioId is missing", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("scenarioId_required");
  });

  /** S96 TASK9: boundary 400 — JSON `scenarioId: null` (`arenaScenarioIdFromUnknown` non-string). */
  it("returns 400 scenarioId_required when scenarioId is JSON null", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const res = await POST(makeRequest({ scenarioId: null }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  /** S89 TASK21: domain `arenaScenarioIdFromUnknown` — whitespace / overlong rejected like free-response. */
  it("returns 400 when scenarioId is whitespace-only", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const res = await POST(makeRequest({ scenarioId: "  \t\n  " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("returns 400 when scenarioId exceeds max length", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const res = await POST(makeRequest({ scenarioId: "x".repeat(ARENA_SCENARIO_ID_MAX_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("persists trimmed scenario_id via insert row", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { run_id: "r1", scenario_id: "trimmed-id", started_at: "2026-03-01T00:00:00Z", status: "started" },
      error: null,
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    });

    const res = await POST(makeRequest({ scenarioId: "  trimmed-id  " }));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ scenario_id: "trimmed-id" }),
    );
  });

  /** C6 245: 시나리오 시작 401→400 스모크. */
  it("245 smoke: unauthenticated 401 then missing scenarioId 400", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    expect((await POST(makeRequest({ scenarioId: "s" }))).status).toBe(401);

    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u245" } } }) },
    });
    const r400 = await POST(makeRequest({}));
    expect(r400.status).toBe(400);
    expect((await r400.json()).error).toBe("scenarioId_required");
  });

  it("returns 200 with content-type application/json", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { run_id: "r1", scenario_id: "s1", started_at: "2026-03-01T00:00:00Z", status: "started" },
      error: null,
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    });
    const res = await POST(makeRequest({ scenarioId: "s1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with run object when authenticated and scenarioId provided", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { run_id: "r1", scenario_id: "s1", started_at: "2026-03-01T00:00:00Z", status: "started" },
      error: null,
    });
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    });

    const res = await POST(makeRequest({ scenarioId: "s1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["run"]);
    expect(data.run).toHaveProperty("run_id");
    expect(data.run).toHaveProperty("scenario_id");
    expect(data.run).toHaveProperty("started_at");
    expect(data.run).toHaveProperty("status");
  });
});
