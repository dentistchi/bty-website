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

  /** S87 C3 TASK9: underscore is not allowed → ONLY_ALNUM_DASH. */
  it("returns 400 INVALID_CODE_NAME when codeName has invalid characters", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(makeReq({ codeName: "bad_name" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_CODE_NAME");
    expect(data.reason).toBe("ONLY_ALNUM_DASH");
  });

  /** S94 C3 TASK9: leading/trailing hyphen → `arenaCodeNameFromUnknown` NO_EDGE_DASH. */
  it("returns 400 INVALID_CODE_NAME when codeName starts or ends with hyphen", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const resStart = await POST(makeReq({ codeName: "-abc" }));
    expect(resStart.status).toBe(400);
    const startData = await resStart.json();
    expect(startData.error).toBe("INVALID_CODE_NAME");
    expect(startData.reason).toBe("NO_EDGE_DASH");
    const resEnd = await POST(makeReq({ codeName: "abc-" }));
    expect(resEnd.status).toBe(400);
    const endData = await resEnd.json();
    expect(endData.error).toBe("INVALID_CODE_NAME");
    expect(endData.reason).toBe("NO_EDGE_DASH");
  });

  /** S85 C3 TASK9: double hyphen in code name → 400 NO_DOUBLE_DASH. */
  it("returns 400 INVALID_CODE_NAME when codeName contains --", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    const res = await POST(makeReq({ codeName: "ab--cd" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_CODE_NAME");
    expect(data.reason).toBe("NO_DOUBLE_DASH");
  });
});
