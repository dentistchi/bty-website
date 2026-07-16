import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Module draft collection route — proves the AUTH GATE, host requirement, the
 * client-facing shape (no owner_user_id, no asset value), and delegation to the
 * Slice-1 service (mocked here).
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const createDraft = vi.fn();
const listOwnerDrafts = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: async () => hostActive(),
}));
vi.mock("@/lib/bty/foundry/events/foundryModuleService", () => ({
  createDraft: (...a: unknown[]) => createDraft(...a),
  listOwnerDrafts: (...a: unknown[]) => listOwnerDrafts(...a),
}));

let POST: typeof import("./route").POST;
let GET: typeof import("./route").GET;

beforeAll(async () => {
  ({ POST, GET } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
  createDraft.mockReset();
  listOwnerDrafts.mockReset();
  hostActive.mockReset();
  hostActive.mockReturnValue(true);
});

function req(method: "POST" | "GET") {
  return new NextRequest("http://localhost/api/bty/foundry/modules", {
    method,
    headers: { "content-type": "application/json", origin: "https://bty-arena-staging.workers.dev" },
  });
}

const ROW = {
  id: "d-1",
  owner_user_id: "owner-1",
  status: "draft",
  current_step: 1,
  answers: { problem: "x" },
  module_version: 1,
  parent_module_id: null,
  document_asset_ref: "owner-1/secret.pdf",
  approved_at: null,
  published_at: null,
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
};

describe("POST /api/bty/foundry/modules", () => {
  it("401s an unauthenticated caller before touching the service", async () => {
    currentUser.mockReturnValue(null);
    const res = await POST(req("POST"));
    expect(res.status).toBe(401);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("403s an authenticated non-host", async () => {
    currentUser.mockReturnValue({ id: "u" });
    hostActive.mockReturnValue(false);
    const res = await POST(req("POST"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("foundry_host_required");
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("creates a draft and returns the client shape (no owner id, no asset value)", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    createDraft.mockResolvedValue({ ok: true, value: ROW });
    const res = await POST(req("POST"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.draft.id).toBe("d-1");
    expect(json.draft.owner_user_id).toBeUndefined();
    expect(json.draft.document_asset_ref).toBeUndefined();
    expect(json.draft.document_asset_ref_present).toBe(true);
  });
});

describe("GET /api/bty/foundry/modules", () => {
  it("401s an unauthenticated caller", async () => {
    currentUser.mockReturnValue(null);
    expect((await GET(req("GET"))).status).toBe(401);
  });

  it("lists only the caller's own draft summaries (no owner id leaked)", async () => {
    currentUser.mockReturnValue({ id: "owner-1" });
    listOwnerDrafts.mockResolvedValue([
      { id: "d-1", status: "draft", current_step: 3, module_version: 1, updated_at: "t", created_at: "t" },
    ]);
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.drafts)).toBe(true);
    expect(json.drafts[0].id).toBe("d-1");
    expect(json.drafts[0].owner_user_id).toBeUndefined();
    // list is owner-scoped inside the service — called with the caller id.
    expect(listOwnerDrafts).toHaveBeenCalledWith({}, "owner-1");
  });

  it("403s an authenticated non-host with no data", async () => {
    currentUser.mockReturnValue({ id: "u" });
    hostActive.mockReturnValue(false);
    const res = await GET(req("GET"));
    expect(res.status).toBe(403);
    expect((await res.json()).drafts).toBeUndefined();
    expect(listOwnerDrafts).not.toHaveBeenCalled();
  });
});
