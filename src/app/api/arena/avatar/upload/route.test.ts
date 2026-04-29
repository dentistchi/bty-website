/**
 * POST /api/arena/avatar/upload — 401·400 (SPRINT 71 TASK 9 / C3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

describe("POST /api/arena/avatar/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const req = new NextRequest("http://localhost/api/arena/avatar/upload", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when no file in form", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/arena/avatar/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("NO_FILE");
  });
});
