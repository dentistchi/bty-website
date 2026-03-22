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

  it("returns 200 when levelId S1 is accepted via domain whitelist (skips tenure inference)", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const res = await POST(
      makeRequest({ userText: "short reflection text", levelId: "S1" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.summary).toBe("string");
    expect(Array.isArray(data.questions)).toBe(true);
  });

  /**
   * S143 C3 TASK9: `levelId` 키 존재 + **비문자(number)** → **400** `levelId_invalid` (**S132** 비화이트리스트 문자열·**free-response** `previewScenario` 라인과 구분).
   */
  it("returns 400 levelId_invalid when levelId is present but not a string", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const res = await POST(
      makeRequest({ userText: "short reflection text", levelId: 1 }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("levelId_invalid");
  });

  /**
   * S152 C3 TASK9: `levelId` **bigint** (JSON 본문 불가 → `req.json` 스텁) → **400** `levelId_invalid` (**S151** beginner-complete·beginner-event와 구분).
   */
  it("returns 400 levelId_invalid when levelId is bigint", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const req = new Request("http://localhost/api/arena/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    vi.spyOn(req, "json").mockResolvedValue({
      userText: "short reflection text",
      levelId: BigInt(1),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("levelId_invalid");
  });

  /** S132 C3 TASK9: `levelId` present but not whitelist — **400** (`S131` sub-name·`S130` code-name 라인과 구분). */
  it("returns 400 levelId_invalid when levelId key is present but not a valid reflect level id", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const res = await POST(
      makeRequest({ userText: "short reflection text", levelId: "S99" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("levelId_invalid");
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

  /** S104 TASK9: explicit empty string → 400 (boundary). */
  it("returns 400 userText is required when userText is empty string", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const res = await POST(makeRequest({ userText: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("userText is required");
  });

  /** S95 TASK9: boundary 400 — JSON `userText: null` coerces to empty via `??`. */
  it("returns 400 userText is required when userText is JSON null", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1", created_at: new Date().toISOString() } } }),
      },
    } as never);

    const res = await POST(makeRequest({ userText: null }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("userText is required");
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
