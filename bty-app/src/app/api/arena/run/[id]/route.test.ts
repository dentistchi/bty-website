/**
 * GET /api/arena/run/[id] — 401·404·200 (245 C4 짝).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/arena/run/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET(new Request("http://localhost/api/arena/run/r1"), ctx("r1"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("404 when run not found", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });
    const res = await GET(new Request("http://localhost/api/arena/run/missing"), ctx("missing"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("NOT_FOUND");
  });

  it("200 with run when row exists", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    run_id: "run-245",
                    scenario_id: "sc-a",
                    locale: "en",
                    started_at: "2026-01-01T00:00:00Z",
                    status: "IN_PROGRESS",
                    difficulty: null,
                    meta: null,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    });
    const res = await GET(new Request("http://localhost/api/arena/run/run-245"), ctx("run-245"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.run.run_id).toBe("run-245");
    expect(j.run.scenario_id).toBe("sc-a");
  });
});
