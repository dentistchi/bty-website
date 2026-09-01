import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The second transport, at the factory the INLINE-auth routes use (Slice A0-RUNTIME2).
 *
 * WHY THIS FILE EXISTS. A0 taught `requireUser` to accept a Supabase access token, which covered
 * the 111 routes that compose it — and missed the 78 that authenticate inline with their own
 * `supabase.auth.getUser()`. 74 of those build their client in `supabase-server.ts`. In the Teams
 * tab, which carries no cookie by construction, all 74 returned 401; the Founder saw two of them
 * (the account row and This week) and would have met 72 more.
 *
 * The claims: the cookie path is unchanged and always first, a bearer is only consulted when the
 * cookie yields nothing, an explicit `getUser(jwt)` is never second-guessed, and the client keeps
 * the bearer globally so the RLS reads these routes actually perform act as that user.
 */

const createServerClient = vi.fn();
const getUser = vi.fn();
let headerStore: Record<string, string>;
let cookieList: { name: string; value: string }[];

vi.mock("@supabase/ssr", () => ({ createServerClient: (...a: unknown[]) => createServerClient(...a) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => cookieList }),
  headers: async () => ({ get: (k: string) => headerStore[k.toLowerCase()] ?? null }),
}));

const COOKIE_USER = { id: "cookie-user" };
const BEARER_USER = { id: "81f08aa1-44a2-40b1-9190-7866151461a7" };

/** Options each constructed client received, so the bearer wiring can be asserted. */
let constructed: Array<Record<string, unknown>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  headerStore = {};
  cookieList = [];
  constructed = [];
  createServerClient.mockImplementation((_u: string, _k: string, opts: Record<string, unknown>) => {
    constructed.push(opts);
    return { auth: { getUser } };
  });
});

async function load() {
  return import("@/lib/supabase-server");
}

describe("getSupabaseServer — the cookie path is untouched", () => {
  it("returns the cookie user and never consults a bearer", async () => {
    headerStore.authorization = "Bearer supabase-access-token";
    getUser.mockResolvedValue({ data: { user: COOKIE_USER }, error: null });
    const { getSupabaseServer } = await load();
    const supabase = await getSupabaseServer();
    const r = await supabase.auth.getUser();
    expect(r.data.user).toEqual(COOKIE_USER);
    // One call: the cookie answered, so the fallback never ran.
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith();
  });

  it("with no cookie and NO bearer, still returns null — the existing 401, unchanged", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { getSupabaseServer } = await load();
    const supabase = await getSupabaseServer();
    expect((await supabase.auth.getUser()).data.user).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
    // No bearer means no global header — a plain web request is byte-identical to before.
    expect(constructed[0]?.global).toBeUndefined();
  });
});

describe("getSupabaseServer — the Teams bearer path", () => {
  it("falls back to the bearer when the cookie yields nothing", async () => {
    headerStore.authorization = "Bearer supabase-access-token";
    getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: BEARER_USER }, error: null });
    const { getSupabaseServer } = await load();
    const supabase = await getSupabaseServer();
    const r = await supabase.auth.getUser();
    expect(r.data.user).toEqual(BEARER_USER);
    expect(getUser).toHaveBeenNthCalledWith(1);
    expect(getUser).toHaveBeenNthCalledWith(2, "supabase-access-token");
  });

  it("carries the bearer GLOBALLY, so these routes' RLS reads act as that user", async () => {
    // These 74 routes keep using the same client for real work after authenticating.
    headerStore.authorization = "Bearer supabase-access-token";
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { getSupabaseServer } = await load();
    await getSupabaseServer();
    const opts = constructed[0] as { global?: { headers?: Record<string, string> } };
    expect(opts.global?.headers?.Authorization).toBe("Bearer supabase-access-token");
  });

  it("passes an EXPLICIT getUser(jwt) straight through", async () => {
    headerStore.authorization = "Bearer supabase-access-token";
    getUser.mockResolvedValue({ data: { user: BEARER_USER }, error: null });
    const { getSupabaseServer } = await load();
    const supabase = await getSupabaseServer();
    await supabase.auth.getUser("caller-chosen-jwt");
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith("caller-chosen-jwt");
  });

  it("ignores a non-Bearer Authorization scheme", async () => {
    headerStore.authorization = "Basic abc";
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { getSupabaseServer } = await load();
    const supabase = await getSupabaseServer();
    expect((await supabase.auth.getUser()).data.user).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(constructed[0]?.global).toBeUndefined();
  });
});

describe("getSupabaseServerWithCookieCapture — the same transport, for /api/auth/session", () => {
  function req(headers: Record<string, string> = {}) {
    return new NextRequest("https://arena.btydaily.com/api/auth/session", { headers });
  }

  it("falls back to the bearer — this is the route the account row reads", async () => {
    getUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: BEARER_USER }, error: null });
    const { getSupabaseServerWithCookieCapture } = await load();
    const { supabase } = await getSupabaseServerWithCookieCapture(
      req({ authorization: "Bearer supabase-access-token" }),
    );
    expect((await supabase.auth.getUser()).data.user).toEqual(BEARER_USER);
  });

  it("leaves the cookie path first and unchanged", async () => {
    getUser.mockResolvedValue({ data: { user: COOKIE_USER }, error: null });
    const { getSupabaseServerWithCookieCapture } = await load();
    const { supabase } = await getSupabaseServerWithCookieCapture(
      req({ authorization: "Bearer supabase-access-token" }),
    );
    expect((await supabase.auth.getUser()).data.user).toEqual(COOKIE_USER);
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
