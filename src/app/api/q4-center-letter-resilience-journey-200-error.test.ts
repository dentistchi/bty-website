/**
 * Q4: POST center/letter, GET center/resilience, GET journey/entries — 200·에러 batch.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetLetterAuth = vi.fn();
const mockSubmitCenterLetter = vi.fn();
const mockGetSupabaseServerClient = vi.fn();
const mockGetResilienceEntries = vi.fn();
const mockParsePeriodDays = vi.fn();
const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

/*
  R9B.2: these routes now require CURRENT consent. This suite is about the route's own behaviour,
  and its subject has always been an ordinary consented learner — so the consent primitive says so
  explicitly. The consent VERDICT itself is proven by `requireConsentedUser.test.ts` and
  `learnerConsentGuard.route.test.ts`, which do not mock it.
*/
vi.mock("@/lib/legal/activeConsent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/activeConsent")>()),
  isConsentCurrent: async () => true,
}));

vi.mock("@/lib/bty/center", () => ({
  getLetterAuth: (...args: unknown[]) => mockGetLetterAuth(...args),
  getConsentedLetterAuth: async (...args: unknown[]) => {
    const a = await mockGetLetterAuth(...args);
    return a ? { ...a, consentCurrent: true } : a;
  },
  submitCenterLetter: (...args: unknown[]) => mockSubmitCenterLetter(...args),
  getResilienceEntries: (...args: unknown[]) => mockGetResilienceEntries(...args),
  parsePeriodDays: (...args: unknown[]) => mockParsePeriodDays(...args),
}));

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) =>
    mockGetSupabaseServerClient(...args),
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) =>
    mockGetAuthUserFromRequest(...args),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

vi.mock("@/lib/log-api-error", () => ({
  logApiError: vi.fn(),
}));

const { POST: postLetter } = await import("./center/letter/route");
const { GET: getResilience } = await import("./center/resilience/route");

describe("Q4 center/letter · resilience — 200·에러", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("letter 200, resilience 200", async () => {
    mockGetLetterAuth.mockResolvedValue({ supabase: {}, userId: "u1" });
    mockSubmitCenterLetter.mockResolvedValue({
      ok: true,
      reply: "Take care.",
    });
    const r1 = await postLetter(
      new Request("http://localhost/api/center/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Hello" }),
      }),
    );
    expect(r1.status).toBe(200);
    const j1 = await r1.json();
    expect(j1.saved).toBe(true);
    expect(j1.reply).toBe("Take care.");

    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "u1" } } }),
      },
    });
    mockParsePeriodDays.mockReturnValue(7);
    mockGetResilienceEntries.mockResolvedValue({
      ok: true,
      entries: [],
    });
    const r2 = await getResilience(
      new NextRequest("http://localhost/api/center/resilience"),
    );
    expect(r2.status).toBe(200);
    const j2 = await r2.json();
    expect(j2.entries).toEqual([]);
  });
});
