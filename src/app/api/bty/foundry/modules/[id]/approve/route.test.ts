import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const approveDraft = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => hostActive() }));
vi.mock("@/lib/bty/foundry/events/foundryModuleService", () => ({ approveDraft: (...a: unknown[]) => approveDraft(...a) }));
vi.mock("@/lib/bty/foundry/events/moduleClient", () => ({ toClientDraft: (d: unknown) => d }));

let POST: typeof import("./route").POST;
beforeAll(async () => {
  ({ POST } = await import("./route"));
});
beforeEach(() => {
  currentUser.mockReset();
  hostActive.mockReset();
  approveDraft.mockReset();
  hostActive.mockReturnValue(true);
});

function call(id = "d1") {
  return {
    req: new NextRequest(`http://localhost/api/bty/foundry/modules/${id}/approve`, { method: "POST", headers: { origin: "https://x.dev" } }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

describe("POST /modules/[id]/approve", () => {
  it("401 unauthenticated (service untouched)", async () => {
    currentUser.mockReturnValue(null);
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(401);
    expect(approveDraft).not.toHaveBeenCalled();
  });

  it("403 non-host", async () => {
    currentUser.mockReturnValue({ id: "u" });
    hostActive.mockReturnValue(false);
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(403);
    expect(approveDraft).not.toHaveBeenCalled();
  });

  it("400 with the failing reason for an incomplete draft", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    approveDraft.mockResolvedValue({ ok: false, reason: "behavior_required" });
    const { req, ctx } = call();
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("behavior_required");
  });

  it("409 for a non-draft row", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    approveDraft.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(409);
  });

  it("200 with the approved draft", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    approveDraft.mockResolvedValue({ ok: true, value: { id: "d1", status: "approved" } });
    const { req, ctx } = call();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).draft.status).toBe("approved");
  });
});
