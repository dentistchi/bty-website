import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const currentUser = vi.fn<() => { id: string } | null>();
const hostActive = vi.fn<() => boolean>();
const removeAsset = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: async () => ({ user: currentUser(), base: NextResponse.json({ ok: true }) }),
  unauthenticated: () => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  copyCookiesAndDebug: () => {},
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({ isActiveFoundryHost: async () => hostActive() }));
vi.mock("@/lib/bty/foundry/events/draftAssetService", () => ({ removeAsset: (...a: unknown[]) => removeAsset(...a) }));

let DELETE: typeof import("./route").DELETE;
beforeAll(async () => {
  ({ DELETE } = await import("./route"));
});
beforeEach(() => {
  currentUser.mockReset();
  removeAsset.mockReset();
  hostActive.mockReset();
  hostActive.mockReturnValue(true);
  currentUser.mockReturnValue({ id: "owner-1" });
});

function del() {
  return new NextRequest("http://localhost/api/bty/foundry/modules/d-1/assets/a1", { method: "DELETE" });
}
const params = { params: Promise.resolve({ id: "d-1", assetId: "a1" }) };

describe("DELETE /modules/[id]/assets/[assetId]", () => {
  it("401 unauthenticated", async () => {
    currentUser.mockReturnValue(null);
    expect((await DELETE(del(), params)).status).toBe(401);
    expect(removeAsset).not.toHaveBeenCalled();
  });
  it("removes and returns removed:true", async () => {
    removeAsset.mockResolvedValue({ ok: true, value: { removed: true } });
    const res = await DELETE(del(), params);
    expect(res.status).toBe(200);
    expect((await res.json()).removed).toBe(true);
  });
  it("404 non-disclosing when the asset is not on this draft", async () => {
    removeAsset.mockResolvedValue({ ok: false, reason: "asset_not_found" });
    expect((await DELETE(del(), params)).status).toBe(404);
  });
  it("409 on an immutable draft", async () => {
    removeAsset.mockResolvedValue({ ok: false, reason: "draft_not_mutable" });
    expect((await DELETE(del(), params)).status).toBe(409);
  });
  it("502 when storage removal failed (row not falsely deleted)", async () => {
    removeAsset.mockResolvedValue({ ok: false, reason: "storage_failed" });
    expect((await DELETE(del(), params)).status).toBe(502);
  });
});
