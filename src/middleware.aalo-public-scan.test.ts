/**
 * Scanner Public Access Fix — middleware aalo public-scan bypass.
 *
 * Spec v2 §3.5 (mvp_open principle 5): an external verifier scanning the
 * action-loop commit deep-link
 * `/[locale]/my-page?arena_action_loop=commit&aalo=…` must reach MyPage WITHOUT
 * a login wall (client renders the server snapshot; qr/validate enforces
 * semantics). All 3 conditions are required; general my-page or any missing
 * condition still hits the auth redirect, and the path regex is anchored so
 * subpaths do not leak the bypass.
 *
 * Logged-out is simulated via the Supabase mock returning `user: null`
 * (mirrors middleware.membership-gate.test.ts — no new test infra).
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

// Logged-out scanner: getUser resolves to no user, so the middleware redirects
// to the login wall UNLESS the aalo public-scan exception fires first.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
});

describe("middleware: aalo public-scan bypass (Scanner Public Access Fix)", () => {
  // 1. Spec restoration: logged-out scanner with all 3 conditions is allowed through.
  it("allows logged-out aalo commit deep-link (all 3 conditions)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(
      new NextRequest("http://localhost/en/my-page?arena_action_loop=commit&aalo=TOKEN"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  // 2. General my-page (no params) still hits the login wall (unchanged).
  it("redirects logged-out general my-page to login", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/my-page"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/bty/login");
  });

  // 3. aalo present but arena_action_loop missing → no bypass.
  it("redirects when aalo present but arena_action_loop missing", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/my-page?aalo=TOKEN"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/bty/login");
  });

  // 4. arena_action_loop=commit but aalo missing → no bypass.
  it("redirects when arena_action_loop=commit but aalo missing", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(
      new NextRequest("http://localhost/en/my-page?arena_action_loop=commit"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/bty/login");
  });

  // 5. Subpath is not anchored by the regex → no bypass (release safety).
  it("redirects my-page subpath even with full params (regex anchored)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(
      new NextRequest(
        "http://localhost/en/my-page/anything?arena_action_loop=commit&aalo=TOKEN",
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/bty/login");
  });

  // 6. Locale parity: ko scanner allowed too.
  it("allows logged-out ko aalo commit deep-link (locale parity)", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(
      new NextRequest("http://localhost/ko/my-page?arena_action_loop=commit&aalo=TOKEN"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
