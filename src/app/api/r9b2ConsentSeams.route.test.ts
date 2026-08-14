import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

/**
 * SLICE 3.2R-R9B.2 — THE REMAINING SEAMS, PROVEN THROUGH REAL ROUTES.
 *
 * R9B.1 closed the `route-client.requireUser` seam. The rest authenticate differently, so each one
 * gets its own proof here — and in every case the assertion that matters is that the protected
 * operation is NEVER REACHED, not merely that the status is 403. A refusal issued after the private
 * reflection has already been fetched would still have read it.
 *
 * `isConsentCurrent` is deliberately NOT mocked: these drive the real primitive against a stubbed
 * profile row, so the verdict under test is the production one.
 */

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const getLetterHistory = vi.fn();
const listAvailablePractices = vi.fn();

/** One stub client serving both auth and the arena_profiles consent read. */
const client = {
  auth: { getUser: () => mockGetUser() },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
};

vi.mock("@/lib/bty/arena/supabaseServer", () => ({ getSupabaseServerClient: async () => client }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => client }));
vi.mock("@/lib/bty/arena/requireApprovedMembership", () => ({
  requireApprovedMembership: async () => ({ approved: true }),
}));

/** The protected work — must stay untouched on refusal. */
vi.mock("@/lib/bty/center", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bty/center")>()),
  getLetterHistory: (...a: unknown[]) => getLetterHistory(...a),
}));
vi.mock("@/lib/bty/foundry/arena/foundryArenaPracticeRunService", () => ({
  listAvailablePractices: (...a: unknown[]) => listAvailablePractices(...a),
}));

const USER = { id: "11111111-1111-1111-1111-111111111111" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  getLetterHistory.mockResolvedValue({ ok: true, letters: [] });
  listAvailablePractices.mockResolvedValue([]);
});

const consented = () =>
  mockMaybeSingle.mockResolvedValue({ data: { consent_version: ACTIVE_CONSENT_VERSION }, error: null });
const version = (v: string | null) =>
  mockMaybeSingle.mockResolvedValue({ data: { consent_version: v }, error: null });

const REFUSING = [
  ["null", null],
  ["old", "2026-05-pending-v1"],
  ["invented", "2099-12-anything"],
] as const;

describe("[3.2R-R9B.2] getLetterAuth family — private Center / Dear Me content", () => {
  const get = async () => {
    const { GET } = await import("./dear-me/letters/route");
    return GET();
  };

  it("current consent → the history is served", async () => {
    consented();
    expect((await get()).status).toBe(200);
    expect(getLetterHistory).toHaveBeenCalledTimes(1);
  });

  for (const [label, v] of REFUSING) {
    it(`${label} consent → 403, and the private letters are NEVER fetched`, async () => {
      version(v);
      const res = await get();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "consent_required" });
      expect(getLetterHistory).not.toHaveBeenCalled();
    });
  }

  it("a profile read failure fails closed and still fetches nothing", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await get()).status).toBe(403);
    expect(getLetterHistory).not.toHaveBeenCalled();
  });

  it("no session → the route's existing 401, not a consent refusal", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await get()).status).toBe(401);
    expect(getLetterHistory).not.toHaveBeenCalled();
  });
});

describe("[3.2R-R9B.2] requireArenaAccess family — practice play", () => {
  const get = async () => {
    const { GET } = await import("./arena/practice/route");
    return GET();
  };

  it("current consent → practices are listed", async () => {
    consented();
    expect((await get()).status).toBe(200);
    expect(listAvailablePractices).toHaveBeenCalledTimes(1);
  });

  for (const [label, v] of REFUSING) {
    it(`${label} consent → 403 before any practice is read`, async () => {
      version(v);
      const res = await get();
      expect(res.status).toBe(403);
      expect(listAvailablePractices).not.toHaveBeenCalled();
    });
  }
});

describe("[3.2R-R9B.2] the refusal shape is identical across every seam", () => {
  it("403 consent_required — never 401 (login loop) and never 409 (R9A's stale document)", async () => {
    version("2026-05-pending-v1");
    const { GET } = await import("./dear-me/letters/route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(409);
    expect(await res.json()).toEqual({ error: "consent_required" });
  });
});

describe("[3.2R-R9B.2] optional-identity and public-token routes keep serving anonymous callers", () => {
  it("an anonymous participant completing training is not consent-gated", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/bty/foundry/public/[token]/progress/complete/route.ts", "utf8"),
    );
    // Optional auth by design — anonymous is fully supported, so no consent guard may appear.
    expect(src).toContain("Optional auth detection");
    expect(src).not.toContain("consentRequiredResponse");
  });

  it("chat and mentor keep their optional identity — a blanket 403 would break anonymous use", async () => {
    const fs = await import("node:fs");
    for (const p of ["src/app/api/chat/route.ts", "src/app/api/mentor/route.ts"]) {
      expect(fs.readFileSync(p, "utf8"), p).not.toContain("consentRequiredResponse");
    }
  });
});
