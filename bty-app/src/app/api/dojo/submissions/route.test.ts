import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const { getSupabaseServerClient } = await import(
  "@/lib/bty/arena/supabaseServer"
);

function mockSupabase(
  user: { id: string } | null,
  selectResult: { data: unknown; error: { message: string } | null }
) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(selectResult),
  };
  vi.mocked(getSupabaseServerClient).mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user } }),
    },
    from: () => chain,
  } as never);
}

describe("GET /api/dojo/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase(null, { data: [], error: null });

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockSupabase(null, { data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 500 when select fails", async () => {
    mockSupabase({ id: "u1" }, {
      data: null,
      error: { message: "Database connection failed" },
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Database connection failed");
  });

  it("returns 200 with submissions array key", async () => {
    mockSupabase({ id: "u1" }, { data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.submissions)).toBe(true);
    expect(Object.keys(data)).toEqual(["submissions"]);
  });

  it("returns 200 with empty submissions when user has none", async () => {
    mockSupabase({ id: "u1" }, { data: [], error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("submissions");
    expect(Array.isArray(data.submissions)).toBe(true);
    expect(data.submissions).toHaveLength(0);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockSupabase({ id: "u1" }, { data: [], error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with submissions array and correct row shape", async () => {
    const rows = [
      {
        id: "sub-1",
        scores_json: { perspective_taking: 70, communication: 60, leadership: 80, conflict: 55, teamwork: 65 },
        summary_key: "high",
        created_at: "2026-03-09T10:00:00Z",
      },
      {
        id: "sub-2",
        scores_json: null,
        summary_key: "mid",
        created_at: "2026-03-08T12:00:00Z",
      },
    ];
    mockSupabase({ id: "u1" }, { data: rows, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(2);
    expect(data.submissions[0]).toMatchObject({
      id: "sub-1",
      summary_key: "high",
      created_at: "2026-03-09T10:00:00Z",
    });
    expect(data.submissions[0].scores_json).toEqual(
      expect.objectContaining({ perspective_taking: 70, teamwork: 65 })
    );
    expect(data.submissions[1].id).toBe("sub-2");
    expect(data.submissions[1].scores_json).toBeNull();
  });

  it("rejects when getSupabaseServerClient rejects", async () => {
    vi.mocked(getSupabaseServerClient).mockRejectedValue(new Error("supabase down"));

    await expect(GET()).rejects.toThrow("supabase down");
  });

  it("rejects when select chain (limit) rejects", async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => Promise.reject(new Error("connection lost")),
    };
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: () => chain,
    } as never);

    await expect(GET()).rejects.toThrow("connection lost");
  });
});
