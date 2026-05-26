/**
 * POST /api/arena/quick/start — auth + S2 membership gate + quick scenario select.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockSelectAndRecordQuickScenario = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(
    () => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

const mockRequireApprovedMembership = vi.fn();
vi.mock("@/lib/bty/arena/requireApprovedMembership", () => ({
  requireApprovedMembership: (...args: unknown[]) => mockRequireApprovedMembership(...args),
}));

vi.mock("@/lib/bty/arena/quickModeService", () => ({
  selectAndRecordQuickScenario: (...args: unknown[]) => mockSelectAndRecordQuickScenario(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/quick/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "en" }),
  });
}

describe("POST /api/arena/quick/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApprovedMembership.mockResolvedValue({ approved: true });
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    mockSelectAndRecordQuickScenario.mockResolvedValue({
      ok: true,
      scenario: { scenarioId: "qs1", title: "T", context: "C", choices: [] },
      intentId: "intent-1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 MEMBERSHIP_REQUIRED when membership is not approved", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase: {}, base: {} });
    mockRequireApprovedMembership.mockResolvedValue({
      approved: false,
      status: 403,
      error: "MEMBERSHIP_REQUIRED",
      reason: "no_request",
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("MEMBERSHIP_REQUIRED");
    expect(mockSelectAndRecordQuickScenario).not.toHaveBeenCalled();
  });

  it("returns 200 with scenario when authenticated and membership approved", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase: {}, base: {} });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.scenario?.scenarioId).toBe("qs1");
    expect(data.intentId).toBe("intent-1");
    expect(mockSelectAndRecordQuickScenario).toHaveBeenCalledWith({}, "u1", "en");
  });
});
