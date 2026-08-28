/**
 * R1B-C2 — Action Capture routes: auth, consent, ownership and server-owned identity.
 *
 * The consent VERDICT itself is proven by `requireConsentedUser.test.ts`; here the primitive is
 * mocked so these tests are about THIS route's behaviour, following the existing convention.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireConsentedUser = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockEnsure = vi.fn();
const mockList = vi.fn();

vi.mock("@/lib/supabase/route-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/route-client")>();
  return {
    ...actual,
    requireConsentedUser: (...a: unknown[]) => mockRequireConsentedUser(...a),
  };
});
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...a: unknown[]) => mockGetSupabaseAdmin(...a),
}));
vi.mock("@/lib/bty/action-capture/ensureActionCapture.server", () => ({
  ensureActionCapture: (...a: unknown[]) => mockEnsure(...a),
  listMyActionCaptures: (...a: unknown[]) => mockList(...a),
}));

import { POST } from "./route";
import { GET } from "./mine/route";

const USER_A = { id: "user-a" };
const USER_B_ID = "user-b";

const body = {
  provider: "teams",
  tenant_id: "T1",
  conversation_id: "C1",
  message_id: "M1",
  preview_text: "Confirm the vendor quote?",
};

const post = (payload: unknown) =>
  new NextRequest("https://x.test/api/bty/action-capture", {
    method: "POST",
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
const get = () => new NextRequest("https://x.test/api/bty/action-capture/mine");

/** The default happy-path world: consented user A, admin available. */
function consented(user: { id: string } | null = USER_A) {
  const base = new Response(null) as never;
  mockRequireConsentedUser.mockResolvedValue({
    user,
    base: { cookies: { getAll: () => [] }, headers: new Headers() },
    consentDenied: null,
  });
  mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });
  void base;
}

beforeEach(() => {
  vi.clearAllMocks();
  consented();
  mockEnsure.mockResolvedValue({
    ok: true,
    created: true,
    capture: { id: "cap-1", sourceType: "teams_message", previewText: "x", sourceUrl: null, sourceMetadata: {}, status: "captured", capturedAt: "2026-08-28T00:00:00Z" },
  });
  mockList.mockResolvedValue([]);
});

describe("POST /api/bty/action-capture — authentication & consent", () => {
  it("rejects an unauthenticated POST with 401 and never writes", async () => {
    consented(null);
    const res = await POST(post(body));
    expect(res.status).toBe(401);
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it("rejects a consent-required user with the route convention's refusal and never writes", async () => {
    mockRequireConsentedUser.mockResolvedValue({
      user: USER_A,
      base: { cookies: { getAll: () => [] }, headers: new Headers() },
      consentDenied: new Response(JSON.stringify({ error: "consent_required" }), { status: 403 }),
    });
    const res = await POST(post(body));
    expect(res.status).toBe(403);
    expect(mockEnsure).not.toHaveBeenCalled();
  });
});

describe("POST — ownership is the session, never the body", () => {
  it("passes the SESSION user id to the producer", async () => {
    await POST(post(body));
    expect(mockEnsure.mock.calls[0][1].userId).toBe(USER_A.id);
  });

  it.each([
    ["user_id", { ...body, user_id: USER_B_ID }],
    ["userId", { ...body, userId: USER_B_ID }],
    ["external_key", { ...body, external_key: "teams:SPOOF" }],
    ["source_type", { ...body, source_type: "spoofed" }],
    ["status", { ...body, status: "promoted" }],
    ["promoted_at", { ...body, promoted_at: "2026-01-01T00:00:00Z" }],
    ["promoted_action_contract_id", { ...body, promoted_action_contract_id: "contract-1" }],
  ])("REJECTS a client-supplied %s with 400 and writes nothing", async (_field, payload) => {
    const res = await POST(post(payload));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "SERVER_OWNED_FIELD" });
    expect(mockEnsure, "a spoofed identity must never reach the producer").not.toHaveBeenCalled();
  });
});

describe("POST — request shape", () => {
  it("400s invalid JSON", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it("400s a missing identifier", async () => {
    mockEnsure.mockResolvedValue({ ok: false, code: "missing_identifier" });
    const res = await POST(post({ ...body, message_id: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "MISSING_IDENTIFIER" });
  });

  it("400s an unsupported provider", async () => {
    mockEnsure.mockResolvedValue({ ok: false, code: "unsupported_provider" });
    const res = await POST(post({ ...body, provider: "slack" }));
    expect(res.status).toBe(400);
  });
});

describe("POST — create vs duplicate semantics", () => {
  it("201 for a new capture", async () => {
    const res = await POST(post(body));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, created: true });
  });

  it("200 for an already-existing capture — a repeat save is not an error", async () => {
    mockEnsure.mockResolvedValue({
      ok: true,
      created: false,
      capture: { id: "cap-1", sourceType: "teams_message", previewText: "x", sourceUrl: null, sourceMetadata: {}, status: "captured", capturedAt: "2026-08-28T00:00:00Z" },
    });
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, created: false });
  });
});

describe("GET /api/bty/action-capture/mine — owner-scoped read", () => {
  it("401s an unauthenticated read and never queries", async () => {
    consented(null);
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("scopes the read to the SESSION user — user A can never read user B", async () => {
    await GET(get());
    expect(mockList.mock.calls[0][1]).toBe(USER_A.id);
  });

  it("returns a NON-200 on failure so error is distinguishable from empty", async () => {
    mockList.mockRejectedValue(new Error("boom"));
    const res = await GET(get());
    expect(res.status).toBe(500);
  });

  it("returns items with no-store caching", async () => {
    mockList.mockResolvedValue([{ id: "cap-1", status: "captured" }]);
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await res.json()).toMatchObject({ ok: true, items: [{ id: "cap-1" }] });
  });
});
