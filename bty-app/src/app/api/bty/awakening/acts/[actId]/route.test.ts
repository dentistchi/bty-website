/**
 * GET /api/bty/awakening/acts/[actId] — 401·404·200.
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

describe("GET /api/bty/awakening/acts/[actId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, base: {} });
  });

  it("401 unauthenticated", async () => {
    const res = await GET(new NextRequest("http://x"), { params: Promise.resolve({ actId: "1" }) });
    expect(res.status).toBe(401);
  });

  it("404 for invalid actId", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, base: {} });
    const res = await GET(new NextRequest("http://x"), { params: Promise.resolve({ actId: "99" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("ACT_NOT_FOUND");
  });

  /** C6 249: GET second-awakening act meta — 비숫자 slug → 404 ACT_NOT_FOUND. */
  it("249: 404 for non-numeric actId (second-awakening acts)", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, base: {} });
    const res = await GET(new NextRequest("http://x"), { params: Promise.resolve({ actId: "nan" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("ACT_NOT_FOUND");
  });

  it("200 for act 1", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, base: {} });
    const res = await GET(new NextRequest("http://x"), { params: Promise.resolve({ actId: "1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.actId).toBe(1);
    expect(typeof data.name).toBe("string");
  });
});
