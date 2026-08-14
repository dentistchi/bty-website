import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

/**
 * SLICE 3.2R-R9B.1 — THE SHARED LEARNER CONSENT GUARD.
 *
 * R9A closed the page gate. The middleware matcher excludes `/api/*`, so a signed-in learner with
 * null, outdated or invented consent could still call the product APIs directly — measured across
 * five auth seams, none of which checked consent. This guard closes the largest of them.
 *
 * The single most important property here is what it does NOT do: `requireUser` keeps
 * authentication-only semantics, because `requireManager` composes it and Hosts must not be
 * silently placed under the learner agreement.
 */

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock("@/lib/bty/cookies/authCookies", () => ({
  authCookieSecureForRequest: () => true,
  setAuthCookie: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }),
    }),
  }),
}));

const req = () => new NextRequest("http://localhost/api/anything");
const USER = { id: "11111111-1111-1111-1111-111111111111" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  mockMaybeSingle.mockResolvedValue({ data: { consent_version: ACTIVE_CONSENT_VERSION }, error: null });
});

async function run() {
  const { requireConsentedUser } = await import("./route-client");
  return requireConsentedUser(req());
}

describe("[3.2R-R9B.1] requireConsentedUser", () => {
  it("case 1 — no session: unchanged unauthenticated behaviour, and no consent verdict", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const gate = await run();
    expect(gate.user).toBeNull();
    expect(gate.consentDenied).toBeNull();
    // The profile is never read for an anonymous caller.
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("case 2 — the exact active version is allowed", async () => {
    const gate = await run();
    expect(gate.user).toEqual(USER);
    expect(gate.consentDenied).toBeNull();
  });

  it("case 3 — null consent refuses with 403 consent_required", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { consent_version: null }, error: null });
    const gate = await run();
    expect(gate.user).toEqual(USER); // authentication still succeeded
    expect(gate.consentDenied).toBeInstanceOf(NextResponse);
    expect(gate.consentDenied!.status).toBe(403);
    expect(await gate.consentDenied!.json()).toEqual({ error: "consent_required" });
  });

  it("case 4 — an OLD version refuses (the population R9A gates at the page)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { consent_version: "2026-05-pending-v1" }, error: null });
    expect((await run()).consentDenied?.status).toBe(403);
  });

  it("case 5 — an invented/future version refuses", async () => {
    for (const bogus of ["2099-12-anything", "yes", "2026-05-v2"]) {
      mockMaybeSingle.mockResolvedValue({ data: { consent_version: bogus }, error: null });
      expect((await run()).consentDenied?.status, bogus).toBe(403);
    }
  });

  it("case 6 — a profile READ ERROR fails closed", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await run()).consentDenied?.status).toBe(403);
  });

  it("case 6b — a THROWN query fails closed", async () => {
    mockMaybeSingle.mockRejectedValue(new Error("network"));
    expect((await run()).consentDenied?.status).toBe(403);
  });

  it("case 7 — a MISSING profile row fails closed", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await run()).consentDenied?.status).toBe(403);
  });

  it("case 8 — the verdict comes from R9A's authority, not a local copy", async () => {
    // Whatever the active version is, that exact string is the only one accepted.
    mockMaybeSingle.mockResolvedValue({ data: { consent_version: ACTIVE_CONSENT_VERSION }, error: null });
    expect((await run()).consentDenied).toBeNull();
    mockMaybeSingle.mockResolvedValue({ data: { consent_version: ` ${ACTIVE_CONSENT_VERSION}` }, error: null });
    expect((await run()).consentDenied?.status).toBe(403);
  });

  it("requireUser itself is untouched — it never consults consent", async () => {
    const { requireUser } = await import("./route-client");
    mockMaybeSingle.mockResolvedValue({ data: { consent_version: "2026-05-pending-v1" }, error: null });
    const gate = await requireUser(req());
    expect(gate.user).toEqual(USER);
    expect((gate as { consentDenied?: unknown }).consentDenied).toBeUndefined();
    // No profile read happens on the authentication-only path — this is what keeps
    // requireManager (which composes requireUser) out of the learner agreement.
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
