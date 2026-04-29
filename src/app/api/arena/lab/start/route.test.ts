/**
 * POST /api/arena/lab/start — 401 · 400 · 201.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("POST /api/arena/lab/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/lab/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "s1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 scenario_id_required when scenarioId is missing or invalid", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scenario_id_required");
  });

  it("returns 201 when scenarioId is valid", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(
      new Request("http://localhost/api/arena/lab/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: "  lab-scenario-1  " }),
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.scenarioId).toBe("lab-scenario-1");
  });
});
