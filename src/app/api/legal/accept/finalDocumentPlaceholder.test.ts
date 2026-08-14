import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SLICE 3.2R-R9A — CASE 17: A FINAL DOCUMENT MUST RECORD `placeholder: false`
 * WITHOUT ANY CHANGE TO THE WRITER.
 *
 * `notes.placeholder = true` used to be a hardcoded literal in the acceptance writer, so the day
 * real legal text ships, every acceptance of it would have been filed as a placeholder one — the
 * ledger would misdescribe the most important consent the product ever collects.
 *
 * This drives the REAL route with the document authority swapped for a final-class document. The
 * writer is untouched; only the document changed, and the recorded fact follows it. That is the
 * proof that the placeholder flag is derived rather than asserted.
 */

const FINAL_DOC = {
  version: "2027-01-final-v1",
  locale: "en-US" as const,
  classification: "final" as const,
  title: "Final terms",
  sections: [{ heading: "Agreement", paragraphs: [["Final approved text."]], bullets: [], trailing: [] }],
};

vi.mock("@/domain/legal/consent-document", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/domain/legal/consent-document")>();
  return {
    ...real,
    ACTIVE_CONSENT_VERSION: FINAL_DOC.version,
    activeConsentDocument: (locale: unknown) => (locale === "en-US" ? FINAL_DOC : null),
  };
});

const mockRequireUser = vi.fn();
const mockRateLimitKV = vi.fn();
const mockUpsert = vi.fn();
const mockInsert = vi.fn();
const mockSupabaseFrom = vi.fn((table: string) => {
  if (table === "arena_profiles") {
    return {
      upsert: (vals: unknown, _opts: unknown) => ({ select: (_c?: string) => mockUpsert(vals) }),
    };
  }
  if (table === "arena_consent_log") return { insert: (vals: unknown) => mockInsert(vals) };
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
  requireConsentedUser: async (...a: unknown[]) => ({ ...(await mockRequireUser(...a)), consentDenied: null }),
  unauthenticated: vi.fn(() => NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  getCfClientIp: () => "1.2.3.4",
  rateLimitKV: (...a: unknown[]) => mockRateLimitKV(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimitKV.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockRequireUser.mockResolvedValue({
    user: { id: "user-uuid-1" },
    supabase: { from: mockSupabaseFrom },
    base: NextResponse.json({ ok: true }, { status: 200 }),
    error: null,
  });
  mockUpsert.mockImplementation((vals: { user_id?: string; consent_version?: string }) =>
    Promise.resolve({ data: [{ user_id: vals.user_id, consent_version: vals.consent_version }], error: null }),
  );
  mockInsert.mockResolvedValue({ error: null });
});

describe("[3.2R-R9A] case 17 — placeholder is derived from the document", () => {
  it("a final-class document records placeholder:false, writer unchanged", async () => {
    const { consentDocumentFingerprint } = await import("@/domain/legal/consent-fingerprint");
    const { POST } = await import("./route");

    const res = await POST(
      new NextRequest("http://localhost/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-agent": "vitest" },
        body: JSON.stringify({
          consent_version: FINAL_DOC.version,
          consent_locale: "en-US",
          document_fingerprint: consentDocumentFingerprint(FINAL_DOC),
        }),
      }),
    );

    expect(res.status).toBe(200);
    const notes = (mockInsert.mock.calls[0]?.[0] as { notes?: { placeholder?: boolean; documentFingerprint?: string } })
      .notes;
    expect(notes?.placeholder).toBe(false);
    expect(notes?.documentFingerprint).toBe(consentDocumentFingerprint(FINAL_DOC));
  });

  it("and the placeholder-era version is refused once a final document is active", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-agent": "vitest" },
        body: JSON.stringify({
          consent_version: "2026-05-v1",
          consent_locale: "en-US",
          document_fingerprint: "bty_consent_document_v1:old",
        }),
      }),
    );
    expect(res.status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
