/**
 * GET /api/arena/membership-request — 401·200 (SPRINT 55 TASK 9 / 261 C3).
 * POST — 401·400 INVALID_JSON·MISSING_FIELDS·submitted_at_invalid (SPRINT 89 C3; **S99** optional `submitted_at`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

describe("GET /api/arena/membership-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with request null when no row", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.request).toBeNull();
  });
});

describe("POST /api/arena/membership-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_function: "IC", joined_at: "2024-01-01" }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 INVALID_JSON when body is not JSON", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not-json",
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  it("returns 400 MISSING_FIELDS when job_function or joined_at empty after trim", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_function: "  ", joined_at: "2024-01-01" }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("MISSING_FIELDS");
  });

  /** S89 C3 TASK11: joined_at must pass arenaIsoDateOnlyFromUnknown (invalid calendar). */
  it("returns 400 MISSING_FIELDS when joined_at is not a valid ISO date-only", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_function: "IC", joined_at: "2024-02-30" }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("MISSING_FIELDS");
  });

  /** S99 C3 TASK9: optional `submitted_at` — `arenaIsoTimestampFromUnknown` → 400. */
  it("returns 400 submitted_at_invalid when submitted_at is present but not parseable", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_function: "IC",
        joined_at: "2024-01-01",
        submitted_at: "not-a-timestamp",
      }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("submitted_at_invalid");
  });

  /** S107 C3 TASK9: optional `submitted_at` — non-string (≠ S99 invalid string) → 400. */
  it("returns 400 submitted_at_invalid when submitted_at is present but not a string", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_function: "IC",
        joined_at: "2024-01-01",
        submitted_at: 1735689600000,
      }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("submitted_at_invalid");
  });

  /** S118 C3 TASK9: optional `submitted_at` — boolean (≠ S107 number) → 400. */
  it("returns 400 submitted_at_invalid when submitted_at is boolean", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_function: "IC",
        joined_at: "2024-01-01",
        submitted_at: true,
      }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("submitted_at_invalid");
  });

  /** S125 C3 TASK9: optional `submitted_at` — array (≠ S118 boolean · S107 number) → 400. */
  it("returns 400 submitted_at_invalid when submitted_at is an array", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/membership-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_function: "IC",
        joined_at: "2024-01-01",
        submitted_at: ["2026-01-01T00:00:00.000Z"],
      }),
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("submitted_at_invalid");
  });
});
