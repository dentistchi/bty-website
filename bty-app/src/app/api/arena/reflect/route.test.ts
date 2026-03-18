/**
 * POST /api/arena/reflect — 401·400 (C4 @contract 정합; C6 238 짝).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const { getSupabaseServerClient } = await import("@/lib/bty/arena/supabaseServer");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/arena/reflect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/arena/reflect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    } as never);

    const res = await POST(makeRequest({ userText: "hello reflection" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 for invalid JSON when authenticated", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      }),
    } as never);

    const bad = new Request("http://localhost/api/arena/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
  });

  it("returns 400 when userText missing or whitespace-only", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const r1 = await POST(makeRequest({}));
    expect(r1.status).toBe(400);
    expect((await r1.json()).error).toBe("userText is required");

    const r2 = await POST(makeRequest({ userText: "   " }));
    expect(r2.status).toBe(400);
  });

  it("returns 413 when userText exceeds max length", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const { REFLECT_USER_TEXT_MAX_CHARS } = await import("@/lib/bty/arena/reflectLimits");
    const huge = "a".repeat(REFLECT_USER_TEXT_MAX_CHARS + 1);
    const res = await POST(makeRequest({ userText: huge }));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("USER_TEXT_TOO_LARGE");
  });

  /** C6 249: 401 짝 + 413 USER_TEXT_TOO_LARGE. */
  it("249: returns 401 then 413 when userText exceeds max after session", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValueOnce({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as never);
    expect((await POST(makeRequest({ userText: "ok" }))).status).toBe(401);

    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);
    const { REFLECT_USER_TEXT_MAX_CHARS } = await import("@/lib/bty/arena/reflectLimits");
    const res = await POST(makeRequest({ userText: "x".repeat(REFLECT_USER_TEXT_MAX_CHARS + 1) }));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("USER_TEXT_TOO_LARGE");
  });
});
