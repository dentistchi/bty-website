import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

type PostArg = Parameters<typeof POST>[0];

function jsonReq(payload: unknown): PostArg {
  return new Request("http://localhost/api/arena/pulse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as PostArg;
}

function authedClient(mockInsert: ReturnType<typeof vi.fn>) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "u1" } } }),
    },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  };
}

beforeEach(() => {
  mockGetSupabaseServerClient.mockReset();
});

describe("POST /api/arena/pulse", () => {
  it("401 UNAUTHENTICATED when no user", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await POST(jsonReq({ pulse_value: 3 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("400 INVALID_JSON on non-JSON body", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const req = new Request("http://localhost/api/arena/pulse", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not-json",
    }) as PostArg;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_JSON" });
  });

  it("400 INVALID_PULSE_VALUE when pulse_value missing", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const res = await POST(jsonReq({ session_id: "s1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_PULSE_VALUE" });
  });

  it.each([
    ["below range", 0],
    ["above range", 6],
    ["non-integer", 3.5],
    ["non-number string", "3"],
  ])("400 INVALID_PULSE_VALUE for %s", async (_label, value) => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const res = await POST(jsonReq({ pulse_value: value }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_PULSE_VALUE" });
  });

  it("200 ok and inserts row (session_id null when absent)", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockGetSupabaseServerClient.mockResolvedValue(authedClient(mockInsert));
    const res = await POST(jsonReq({ pulse_value: 3 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "u1",
      pulse_value: 3,
      session_id: null,
    });
  });

  it("200 carries session_id when valid string", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockGetSupabaseServerClient.mockResolvedValue(authedClient(mockInsert));
    const res = await POST(jsonReq({ pulse_value: 5, session_id: "sess-1" }));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "u1",
      pulse_value: 5,
      session_id: "sess-1",
    });
  });

  it("200 coerces non-string session_id to null", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockGetSupabaseServerClient.mockResolvedValue(authedClient(mockInsert));
    const res = await POST(jsonReq({ pulse_value: 2, session_id: 123 }));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "u1",
      pulse_value: 2,
      session_id: null,
    });
  });

  it("500 on insert error", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    mockGetSupabaseServerClient.mockResolvedValue(authedClient(mockInsert));
    const res = await POST(jsonReq({ pulse_value: 4 }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});
