/**
 * POST /api/emotional-stats/second-awakening/complete — 401·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockGetSecondAwakening = vi.fn();
const mockCompleteSecondAwakening = vi.fn();
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: NextRequest, _base: Response) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/emotional-stats/secondAwakening", () => ({
  getSecondAwakening: (...args: unknown[]) => mockGetSecondAwakening(...args),
  completeSecondAwakening: (...args: unknown[]) => mockCompleteSecondAwakening(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/emotional-stats/second-awakening/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

describe("POST /api/emotional-stats/second-awakening/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: new Response() });

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetSecondAwakening).not.toHaveBeenCalled();
    expect(mockCompleteSecondAwakening).not.toHaveBeenCalled();
  });

  it("returns 400 when not eligible or already completed", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });
    mockGetSecondAwakening.mockResolvedValue({ eligible: false, completed: false });

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Not eligible or already completed");
    expect(mockCompleteSecondAwakening).not.toHaveBeenCalled();
  });

  it("returns 500 when completeSecondAwakening fails", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: new Response(),
    });
    mockGetSecondAwakening.mockResolvedValue({ eligible: true, completed: false });
    mockCompleteSecondAwakening.mockResolvedValue({ ok: false });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Failed to complete");
  });

  it("returns 200 with ok when eligible and completion succeeds", async () => {
    const base = new Response();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base,
    });
    mockGetSecondAwakening.mockResolvedValue({ eligible: true, completed: false });
    mockCompleteSecondAwakening.mockResolvedValue({ ok: true, starterUnlockGranted: true });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.starterUnlockGranted).toBe(true);
    expect(mockGetSecondAwakening).toHaveBeenCalledWith({}, "u1");
    expect(mockCompleteSecondAwakening).toHaveBeenCalledWith({}, "u1");
  });
});
