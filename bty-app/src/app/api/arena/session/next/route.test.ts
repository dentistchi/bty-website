/**
 * GET /api/arena/session/next — pending action contract gate (409) + selection.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetNextScenarioForSession = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/engine/integration/scenario-type-router", () => ({
  getNextScenarioForSession: (...args: unknown[]) => mockGetNextScenarioForSession(...args),
}));

function makeSupabaseForContracts(pendingRow: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: pendingRow, error: null });
  const lte = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    lte,
  };
  updateChain.eq.mockReturnValue(updateChain);
  const update = vi.fn().mockReturnValue(updateChain);

  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const gt = vi.fn().mockReturnValue({ order });
  const eq2 = vi.fn().mockReturnValue({ gt });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });

  const from = vi.fn((table: string) => {
    if (table === "bty_action_contracts") {
      return { select, update };
    }
    return { select };
  });

  return { from, maybeSingle, lte, update };
}

describe("GET /api/arena/session/next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 409 action_contract_pending when pending contract deadline > now", async () => {
    const pending = {
      id: "c1",
      action_text: "Do the thing",
      deadline_at: new Date(Date.now() + 60_000).toISOString(),
      verification_type: "honor",
      created_at: new Date().toISOString(),
    };
    const { from } = makeSupabaseForContracts(pending);
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("action_contract_pending");
    expect(data.contract).toEqual({
      id: pending.id,
      action_text: pending.action_text,
      deadline_at: pending.deadline_at,
      verification_type: pending.verification_type,
      created_at: pending.created_at,
    });
    expect(mockGetNextScenarioForSession).not.toHaveBeenCalled();
  });

  it("inline-expires overdue pending and proceeds to getNextScenarioForSession when no row matches .gt(deadline)", async () => {
    const { from, lte } = makeSupabaseForContracts(null);
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith("u1", "en");
    expect(lte).toHaveBeenCalled();
  });

  it("proceeds normally when no pending contract", async () => {
    const { from } = makeSupabaseForContracts(null);
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith("u1", "en");
  });
});
