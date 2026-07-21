/**
 * Middleware authenticated-login `next` preservation — Slice 3.1B-3E.2.
 *
 * Tests the branch at `src/middleware.ts` where an ALREADY-authenticated user hits
 * `/[locale]/bty/login`. Previously it hard-redirected to `/[locale]/bty`, DROPPING
 * `next` — the FAIL surface for the installed-app sign-out → sign-in round trip
 * (native cookie-propagation race bounces `/app` back to the login page with `next`
 * preserved, then this branch discarded it → landed on `/en/bty`).
 *
 * The fix: honor the sanitized `next` via the single shared safe-next resolver,
 * falling back to `/{locale}/bty` only when no valid app path is present.
 *
 * `sanitizeNextForRedirect` is the real (pure) resolver — not mocked — and is
 * independently covered in `src/lib/auth/sanitize-next-for-redirect.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  userHasForcedResetPending: async () => false,
}));

vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  userHasBlockingArenaActionContract: async () => false,
}));

vi.mock("@/lib/bty/arena/arenaPipelineConfig", () => ({
  getArenaPipelineDefault: () => "legacy",
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

/** Authenticated session: getUser returns a user so the login branch fires the redirect. */
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { consent_version: "v1" }, error: null }) }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
});

describe("middleware — authenticated user on /bty/login preserves safe `next`", () => {
  it("redirects to the installed-app Me tab (/en/app?tab=me) instead of /en/bty", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest(
      "http://localhost/en/bty/login?next=" + encodeURIComponent("/en/app?tab=me") + "&switch=1",
    );
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/en/app?tab=me");
  });

  it("preserves the account-switch Foundry return (/en/app?tab=foundry)", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest(
      "http://localhost/en/bty/login?next=" + encodeURIComponent("/en/app?tab=foundry"),
    );
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/en/app?tab=foundry");
  });

  it("preserves query strings through locale normalization (ko)", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest(
      "http://localhost/ko/bty/login?next=" + encodeURIComponent("/ko/app?tab=me"),
    );
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/ko/app?tab=me");
  });

  it("falls back to /{locale}/bty when no next is present (normal direct login — unchanged)", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/en/bty/login");
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/en/bty");
  });

  it("rejects an external/absolute next and falls back to /{locale}/bty", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest(
      "http://localhost/en/bty/login?next=" + encodeURIComponent("https://evil.com/steal"),
    );
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/en/bty");
  });

  it("rejects a protocol-relative next and falls back to /{locale}/bty", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest(
      "http://localhost/en/bty/login?next=" + encodeURIComponent("//evil.com"),
    );
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/en/bty");
  });

  it("rejects a login-loop next (/bty/login) and falls back to /{locale}/bty", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest(
      "http://localhost/en/bty/login?next=" + encodeURIComponent("/en/bty/login"),
    );
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/en/bty");
  });
});
