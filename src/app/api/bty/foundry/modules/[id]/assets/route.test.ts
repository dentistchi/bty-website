import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const attachAsset = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => hostActive() }));
vi.mock("@/lib/bty/foundry/events/draftAssetService", () => ({ attachAsset: (...a: unknown[]) => attachAsset(...a) }));

let POST: typeof import("./route").POST;
beforeAll(async () => {
  ({ POST } = await import("./route"));
});
beforeEach(() => {
  currentUser.mockReset();
  attachAsset.mockReset();
  hostActive.mockReset();
  hostActive.mockReturnValue(true);
  currentUser.mockReturnValue({ id: "owner-1" });
});

const ASSET = { id: "a1", filename: "Care.pdf", file_kind: "pdf", mime_type: "application/pdf", byte_size: 2048, page_count: 3, page_count_verified: true, width: null, height: null, uploaded_at: "t", preview_supported: true, participant_delivery_ready: true };

function post() {
  const fd = new FormData();
  fd.append("file", new Blob(["%PDF-"], { type: "application/pdf" }), "Care.pdf");
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1/assets", { method: "POST", body: fd });
}
const params = { params: Promise.resolve({ id: "d-1" }) };

describe("POST /modules/[id]/assets", () => {
  it("401 unauthenticated (service untouched)", async () => {
    currentUser.mockReturnValue(null);
    expect((await POST(post(), params)).status).toBe(401);
    expect(attachAsset).not.toHaveBeenCalled();
  });
  it("403 non-host", async () => {
    hostActive.mockReturnValue(false);
    expect((await POST(post(), params)).status).toBe(403);
    expect(attachAsset).not.toHaveBeenCalled();
  });
  it("201 with a safe asset — never bucket/path/hash/owner", async () => {
    attachAsset.mockResolvedValue({ ok: true, value: { asset: ASSET } });
    const res = await POST(post(), params);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.asset.id).toBe("a1");
    expect(JSON.stringify(json)).not.toMatch(/owner_user_id|storage_path|storage_bucket|content_hash|foundry-docs/);
  });
  it("400 unsupported / invalid signature (file-specific)", async () => {
    attachAsset.mockResolvedValue({ ok: false, reason: "unsupported_file_type" });
    expect((await POST(post(), params)).status).toBe(400);
    attachAsset.mockResolvedValue({ ok: false, reason: "invalid_file_signature" });
    expect((await POST(post(), params)).status).toBe(400);
  });
  it("404 non-disclosing for a foreign/missing draft", async () => {
    attachAsset.mockResolvedValue({ ok: false, reason: "draft_not_found" });
    expect((await POST(post(), params)).status).toBe(404);
  });
  it("409 immutable / too many files", async () => {
    attachAsset.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    expect((await POST(post(), params)).status).toBe(409);
    attachAsset.mockResolvedValue({ ok: false, reason: "too_many_files" });
    expect((await POST(post(), params)).status).toBe(409);
  });
});
