import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();
const mockRateLimitKV = vi.fn();
const mockUpsert = vi.fn();
const mockInsert = vi.fn();
const mockSupabaseFrom = vi.fn((table: string) => {
  if (table === "arena_profiles") {
    // route.ts performs: .upsert(payload, { onConflict }).select(cols)
    return {
      upsert: (vals: unknown, _opts: unknown) => ({
        select: (_cols?: string) => mockUpsert(vals),
      }),
    };
  }
  if (table === "arena_consent_log") {
    return {
      insert: (vals: unknown) => mockInsert(vals),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() =>
    NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getCfClientIp: () => "1.2.3.4",
  rateLimitKV: (...args: unknown[]) => mockRateLimitKV(...args),
}));

function reqWithBody(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/legal/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "vitest" },
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
  mockRateLimitKV.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockRequireUser.mockResolvedValue({
    user: { id: "user-uuid-1" },
    supabase: { from: mockSupabaseFrom },
    base: NextResponse.json({ ok: true }, { status: 200 }),
    error: null,
  });
  // Success path: upsert returns the persisted row so route.ts can confirm
  // consent_version landed before answering ok:true. Derive from payload so
  // the returned consent_version always matches what each test sent.
  mockUpsert.mockImplementation((vals: { user_id?: string; consent_version?: string }) =>
    Promise.resolve({
      data: [{ user_id: vals.user_id, consent_version: vals.consent_version }],
      error: null,
    }),
  );
  mockInsert.mockResolvedValue({ error: null });
});

describe("/api/legal/accept POST", () => {
  it("returns 429 when rate-limit not allowed", async () => {
    mockRateLimitKV.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 600 });
    const POST = await loadPost();
    const res = await POST(reqWithBody({}));
    expect(res.status).toBe(429);
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

  it("returns 500 when UPSERT fails", async () => {
    mockUpsert.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody()));
    expect(res.status).toBe(500);
  });

  it("returns 200 + writes audit log with derived placeholder + fingerprint on happy path", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; consent_version?: string };
    expect(body.ok).toBe(true);
    expect(body.consent_version).toBe(ACTIVE_CONSENT_VERSION);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockInsert.mock.calls[0]?.[0] as {
      consent_type?: string;
      action?: string;
      notes?: { placeholder?: boolean; sprint?: string; documentFingerprint?: string };
      ip_address?: string;
    };
    expect(insertArg.consent_type).toBe("tos");
    expect(insertArg.action).toBe("accepted");
    // Case 16 — the CURRENT document is placeholder-class, so this must still be true…
    expect(insertArg.notes?.placeholder).toBe(true);
    // …and it is now DERIVED, with the exact prose identity recorded beside it (case 19).
    expect(insertArg.notes?.documentFingerprint).toBe(EN_FP);
    // Existing provenance is preserved, not dropped.
    expect(insertArg.notes?.sprint).toBe("AL-LAUNCH-D3");
    expect(insertArg.ip_address).toBe("1.2.3.4");
  });

  /*
    THIS TEST USED TO ASSERT THE DEFECT (Slice 3.2R-R9A). It was named "returns 200 even when
    audit INSERT fails (UPSERT is primary)" and locked in a 200 with no durable evidence of
    consent. Evidence is now primary and the expectation is inverted.
  */
  it("case 12 — audit INSERT failure refuses, and the profile is NEVER marked accepted", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "audit failed" } });
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody()));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("consent_not_recorded");
    expect(mockUpsert).not.toHaveBeenCalled();
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
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("case 7 — a future, pattern-VALID, invented version is refused", async () => {
    const POST = await loadPost();
    const res = await POST(reqWithBody(activeBody({ consent_version: "2099-12-anything" })));
    expect(res.status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("case 8 — the right version with the WRONG fingerprint is refused", async () => {
    const POST = await loadPost();
    const res = await POST(
      reqWithBody(activeBody({ document_fingerprint: "bty_consent_document_v1:deadbeef" })),
    );
    expect(res.status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("case 8b — a MISSING fingerprint cannot be waved through", async () => {
    const POST = await loadPost();
    const { document_fingerprint: _omit, ...noFp } = activeBody();
    expect((await POST(reqWithBody(noFp))).status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("case 9 — a Korean document cannot be recorded as an English acceptance", async () => {
    const POST = await loadPost();
    // The KO fingerprint is real and current — but not for the submitted locale.
    const res = await POST(reqWithBody(activeBody({ document_fingerprint: KO_FP })));
    expect(res.status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
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
    expect(mockInsert).not.toHaveBeenCalled();
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
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("case 13/14 — audit ok + profile upsert fails → gated, audit preserved, retry succeeds", async () => {
    const POST = await loadPost();
    mockUpsert.mockResolvedValueOnce({ data: null, error: { message: "upsert boom" } });
    const first = await POST(reqWithBody(activeBody()));
    expect(first.status).toBe(500);
    // The acceptance event survives — it is TRUE, this user did accept this exact document.
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // Case 14 — the retry is not blocked by anything and eventually succeeds.
    const second = await POST(reqWithBody(activeBody()));
    expect(second.status).toBe(200);
    // Case 15 — the residue is a duplicate audit event, which this domain already tolerates.
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("case 15 — duplicate legitimate acceptances are appended, never rejected or deduplicated", async () => {
    const POST = await loadPost();
    expect((await POST(reqWithBody(activeBody()))).status).toBe(200);
    expect((await POST(reqWithBody(activeBody()))).status).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("EVIDENCE BEFORE ACCESS — the audit row is written before the profile is marked", async () => {
    const order: string[] = [];
    mockInsert.mockImplementationOnce(() => {
      order.push("audit");
      return Promise.resolve({ error: null });
    });
    mockUpsert.mockImplementationOnce((vals: { user_id?: string; consent_version?: string }) => {
      order.push("profile");
      return Promise.resolve({ data: [{ user_id: vals.user_id, consent_version: vals.consent_version }], error: null });
    });
    const POST = await loadPost();
    await POST(reqWithBody(activeBody()));
    expect(order).toEqual(["audit", "profile"]);
  });
});
