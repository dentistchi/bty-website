/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithOAuth = vi.fn(async (_opts: unknown) => ({ data: {}, error: null as null | { message: string } }));
vi.mock("@/lib/supabase", () => ({
  supabase: {}, // supabaseMaybe truthy = configured
  getSupabase: () => ({ auth: { signInWithOAuth } }),
}));
vi.mock("./isNative", () => ({ isNative: () => false }));
vi.mock("./durableSession", () => ({ storeNativeSession: vi.fn() }));

import { startGoogleOAuth } from "./googleOAuth";

describe("startGoogleOAuth (web)", () => {
  beforeEach(() => signInWithOAuth.mockClear());

  it("(3)(4) launches Google directly with prompt=select_account + a next-carrying callback redirectTo", async () => {
    const r = await startGoogleOAuth({ locale: "en", nextPath: "/en/app?tab=today", forceAccountSelection: true });
    expect(r).toEqual({ status: "redirecting" });
    const arg = signInWithOAuth.mock.calls[0][0] as {
      provider: string;
      options: { queryParams: { prompt: string }; redirectTo: string };
    };
    expect(arg.provider).toBe("google");
    expect(arg.options.queryParams.prompt).toBe("select_account");
    expect(arg.options.redirectTo).toContain("/en/auth/callback?next=");
    expect(decodeURIComponent(arg.options.redirectTo)).toContain("/en/app?tab=today");
  });

  it("(5)(6) a provider error returns 'error' (the current session is never torn down here)", async () => {
    signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: "provider boom" } });
    const r = await startGoogleOAuth({ locale: "en", nextPath: "/en/app?tab=today" });
    expect(r.status).toBe("error");
  });
});
