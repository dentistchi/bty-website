import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Draft PDF attachment route — proves the gate, non-disclosing not-found,
 * immutability rejection, validation mapping, and that no owner id / storage path
 * / hash leaks to the client.
 */
const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const attachDocument = vi.fn();
const removeDocument = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: async () => hostActive(),
}));
vi.mock("@/lib/bty/foundry/events/moduleDocumentService", () => ({
  attachDocument: (...a: unknown[]) => attachDocument(...a),
  removeDocument: (...a: unknown[]) => removeDocument(...a),
}));

let POST: typeof import("./route").POST;
let DELETE: typeof import("./route").DELETE;

beforeAll(async () => {
  ({ POST, DELETE } = await import("./route"));
});

beforeEach(() => {
  currentUser.mockReset();
  attachDocument.mockReset();
  removeDocument.mockReset();
  hostActive.mockReset();
  hostActive.mockReturnValue(true);
  currentUser.mockReturnValue({ id: "owner-1" });
});

const DRAFT_ROW = {
  id: "d-1",
  owner_user_id: "owner-1",
  status: "draft",
  current_step: 6,
  answers: { materialIntent: "pdf" },
  module_version: 1,
  parent_module_id: null,
  document_asset_ref: JSON.stringify({ bucket: "foundry-docs", path: "owner-1/x.pdf", filename: "Care.pdf", byteSize: 2048, pageCount: 12, pageCountVerified: true, contentHash: "abc", uploadedAt: "t" }),
  approved_at: null,
  published_at: null,
  created_at: "t",
  updated_at: "t",
};
const ATTACHMENT = { present: true, filename: "Care.pdf", byte_size: 2048, page_count: 12, page_count_verified: true, uploaded_at: "t" };

function post() {
  const fd = new FormData();
  fd.append("file", new Blob(["%PDF-"], { type: "application/pdf" }), "Care.pdf");
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1/document", { method: "POST", body: fd });
}
function del() {
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1/document", { method: "DELETE" });
}
const params = { params: Promise.resolve({ id: "d-1" }) };

describe("POST /modules/[id]/document", () => {
  it("401 unauthenticated (service untouched)", async () => {
    currentUser.mockReturnValue(null);
    const res = await POST(post(), params);
    expect(res.status).toBe(401);
    expect(attachDocument).not.toHaveBeenCalled();
  });

  it("403 authenticated non-host", async () => {
    hostActive.mockReturnValue(false);
    const res = await POST(post(), params);
    expect(res.status).toBe(403);
    expect(attachDocument).not.toHaveBeenCalled();
  });

  it("attaches and returns safe metadata — never owner id or storage path", async () => {
    attachDocument.mockResolvedValue({ ok: true, value: { draft: DRAFT_ROW, attachment: ATTACHMENT } });
    const res = await POST(post(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attachment).toEqual(ATTACHMENT);
    expect(json.draft.document_asset_ref_present).toBe(true);
    const body = JSON.stringify(json);
    expect(body).not.toMatch(/owner_user_id|owner-1\/x\.pdf|foundry-docs|"abc"/);
  });

  it("400 on a non-PDF / bad file", async () => {
    attachDocument.mockResolvedValue({ ok: false, reason: "file_not_pdf" });
    expect((await POST(post(), params)).status).toBe(400);
  });

  it("404 non-disclosing for a foreign/missing draft", async () => {
    attachDocument.mockResolvedValue({ ok: false, reason: "draft_not_found" });
    expect((await POST(post(), params)).status).toBe(404);
  });

  it("409 on an approved/published draft", async () => {
    attachDocument.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    expect((await POST(post(), params)).status).toBe(409);
  });
});

describe("DELETE /modules/[id]/document", () => {
  it("401 unauthenticated", async () => {
    currentUser.mockReturnValue(null);
    expect((await DELETE(del(), params)).status).toBe(401);
  });

  it("removes and returns the honest no-attachment draft", async () => {
    const cleared = { ...DRAFT_ROW, document_asset_ref: null };
    removeDocument.mockResolvedValue({ ok: true, value: { draft: cleared } });
    const res = await DELETE(del(), params);
    expect(res.status).toBe(200);
    expect((await res.json()).draft.document_asset_ref_present).toBe(false);
  });

  it("502 when storage removal failed (attachment not falsely cleared)", async () => {
    removeDocument.mockResolvedValue({ ok: false, reason: "remove_failed" });
    expect((await DELETE(del(), params)).status).toBe(502);
  });

  it("409 on approved/published draft", async () => {
    removeDocument.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    expect((await DELETE(del(), params)).status).toBe(409);
  });
});
