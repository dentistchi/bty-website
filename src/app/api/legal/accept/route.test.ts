import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();
const mockRpc = vi.fn();
const mockAdmin = vi.fn();
const mockSelect = vi.fn();
const mockConsentProjection = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => mockAdmin() }));

function reqWithBody(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/legal/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "vitest", "cf-connecting-ip": "192.0.2.4" },
    body: JSON.stringify(body),
  });
}

import {
  ACTIVE_CONSENT_VERSION,
  activeConsentDocument,
} from "@/domain/legal/consent-document";
import { consentDocumentFingerprint } from "@/domain/legal/consent-fingerprint";

const EN_DOC = activeConsentDocument("en-US")!;
const KO_DOC = activeConsentDocument("ko-KR")!;
const EN_FP = consentDocumentFingerprint(EN_DOC);
const KO_FP = consentDocumentFingerprint(KO_DOC);

/** Exactly what the consent page hands the client for the active EN document. */
const activeBody = (over: Record<string, unknown> = {}) => ({
  consent_version: ACTIVE_CONSENT_VERSION,
  consent_locale: "en-US",
  document_fingerprint: EN_FP,
  ...over,
});

async function loadPost() {
  const mod = await import("./route");
  return mod.POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({
    user: { id: "user-uuid-1" },
    supabase: { from: () => ({ select: mockSelect }) },
    base: NextResponse.json({ ok: true }),
  });
  mockAdmin.mockReturnValue({ rpc: mockRpc });
  mockRpc.mockResolvedValue({ data: { status: "accepted" }, error: null });
  mockSelect.mockReturnValue({ eq: () => ({ maybeSingle: mockConsentProjection }) });
  mockConsentProjection.mockResolvedValue({ data: null, error: null });
});

describe("/api/legal/accept POST", () => {
  it("returns 429 when rate-limit not allowed", async () => {
    mockRpc.mockResolvedValueOnce({ data: { status: "rate_limited", retryAfterSeconds: 600 }, error: null });
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody()));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("600");
    const body = (await res.json()) as { retryAfterSeconds?: number };
    expect(body.retryAfterSeconds).toBe(600);
  });

  it("returns 401 when no auth", async () => {
    mockRequireUser.mockResolvedValueOnce({
      user: null,
      supabase: null,
      base: NextResponse.json({ ok: true }, { status: 200 }),
      error: null,
    });
    const POST = await loadPost();
    const res = await POST(reqWithBody({ consent_version: "2026-05-x", consent_locale: "en-US" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when consent_version missing", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody({ consent_locale: "en-US" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("consent_version_required");
  });

  it("returns 400 when consent_version format invalid", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "not-a-version", consent_locale: "en-US" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_consent_version");
  });

  it("returns 400 when consent_locale not allowed", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({ consent_version: "2026-05-pending-v1", consent_locale: "zh-CN" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_consent_locale");
  });

  it("confirms one atomic write for the authenticated user and exact document", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody({ user_id: "ignored-user" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      consent_version: ACTIVE_CONSENT_VERSION,
      redirect_to: null,
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("bty_accept_learner_consent", {
      p_user_id: "user-uuid-1",
      p_version: ACTIVE_CONSENT_VERSION,
      p_locale: "en-US",
      p_fingerprint: EN_FP,
      p_placeholder: true,
      p_ip_address: "192.0.2.4",
      p_user_agent: "vitest",
    });
  });

  it("refuses when the atomic write fails and allows an ordinary retry", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    const POST = await loadPost();
    const failed = await POST(reqWithBody(activeBody()));
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toBe("consent_not_recorded");
    expect((await POST(reqWithBody(activeBody()))).status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("refuses when the write does not return a confirmed acceptance", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const POST = await loadPost();
    expect((await POST(reqWithBody(activeBody()))).status).toBe(500);
  });

  it("returns an unavailable response when the privileged client is unavailable", async () => {
    mockAdmin.mockReturnValueOnce(null);
    const POST = await loadPost();
    expect((await POST(reqWithBody(activeBody()))).status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects consent_version > 50 chars", async () => {
    const long = "2026-05-" + "a".repeat(50);
    const POST = await loadPost();
    const res = await POST(reqWithBody({ consent_version: long, consent_locale: "en-US" }));
    expect(res.status).toBe(400);
  });
});

/**
 * SLICE 3.2R-R9A — THE SERVER OWNS THE ACTIVE DOCUMENT.
 *
 * Every case here failed to exist before: the route validated only the SHAPE of the version
 * string, so an old version, a future one, or a fabricated `2099-12-anything` were all accepted
 * and stored, and the presence-only gate then honoured them forever.
 */
describe("[3.2R-R9A] active-document authority", () => {
  it("case 6 — an OLD version is refused, even though it is a real historical version", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody({ consent_version: "2026-05-pending-v1" })));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("consent_document_stale");
    // Nothing was written — not the ledger, not the profile.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("case 7 — a future, pattern-VALID, invented version is refused", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody({ consent_version: "2099-12-anything" })));
    expect(res.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("case 8 — the right version with the WRONG fingerprint is refused", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody(activeBody({ document_fingerprint: "bty_consent_document_v1:deadbeef" })),
    );
    expect(res.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("case 8b — a MISSING fingerprint cannot be waved through", async () => {
    const POST = await loadPost();
    const { document_fingerprint: _omit, ...noFp } = activeBody();
    expect((await POST(reqWithBody(noFp))).status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("case 9 — a Korean document cannot be recorded as an English acceptance", async () => {
    const POST = await loadPost();
    // The KO fingerprint is real and current — but not for the submitted locale.
    const res = await POST(reqWithBody(activeBody({ document_fingerprint: KO_FP })));
    expect(res.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
    // …and the same document accepted under its OWN locale is fine.
    const ok = await POST(
      reqWithBody({ consent_version: ACTIVE_CONSENT_VERSION, consent_locale: "ko-KR", document_fingerprint: KO_FP }),
    );
    expect(ok.status).toBe(200);
    expect(EN_FP).not.toBe(KO_FP);
  });

  it("case 10 — an unsupported locale is refused before any write", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody({ consent_locale: "fr-FR" })));
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("case 11 — STALE TAB: rendered under A, active is B at POST time → B is never recorded", async () => {
    /*
      The tab submits what it actually displayed. Simulating the deploy by naming the PREVIOUS
      real version is the honest shape of this: the fields describe a document that is no longer
      active, and the server refuses rather than converting the click into acceptance of today's
      text.
    */
    const POST = await loadPost();
    const res = await POST(
      reqWithBody({
        consent_version: "2026-05-pending-v1",
        consent_locale: "en-US",
        document_fingerprint: "bty_consent_document_v1:whatever-A-hashed-to",
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("consent_document_stale");
    // The client is told WHICH document to re-render — identity only, never prose.
    expect(body.active_consent_version).toBe(ACTIVE_CONSENT_VERSION);
    expect(mockRpc).not.toHaveBeenCalled();
  });

});

describe("/api/legal/accept GET", () => {
  const req = (locale: string) =>
    new NextRequest(`http://localhost/api/legal/accept?locale=${locale}`);

  it("returns the locale document, fingerprint and server-verified consent status without caching", async () => {
    mockConsentProjection.mockResolvedValueOnce({
      data: { consent_version: ACTIVE_CONSENT_VERSION },
      error: null,
    });
    const { GET } = await import("./route");
    const res = await GET(req("ko-KR"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ current: true, document: KO_DOC, documentFingerprint: KO_FP });
    expect(mockSelect).toHaveBeenCalledWith("consent_version:consent_verified_version");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses an unsupported locale or unauthenticated caller", async () => {
    const { GET } = await import("./route");
    expect((await GET(req("fr-FR"))).status).toBe(400);
    mockRequireUser.mockResolvedValueOnce({ user: null, base: NextResponse.json({}) });
    expect((await GET(req("en-US"))).status).toBe(401);
    expect(mockConsentProjection).not.toHaveBeenCalled();
  });
});
