/**
 * POST /api/arena/free-response — 401·400 (SPRINT 66 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("POST /api/arena/free-response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/free-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "s1",
        responseText: "hello",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/free-response", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  it("returns 400 runId_required when runId missing", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/free-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "s1", responseText: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId_required");
  });

  it("returns 400 scenarioId_required when scenarioId is whitespace-only (arenaScenarioIdFromUnknown)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/free-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "r1",
        scenarioId: "   ",
        responseText: "hello",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });

  it("returns 400 runId_required when runId contains internal whitespace (arenaRunIdFromUnknown)", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/free-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "run with-space",
        scenarioId: "s1",
        responseText: "hello",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId_required");
  });

  /** S88 C3 TASK9: scenario id over domain max → scenarioId_required. */
  it("returns 400 scenarioId_required when scenario id exceeds max length", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const { ARENA_SCENARIO_ID_MAX_LENGTH } = await import(
      "@/domain/arena/scenarios/arenaScenarioIdFromUnknown"
    );
    const req = new Request("http://localhost/api/arena/free-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "valid-run-id",
        scenarioId: "z".repeat(ARENA_SCENARIO_ID_MAX_LENGTH + 1),
        responseText: "x",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenarioId_required");
  });
});
