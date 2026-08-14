/**
 * Middleware canonical-entry routing — Slice 3.1B-3E.3.
 *
 * arena.btydaily.com is the Arena APPLICATION origin. The root (`/`) and bare-locale
 * (`/en`, `/ko`) routes must enter the BtyDailyAppShell journey — `/{locale}/app` —
 * NOT the legacy LandingClient portal. Unauthenticated entry is produced by the existing
 * protected-route gate, which sends `/{locale}/app` → `/{locale}/bty/login?next=/{locale}/app`.
 *
 * Two auth states are exercised by swapping the getUser mock per describe block.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACTIVE_CONSENT_VERSION } from "@/domain/legal/consent-document";

const getUserMock = vi.fn();

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
vi.mock("@/lib/bty/arena/requireApprovedMembership", () => ({
  requireApprovedMembership: async () => ({ approved: true }),
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
    auth: { getUser: async () => getUserMock() },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { consent_version: ACTIVE_CONSENT_VERSION }, error: null }) }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  getUserMock.mockReset();
});

describe("canonical entry — UNAUTHENTICATED (enters login with next=/app)", () => {
  beforeEach(() => getUserMock.mockResolvedValue({ data: { user: null } }));

  it("`/` → /{locale}/app → login?next=/en/app (default en)", async () => {
    const { middleware } = await import("./middleware");
    // `/` resolves locale then redirects into the app shell.
    const root = await middleware(new NextRequest("http://localhost/"));
    expect(root.status).toBe(307);
    expect(root.headers.get("location")).toBe("http://localhost/en/app");
    // …and the protected gate turns that into the login route with the app-shell next.
    const app = await middleware(new NextRequest("http://localhost/en/app"));
    expect(app.headers.get("location")).toBe("http://localhost/en/bty/login?next=%2Fen%2Fapp");
  });

  it("`/` honors Accept-Language ko → /ko/app", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/", {
      headers: { "accept-language": "ko-KR,ko;q=0.9,en;q=0.8" },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/ko/app");
  });

  it("`/` honors NEXT_LOCALE cookie over Accept-Language", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/", {
      headers: { "accept-language": "en-US,en;q=0.9", cookie: "NEXT_LOCALE=ko" },
    });
    const res = await middleware(req);
    expect(res.headers.get("location")).toBe("http://localhost/ko/app");
  });

  it("`/en` (bare) → /en/app", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/app");
  });

  it("`/ko` (bare) → /ko/app", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/ko"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/ko/app");
  });

  it("`/en/` (trailing slash) → /en/app", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/"));
    expect(res.headers.get("location")).toBe("http://localhost/en/app");
  });

  it("unauthenticated /en/app produces login?next=/en/app (no loop)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/app"));
    expect(res.headers.get("location")).toBe("http://localhost/en/bty/login?next=%2Fen%2Fapp");
  });
});

describe("canonical entry — AUTHENTICATED (enters the app shell)", () => {
  beforeEach(() => getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } }));

  it("`/` → /en/app (renders shell, no further redirect)", async () => {
    const { middleware } = await import("./middleware");
    const root = await middleware(new NextRequest("http://localhost/"));
    expect(root.headers.get("location")).toBe("http://localhost/en/app");
    const app = await middleware(new NextRequest("http://localhost/en/app"));
    // Authenticated + consent set → passes through (no redirect Location).
    expect(app.headers.get("location")).toBeNull();
    expect(app.headers.get("x-mw-user")).toBe("1");
  });

  it("`/en` (bare) → /en/app then renders the shell", async () => {
    const { middleware } = await import("./middleware");
    const bare = await middleware(new NextRequest("http://localhost/en"));
    expect(bare.headers.get("location")).toBe("http://localhost/en/app");
  });

  it("deep app-shell query is preserved end-to-end (/en/app?tab=foundry passes through)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/app?tab=foundry"));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("canonical entry — deep routes untouched", () => {
  beforeEach(() => getUserMock.mockResolvedValue({ data: { user: null } }));

  it("`/en/bty/login` still renders (public, not redirected to /app)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/bty/login"));
    // login is public → passes through (unauthenticated), NOT bounced to /en/app.
    expect(res.headers.get("location")).toBeNull();
  });

  it("`/en/auth/callback` still public (not redirected)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/auth/callback?code=x"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("`/en/reset-password` still public (not redirected)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/reset-password"));
    expect(res.headers.get("location")).toBeNull();
  });
});
