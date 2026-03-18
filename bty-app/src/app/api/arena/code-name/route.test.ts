/**
 * POST /api/arena/code-name — 401·400 (SPRINT 50 TASK 9 / 256 C3).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

function makeReq(body: object): NextRequest {
  return new NextRequest("http://localhost/api/arena/code-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/code-name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await POST(makeReq({ codeName: "Valid-Name" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 INVALID_CODE_NAME when codeName shorter than 3 chars", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(makeReq({ codeName: "ab" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_CODE_NAME");
    expect(data.reason).toBe("LENGTH_3_TO_20");
  });
});
