import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Host History list route — proves the AUTH GATE (401 unauthenticated, 403 non-
 * host) and that the service is owner-scoped + never touched for a non-host.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const listHostHistory = vi.fn();

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
  listHostHistory: (...args: unknown[]) => listHostHistory(...args),
}));

let GET: typeof import("./route").GET;

beforeAll(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
  hostActive.mockReset();
  listHostHistory.mockReset();
  hostActive.mockReturnValue(true);
});

function req() {
  return new NextRequest("http://localhost/api/bty/foundry/events/history", {
    method: "GET",
    headers: { origin: "https://bty-arena-staging.workers.dev" },
  });
}

describe("GET /api/bty/foundry/events/history", () => {
  it("401s an unauthenticated caller (service untouched)", async () => {
    currentUser.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(listHostHistory).not.toHaveBeenCalled();
  });

  it("403s a non-host with no event data (service untouched)", async () => {
    currentUser.mockReturnValue({ id: "user-x" });
    hostActive.mockReturnValue(false);
    const res = await GET(req());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("foundry_host_required");
    expect(json.events).toBeUndefined();
    expect(listHostHistory).not.toHaveBeenCalled();
  });

  it("returns the host's history list for an active host", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    listHostHistory.mockResolvedValue([
      { eventId: "ev-1", title: "Past", status: "closed", contentType: "youtube", createdAt: "x", endedAt: "y", participantCount: 3, completionCount: 2 },
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.events).toHaveLength(1);
    expect(json.events[0].eventId).toBe("ev-1");
    expect(listHostHistory).toHaveBeenCalledWith(expect.anything(), "owner-1");
  });
});
