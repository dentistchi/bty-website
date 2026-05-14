/**
 * Middleware FORCED_RESET_PENDING redirect — Stage 2 step 4 sub-phase 2D.
 *
 * Tests the 2C-1 redirect clause at `src/middleware.ts:351-372` that enforces
 * v1.1.1 §5.5.2 + §8-7 (FORCED_RESET sub-mode → full redirect to /center).
 * Covers source-scope (/bty-arena/*, /bty/foundry/*), Center self-no-loop,
 * inactive fall-through, precedence vs contract block, and auth bypass.
 *
 * The 2C-1 helper `userHasForcedResetPending` is independently tested in
 * `src/lib/bty/leadership-engine/state-service.test.ts`; here it's mocked so
 * we drive the middleware branches directly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockForcedReset = vi.fn();
const mockBlockingContract = vi.fn();
const mockPipelineDefault = vi.fn();

vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  userHasForcedResetPending: (...args: unknown[]) => mockForcedReset(...args),
}));

vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  userHasBlockingArenaActionContract: (...args: unknown[]) => mockBlockingContract(...args),
}));

vi.mock("@/lib/bty/arena/arenaPipelineConfig", () => ({
  getArenaPipelineDefault: () => mockPipelineDefault(),
  getArenaSessionRouterPath: () => "/api/arena/n/session",
}));

vi.mock("@/lib/bty/arena/postLoginEliteEntry", () => ({
  isPostLoginOnboardingWizardEnabled: () => false,
}));

vi.mock("@/lib/bty/cookies/authCookies", () => ({
  AUTH_BASE: "sb-test-auth-token",
  AUTH_COOKIE_NAMES: [],
  authCookieSecureForRequest: () => false,
  reassertAuthCookiesPathRoot: () => {},
  writeSupabaseAuthCookies: () => {},
  expireAuthCookiesHard: () => {},
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            /** Consent gate satisfied (arena_profiles.consent_version set); other tables return null. */
            ({ data: { consent_version: "v1" }, error: null }),
        }),
      }),
    }),
  }),
}));

const SUPABASE_URL = "https://test.supabase.co";
const SUPABASE_KEY = "anon-test-key";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_KEY);
  mockForcedReset.mockReset();
  mockBlockingContract.mockReset();
  mockPipelineDefault.mockReset();
  mockPipelineDefault.mockReturnValue("legacy");
});

describe("middleware FORCED_RESET_PENDING — full redirect to /center (v1.1.1 §5.5.2 + §8-7)", () => {
  it("redirects /[locale]/bty-arena/play → /[locale]/center when forced-reset active (en)", async () => {
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty-arena/play");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/center");
    expect(res.headers.get("x-forced-reset")).toBe("redirect");
  });

  it("redirects /[locale]/bty-arena/* root → /[locale]/center when forced-reset active (ko)", async () => {
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/ko/bty-arena");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/ko/center");
  });

  it("redirects /[locale]/bty/foundry/* → /[locale]/center when forced-reset active (Foundry secondary block per v1.1.1 §5.4)", async () => {
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty/foundry/insights");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/center");
  });

  it("does NOT redirect /[locale]/center when forced-reset active (no infinite loop)", async () => {
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/center");
    const res = await middleware(req);
    expect(res.headers.get("x-forced-reset")).not.toBe("redirect");
    /** Target route — request must reach the page, not loop back to /center. */
    if (res.status >= 300 && res.status < 400) {
      expect(res.headers.get("location")).not.toBe("http://localhost/en/center");
    }
  });

  it("does NOT redirect when forced-reset inactive (falls through to normal handling)", async () => {
    mockForcedReset.mockResolvedValue(false);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty-arena/play");
    const res = await middleware(req);
    expect(res.headers.get("x-forced-reset")).not.toBe("redirect");
  });

  it("FORCED_RESET wins over blocking contract (HARD LOCKED precedence: forced-reset clause runs BEFORE contract clause)", async () => {
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(true);
    mockPipelineDefault.mockReturnValue("new");
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty-arena/play");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/center");
    /** Contract redirect target would be `/en/bty?arena_contract=resolve` — must NOT be reached. */
    expect(res.headers.get("location")).not.toContain("arena_contract=resolve");
    expect(res.headers.get("x-arena-contract-gate")).not.toBe("resolve");
  });

  it("does NOT redirect /[locale]/bty/login even when forced-reset active (auth path bypass)", async () => {
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty/login");
    const res = await middleware(req);
    /** /bty/login is outside the FORCED_RESET source scope; user must reach login. */
    expect(res.headers.get("x-forced-reset")).not.toBe("redirect");
    if (res.headers.get("location")) {
      expect(res.headers.get("location")).not.toBe("http://localhost/en/center");
    }
  });

  it("source-scope does NOT match /[locale]/bty (Foundry parent path without /foundry suffix)", async () => {
    /** Guard against an over-broad startsWith match — `/bty` (without `/foundry`) is not Foundry. */
    mockForcedReset.mockResolvedValue(true);
    mockBlockingContract.mockResolvedValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty/dashboard");
    const res = await middleware(req);
    expect(res.headers.get("x-forced-reset")).not.toBe("redirect");
  });
});
