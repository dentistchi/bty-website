import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Single module-draft route — proves the gate, non-disclosing not-found, field
 * validation, immutability rejection (approved/published), and the client shape.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const getOwnerDraft = vi.fn();
const updateDraftStep = vi.fn();
const deleteDraft = vi.fn();

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
  getOwnerDraft: (...a: unknown[]) => getOwnerDraft(...a),
  updateDraftStep: (...a: unknown[]) => updateDraftStep(...a),
  deleteDraft: (...a: unknown[]) => deleteDraft(...a),
}));
vi.mock("@/lib/bty/foundry/events/draftAssetService", () => ({
  listDraftAssets: async () => [],
}));

let GET: typeof import("./route").GET;
let PATCH: typeof import("./route").PATCH;
let DELETE: typeof import("./route").DELETE;

beforeAll(async () => {
  ({ GET, PATCH, DELETE } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
  getOwnerDraft.mockReset();
  updateDraftStep.mockReset();
  deleteDraft.mockReset();
  hostActive.mockReset();
  hostActive.mockReturnValue(true);
  currentUser.mockReturnValue({ id: "owner-1" });
});

const ROW = {
  id: "d-1",
  owner_user_id: "owner-1",
  status: "draft",
  current_step: 2,
  answers: { problem: "x" },
  module_version: 1,
  parent_module_id: null,
  document_asset_ref: null,
  approved_at: null,
  published_at: null,
  created_at: "t",
  updated_at: "t",
};

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1", {
    method,
    headers: { "content-type": "application/json", origin: "https://x" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const params = { params: Promise.resolve({ id: "d-1" }) };

describe("GET /modules/[id]", () => {
  it("401s unauthenticated", async () => {
    currentUser.mockReturnValue(null);
    expect((await GET(req("GET"), params)).status).toBe(401);
  });

  it("returns the client draft for the owner", async () => {
    getOwnerDraft.mockResolvedValue(ROW);
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft.id).toBe("d-1");
    expect(json.draft.owner_user_id).toBeUndefined();
  });

  it("404 non-disclosing for a foreign/missing draft", async () => {
    getOwnerDraft.mockResolvedValue(null); // service returns null for foreign owner
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });
});

describe("PATCH /modules/[id]", () => {
  it("saves a partial draft (field-level, not approval completeness)", async () => {
    updateDraftStep.mockResolvedValue({ ok: true, value: { ...ROW, current_step: 3 } });
    const res = await PATCH(req("PATCH", { answers: { problem: "just this" }, current_step: 3 }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).draft.current_step).toBe(3);
  });

  it("400s invalid fields with the failing codes", async () => {
    const res = await PATCH(req("PATCH", { current_step: 99 }), params);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_fields");
    expect(json.fields).toContain("current_step_invalid");
    expect(updateDraftStep).not.toHaveBeenCalled();
  });

  it("404 non-disclosing when the draft is not owned/missing", async () => {
    updateDraftStep.mockResolvedValue({ ok: false, reason: "draft_not_found" });
    const res = await PATCH(req("PATCH", { current_step: 2 }), params);
    expect(res.status).toBe(404);
  });

  it("409 when the draft is approved/published (immutable) — even if client forces it", async () => {
    updateDraftStep.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    const res = await PATCH(req("PATCH", { current_step: 2 }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("draft_not_mutable");
  });
});

describe("DELETE /modules/[id]", () => {
  it("deletes a draft-status draft", async () => {
    deleteDraft.mockResolvedValue({ ok: true, value: { deleted: true } });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
  });

  it("404 non-disclosing for a foreign/missing draft", async () => {
    deleteDraft.mockResolvedValue({ ok: false, reason: "draft_not_found" });
    expect((await DELETE(req("DELETE"), params)).status).toBe(404);
  });

  it("409 rejecting deletion of an approved/published draft", async () => {
    deleteDraft.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(409);
  });
});
