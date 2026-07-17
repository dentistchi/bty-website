import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const publishDraft = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => hostActive() }));
vi.mock("@/lib/bty/foundry/events/foundryPublishService", () => ({ publishDraft: (...a: unknown[]) => publishDraft(...a) }));

let POST: typeof import("./route").POST;
beforeAll(async () => {
  ({ POST } = await import("./route"));
});
beforeEach(() => {
  currentUser.mockReset();
  hostActive.mockReset();
  publishDraft.mockReset();
  hostActive.mockReturnValue(true);
});

const SNAPSHOT = {
  event: { id: "ev-1", title: "T", status: "open", join_token: "btyfr1.a.b", content_type: "youtube", created_at: "t", closed_at: null },
  participants: [],
  joined_count: 0,
  completed_count: 0,
};

function call(body: unknown = { locale: "en" }, id = "d1") {
  return {
    req: new NextRequest(`http://localhost/api/bty/foundry/modules/${id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://bty-arena-staging.workers.dev" },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

describe("POST /modules/[id]/publish", () => {
  it("401 unauthenticated (service untouched)", async () => {
    currentUser.mockReturnValue(null);
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(401);
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("403 non-host", async () => {
    currentUser.mockReturnValue({ id: "u" });
    hostActive.mockReturnValue(false);
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(403);
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("404 non-disclosing for a foreign/missing draft", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    publishDraft.mockResolvedValue({ ok: false, reason: "draft_not_found" });
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(404);
  });

  it("400 for a not-ready draft", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    publishDraft.mockResolvedValue({ ok: false, reason: "behavior_required" });
    const { req, ctx } = call();
    expect((await POST(req, ctx)).status).toBe(400);
  });

  it("200 returns join_url (token stays inside the URL) + reused flag", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    publishDraft.mockResolvedValue({ ok: true, value: { snapshot: SNAPSHOT, reused: false } });
    const { req, ctx } = call();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.event.join_url).toMatch(/^https:\/\/bty-arena-staging\.workers\.dev\/f\/btyfr1\./);
    expect(json.event.join_token).toBeUndefined();
    expect(json.reused).toBe(false);
    expect(publishDraft).toHaveBeenCalledWith(expect.anything(), "owner", "d1", "en");
  });

  it("defaults locale to ko when not 'en'", async () => {
    currentUser.mockReturnValue({ id: "owner" });
    publishDraft.mockResolvedValue({ ok: true, value: { snapshot: SNAPSHOT, reused: false } });
    const { req, ctx } = call({});
    await POST(req, ctx);
    expect(publishDraft).toHaveBeenCalledWith(expect.anything(), "owner", "d1", "ko");
  });
});
