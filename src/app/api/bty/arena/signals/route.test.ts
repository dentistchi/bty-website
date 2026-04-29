/**
 * POST /api/bty/arena/signals — 401·400 (S83 TASK9 / Arena app/api).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockCreateSupabaseRouteClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseRouteClient: () => mockCreateSupabaseRouteClient(),
}));

describe("POST /api/bty/arena/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreateSupabaseRouteClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/bty/arena/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: "s1",
        primaryChoice: "A",
        reinforcementChoice: "X",
        traits: {},
        meta: { relationalBias: 0, operationalBias: 0, emotionalRegulation: 0 },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when JSON body is not an object", async () => {
    mockCreateSupabaseRouteClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/bty/arena/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
  });

  it("returns 400 when scenarioId, primaryChoice, or reinforcementChoice missing", async () => {
    mockCreateSupabaseRouteClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/bty/arena/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        traits: {},
        meta: { relationalBias: 0, operationalBias: 0, emotionalRegulation: 0 },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/);
  });
});
