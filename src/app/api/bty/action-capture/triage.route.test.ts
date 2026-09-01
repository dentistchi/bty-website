import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/bty/action-capture/[id]/triage — the owner-scoped write (Slice T2).
 *
 * The interesting assertions are the refusals: an unauthenticated caller, a body that says
 * something we do not recognise, and a capture that is not the caller's — the last of which must
 * be indistinguishable from one that does not exist.
 */

const mockRequireConsentedUser = vi.fn();
const mockSetTriage = vi.fn();
const mockGetSupabaseAdmin = vi.fn(() => ({}) as never);

vi.mock("@/lib/supabase/route-client", () => ({
  requireConsentedUser: (...a: unknown[]) => mockRequireConsentedUser(...a),
  copyCookiesAndDebug: vi.fn(),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ ok: false, error: "UNAUTHENTICATED" }), { status: 401 })),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => mockGetSupabaseAdmin() }));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({
  setActionCaptureTriage: (...a: unknown[]) => mockSetTriage(...a),
}));

import { POST } from "./[id]/triage/route";

const CAP = "11111111-1111-1111-1111-111111111111";

function req(body: unknown, raw = false) {
  return new Request(`http://localhost/api/bty/action-capture/${CAP}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}
const ctx = (id = CAP) => ({ params: Promise.resolve({ id }) });

const capture = {
  id: CAP,
  sourceType: "teams_message",
  externalKey: "teams:T1:C1:M1",
  previewText: "Can you confirm the vendor quote?",
  sourceUrl: "https://teams.microsoft.com/l/message/1",
  sourceMetadata: { provider: "teams" },
  status: "captured",
  capturedAt: "2026-08-28T00:00:00Z",
  triageChoice: "soon",
  triagedAt: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireConsentedUser.mockResolvedValue({ user: { id: "user-a" }, base: new Response(), consentDenied: null });
  mockGetSupabaseAdmin.mockReturnValue({} as never);
  mockSetTriage.mockResolvedValue({ ok: true, capture, changed: true });
});

describe("7. the owner records a decision", () => {
  it("accepts soon and returns the stored row", async () => {
    const res = await POST(req({ choice: "soon" }), ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, changed: true, capture: { triageChoice: "soon" } });
    // The session owns identity: the service is called with the session id, never a body value.
    expect(mockSetTriage).toHaveBeenCalledWith(expect.anything(), { userId: "user-a", captureId: CAP, choice: "soon" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("accepts later", async () => {
    mockSetTriage.mockResolvedValue({ ok: true, capture: { ...capture, triageChoice: "later" }, changed: true });
    const res = await POST(req({ choice: "later" }), ctx());
    expect(res.status).toBe(200);
    expect(mockSetTriage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ choice: "later" }));
  });

  it("12. an already-decided capture returns the standing decision with changed:false", async () => {
    mockSetTriage.mockResolvedValue({ ok: true, capture, changed: false });
    const res = await POST(req({ choice: "later" }), ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, changed: false, capture: { triageChoice: "soon" } });
  });
});

describe("6+8+13. refusals", () => {
  it("refuses an unauthenticated caller before reaching the service", async () => {
    mockRequireConsentedUser.mockResolvedValue({ user: null, base: new Response(), consentDenied: null });
    const res = await POST(req({ choice: "soon" }), ctx());
    expect(res.status).toBe(401);
    expect(mockSetTriage).not.toHaveBeenCalled();
  });

  it("refuses a body whose choice we do not recognise, and writes nothing", async () => {
    for (const choice of ["SOON", "someday", "done", "", null, 1, true]) {
      const res = await POST(req({ choice }), ctx());
      expect(res.status, `choice=${String(choice)}`).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: "INVALID_CHOICE" });
    }
    const missing = await POST(req({}), ctx());
    expect(missing.status).toBe(400);
    expect(mockSetTriage).not.toHaveBeenCalled();
  });

  it("refuses malformed JSON", async () => {
    const res = await POST(req("{not json", true), ctx());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "INVALID_JSON" });
    expect(mockSetTriage).not.toHaveBeenCalled();
  });

  it("returns the SAME 404 for a non-owned id as for a missing one", async () => {
    mockSetTriage.mockResolvedValue({ ok: false, code: "not_found" });
    const res = await POST(req({ choice: "soon" }), ctx());
    expect(res.status).toBe(404);
    // No detail that would let a caller tell "someone else's" from "no such row".
    await expect(res.json()).resolves.toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("does not leak a server failure as a 404", async () => {
    mockSetTriage.mockResolvedValue({ ok: false, code: "update_failed" });
    const res = await POST(req({ choice: "soon" }), ctx());
    expect(res.status).toBe(500);
  });
});
