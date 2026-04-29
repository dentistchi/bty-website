/**
 * GET /api/bty/awakening/acts — 401·200.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
  copyCookiesAndDebug: vi.fn(),
}));

describe("GET /api/bty/awakening/acts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
  });

  it("401", async () => {
    const res = await GET(new NextRequest("http://x"));
    expect(res.status).toBe(401);
  });

  it("200 three acts", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, base: {} });
    const res = await GET(new NextRequest("http://x"));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.acts).toHaveLength(3);
    expect(d.acts[0].actId).toBe(1);
    expect(typeof d.acts[0].name).toBe("string");
  });
});
