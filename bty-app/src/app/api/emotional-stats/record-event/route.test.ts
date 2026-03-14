/**
 * POST /api/emotional-stats/record-event — 401·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockUnauthenticated = vi.fn();
const mockRecordEmotionalEventServer = vi.fn();
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: (...args: unknown[]) => mockUnauthenticated(...args),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/emotional-stats/recordEmotionalEventServer", () => ({
  recordEmotionalEventServer: (...args: unknown[]) => mockRecordEmotionalEventServer(...args),
}));

function makeRequest(body: { event_id?: string; session_id?: string }): NextRequest {
  return new NextRequest("http://localhost/api/emotional-stats/record-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/emotional-stats/record-event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnauthenticated.mockImplementation((_req: NextRequest, _base: Response) =>
      new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: new Response() });

    const res = await POST(makeRequest({ event_id: "FEELING_LABELED" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockRecordEmotionalEventServer).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });
    const req = new NextRequest("http://localhost/api/emotional-stats/record-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
    expect(mockRecordEmotionalEventServer).not.toHaveBeenCalled();
  });

  it("returns 400 when event_id is missing or invalid", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });

    const res = await POST(makeRequest({ event_id: "INVALID_EVENT" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing or invalid event_id");
    expect(mockRecordEmotionalEventServer).not.toHaveBeenCalled();
  });

  it("returns 500 when recordEmotionalEventServer fails", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });
    mockRecordEmotionalEventServer.mockResolvedValue({ ok: false });

    const res = await POST(makeRequest({ event_id: "FEELING_LABELED" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to record event");
  });

  it("returns 200 with ok when authenticated and event recorded", async () => {
    const base = new Response();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base,
    });
    mockRecordEmotionalEventServer.mockResolvedValue({ ok: true });

    const res = await POST(makeRequest({ event_id: "FEELING_LABELED" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockRecordEmotionalEventServer).toHaveBeenCalledWith({}, "u1", "FEELING_LABELED", null);
  });

  it("rejects when recordEmotionalEventServer throws", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });
    mockRecordEmotionalEventServer.mockRejectedValue(new Error("db error"));

    await expect(POST(makeRequest({ event_id: "FEELING_LABELED" }))).rejects.toThrow("db error");
  });
});
