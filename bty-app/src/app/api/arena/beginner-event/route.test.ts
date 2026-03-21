/**
 * POST /api/arena/beginner-event — 401·400 (SPRINT 67 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("POST /api/arena/beginner-event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "r1", step: 2 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when runId missing or step not 2–5", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: 3 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId and step 2-5 required");
  });

  /** S87 C3 TASK9: runId with internal whitespace — arenaRunIdFromUnknown rejects. */
  it("returns 400 when runId contains whitespace", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "run with space", step: 2 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId and step 2-5 required");
  });

  /**
   * S150 C3 TASK9: `step` **bigint** (≠ **S149** `beginner-run` `scenarioId`).
   * JSON은 bigint를 담지 못해 `req.json()` 스텁; `Number(BigInt(6))===6` → `isValidBeginnerEventStep` false.
   */
  it("returns 400 runId and step 2-5 required when step is bigint", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/beginner-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    vi.spyOn(req, "json").mockResolvedValue({ runId: "r1", step: BigInt(6) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("runId and step 2-5 required");
  });
});
