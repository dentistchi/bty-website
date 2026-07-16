import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Host History detail route — auth gate + non-disclosing 404 for a foreign/active
 * event id (the service returns null for anything not owned-and-terminal).
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const getHostHistoryDetail = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: async () => hostActive(),
}));
vi.mock("@/lib/bty/foundry/events/foundryHostHistoryService", () => ({
  getHostHistoryDetail: (...args: unknown[]) => getHostHistoryDetail(...args),
}));

let GET: typeof import("./route").GET;

beforeAll(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
  hostActive.mockReset();
  getHostHistoryDetail.mockReset();
  hostActive.mockReturnValue(true);
});

function req(eventId = "ev-1") {
  return {
    request: new NextRequest(`http://localhost/api/bty/foundry/events/history/${eventId}`, {
      method: "GET",
      headers: { origin: "https://bty-arena-staging.workers.dev" },
    }),
    ctx: { params: Promise.resolve({ eventId }) },
  };
}

describe("GET /api/bty/foundry/events/history/[eventId]", () => {
  it("401s an unauthenticated caller (service untouched)", async () => {
    currentUser.mockReturnValue(null);
    const { request, ctx } = req();
    const res = await GET(request, ctx);
    expect(res.status).toBe(401);
    expect(getHostHistoryDetail).not.toHaveBeenCalled();
  });

  it("403s a non-host (service untouched)", async () => {
    currentUser.mockReturnValue({ id: "user-x" });
    hostActive.mockReturnValue(false);
    const { request, ctx } = req();
    const res = await GET(request, ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("foundry_host_required");
    expect(getHostHistoryDetail).not.toHaveBeenCalled();
  });

  it("404s (non-disclosing) when the service returns null (foreign/active/unknown id)", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    getHostHistoryDetail.mockResolvedValue(null);
    const { request, ctx } = req("someone-elses-event");
    const res = await GET(request, ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("returns the read-only detail for an owned terminal event", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    getHostHistoryDetail.mockResolvedValue({
      eventId: "ev-1",
      title: "Past Training",
      status: "closed",
      contentType: "youtube",
      createdAt: "a",
      endedAt: "b",
      participantCount: 2,
      completionCount: 1,
      material: { kind: "youtube", videoId: "v", title: null, completionPrompt: "q" },
      participants: [{ id: "p1", displayName: "Alice", joinedAt: "c", status: "complete" }],
    });
    const { request, ctx } = req("ev-1");
    const res = await GET(request, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.event.eventId).toBe("ev-1");
    expect(json.event.participants[0].displayName).toBe("Alice");
    // no reflection / token leakage in the contract shape
    expect(JSON.stringify(json)).not.toContain("response_text");
    expect(JSON.stringify(json)).not.toContain("join_token");
    expect(getHostHistoryDetail).toHaveBeenCalledWith(expect.anything(), "owner-1", "ev-1");
  });
});
