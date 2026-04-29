import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET, POST } from "./route";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

const mockUser = { id: "user-1", email: "u@test.com" };

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/bty/arena/eliteStatus", () => ({
  getIsEliteTop5: vi.fn(),
}));

const { getSupabaseServerClient } = await import("@/lib/bty/arena/supabaseServer");
const { getIsEliteTop5 } = await import("@/lib/bty/arena/eliteStatus");

function mockSupabase(overrides: {
  user?: { id: string; email?: string } | null;
  existingPending?: boolean;
  insert?: { id: string; created_at: string };
} = {}) {
  const { user = mockUser, existingPending = false, insert } = overrides;
  (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: existingPending ? { status: "pending" } : null }) }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve(insert ? { data: { id: insert.id, created_at: insert.created_at }, error: null } : { data: null, error: new Error("insert failed") }),
        }),
      }),
    }),
  });
}

function mockSupabaseForGet(overrides: { user?: { id: string } | null; rows?: unknown[] } = {}) {
  const { user = mockUser, rows = [] } = overrides;
  (getSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: rows }),
          }),
        }),
      }),
    }),
  });
}

describe("GET /api/me/mentor-request", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSupabaseForGet({ user: null });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns request null when no request exists", async () => {
    mockSupabaseForGet({ rows: [] });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.request).toBeNull();
  });

  it("returns 200 with request when authenticated and request exists", async () => {
    const row = {
      id: "req-1",
      user_id: "user-1",
      status: "pending",
      message: "Help me",
      mentor_id: "mentor-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      responded_at: null,
      responded_by: null,
    };
    mockSupabaseForGet({ rows: [row] });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.request).not.toBeNull();
    expect(data.request.id).toBe("req-1");
    expect(data.request.status).toBe("pending");
    expect(data.request.mentorId).toBe("mentor-1");
  });
});

describe("POST /api/me/mentor-request", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }) as NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 403 ELITE_ONLY when not elite", async () => {
    vi.mocked(getIsEliteTop5).mockResolvedValue(false);
    mockSupabase({ user: mockUser, existingPending: false });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }) as NextRequest);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("ELITE_ONLY");
  });

  it("returns 201 with id, status, createdAt when elite and insert succeeds", async () => {
    vi.mocked(getIsEliteTop5).mockResolvedValue(true);
    mockSupabase({
      user: mockUser,
      existingPending: false,
      insert: { id: "req-new-1", created_at: "2026-03-13T12:00:00Z" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "I need help" }),
      }) as NextRequest
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("req-new-1");
    expect(data.status).toBe("pending");
    expect(data.createdAt).toBe("2026-03-13T12:00:00Z");
  });
});
