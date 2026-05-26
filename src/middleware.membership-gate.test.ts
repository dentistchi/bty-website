/**
 * Middleware S2 Arena-entry membership gate.
 *
 * `/[locale]/bty-arena/*` requires an approved `arena_membership_requests` row;
 * unapproved (no row / pending / rejected) → 307 redirect to `/[locale]/my-page/team`.
 * The gate runs after consent + forced-reset and shares `requireApprovedMembership`
 * with the API entry points. forced-reset / contract / onboarding are mocked inactive
 * so we drive the membership branch directly; the real helper runs against the
 * mocked Supabase client.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockMembershipRow = vi.fn();

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

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            // arena_profiles → consent satisfied; arena_membership_requests → per-test.
            if (table === "arena_profiles") return { data: { consent_version: "v1" }, error: null };
            if (table === "arena_membership_requests") return mockMembershipRow();
            return { data: null, error: null };
          },
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  mockMembershipRow.mockReset();
  mockMembershipRow.mockReturnValue({ data: { status: "approved" }, error: null });
});

describe("middleware S2 membership gate — /[locale]/bty-arena/* requires approved membership", () => {
  it("passes an approved member through to Arena (no membership redirect)", async () => {
    mockMembershipRow.mockReturnValue({ data: { status: "approved" }, error: null });
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/bty-arena"));
    expect(res.headers.get("x-arena-membership")).not.toBe("required");
    const loc = res.headers.get("location");
    if (loc) expect(loc).not.toContain("/my-page/team");
  });

  it("redirects an unapproved user (no row) → /[locale]/my-page/team (307)", async () => {
    mockMembershipRow.mockReturnValue({ data: null, error: null });
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/bty-arena/play"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/my-page/team");
    expect(res.headers.get("x-arena-membership")).toBe("required");
  });

  it("redirects a pending user → /[locale]/my-page/team", async () => {
    mockMembershipRow.mockReturnValue({ data: { status: "pending" }, error: null });
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/bty-arena"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/my-page/team");
  });

  it("redirects a rejected user → /[locale]/my-page/team (ko)", async () => {
    mockMembershipRow.mockReturnValue({ data: { status: "rejected" }, error: null });
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/ko/bty-arena"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/ko/my-page/team");
  });

  it("does NOT membership-gate /my-page/team (the form target — no loop)", async () => {
    mockMembershipRow.mockReturnValue({ data: null, error: null });
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/my-page/team"));
    expect(res.headers.get("x-arena-membership")).not.toBe("required");
    const loc = res.headers.get("location");
    if (loc) expect(loc).not.toContain("/my-page/team");
  });

  it("does NOT membership-gate Foundry (/bty/foundry) — scoped to /bty-arena only", async () => {
    mockMembershipRow.mockReturnValue({ data: null, error: null });
    const { middleware } = await import("./middleware");
    const res = await middleware(new NextRequest("http://localhost/en/bty/foundry"));
    expect(res.headers.get("x-arena-membership")).not.toBe("required");
  });
});
