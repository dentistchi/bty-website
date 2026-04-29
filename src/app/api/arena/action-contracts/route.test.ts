import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockUnauthenticated = vi.fn();
const mockCopyCookiesAndDebug = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: (...args: unknown[]) => mockUnauthenticated(...args),
  copyCookiesAndDebug: (...args: unknown[]) => mockCopyCookiesAndDebug(...args),
}));

function makeRequest(body: string, contentType = "application/json"): NextRequest {
  return new NextRequest("http://localhost/api/arena/action-contracts", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

function validPayload() {
  return {
    scenario_id: "scn_01",
    db_scenario_id: "db_scn_01",
    selected_primary: "primary_a",
    selected_tradeoff: "tradeoff_b",
    selected_action_decision: "action_c",
    path: "core_01/path",
    action_label: "Commit now",
    who: "Dr. Kim",
    what: "Call patient and explain.",
    when: "Tomorrow 9am",
    evidence: "Call log",
  };
}

describe("POST /api/arena/action-contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnauthenticated.mockReturnValue(
      new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
    );
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest(JSON.stringify(validPayload())));
    expect(res.status).toBe(401);
    expect(mockUnauthenticated).toHaveBeenCalledOnce();
  });

  it("returns 400 on invalid json", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase: {}, base: {} });
    const res = await POST(makeRequest("{", "application/json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_JSON" });
  });

  it("returns 400 on missing required fields", async () => {
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase: {}, base: {} });
    const res = await POST(makeRequest(JSON.stringify({ scenario_id: "scn_01" })));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_BODY");
    expect(data.fieldErrors).toBeTruthy();
  });

  it("returns 200 with id/status on successful insert", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "contract-1", status: "pending" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });

    const body = validPayload();
    const res = await POST(makeRequest(JSON.stringify(body)));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "contract-1", status: "pending" });
    expect(from).toHaveBeenCalledWith("bty_action_contracts");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "u1",
      contract_description: body.what,
      deadline_at: expect.any(String),
      verification_mode: "hybrid",
      status: "pending",
      required: true,
      details: body,
      source: "json_dev_runtime",
    }));
    expect(select).toHaveBeenCalledWith("id,status");
    expect(single).toHaveBeenCalledOnce();
  });
});
