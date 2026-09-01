import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * `requireUser` — TWO TRANSPORTS, ONE SESSION AUTHORITY (Slice A0).
 *
 * The bearer here is a SUPABASE ACCESS TOKEN, never a Microsoft one: the Entra token's authority
 * ends at `/api/auth/teams-bootstrap` and nothing else in the product learns to verify one.
 *
 * The claims that matter: the cookie path is byte-unchanged and is always tried first, a bearer
 * is only consulted when there is no cookie session, the client handed back carries the bearer so
 * downstream RLS reads act as that user, and no bearer means the existing 401 — unchanged.
 */

const getUserCookie = vi.fn();
const getUserBearer = vi.fn();
const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({ createServerClient: (...a: unknown[]) => createServerClient(...a) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock("@/lib/legal/activeConsent", () => ({
  isConsentCurrent: vi.fn(async () => true),
  consentRequiredResponse: () => new Response(null),
}));

const COOKIE_USER = { id: "cookie-user" };
const BEARER_USER = { id: "81f08aa1-0000-0000-0000-000000000000" };

/** Records the options each constructed client was given, so we can assert the bearer wiring. */
let constructed: Array<Record<string, unknown>>;

function req(headers: Record<string, string> = {}) {
  return new NextRequest("https://arena.btydaily.com/api/me/today/brief", { headers });
}

async function loadRequireUser() {
  const mod = await import("@/lib/supabase/route-client");
  return mod.requireUser;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  constructed = [];
  createServerClient.mockImplementation((_url: string, _key: string, opts: Record<string, unknown>) => {
    constructed.push(opts);
    const isBearerClient = Boolean(opts?.global);
    return {
      auth: {
        getUser: (jwt?: string) => (isBearerClient ? getUserBearer(jwt) : getUserCookie()),
      },
      __bearer: isBearerClient,
    };
  });
  getUserCookie.mockResolvedValue({ data: { user: null }, error: null });
  getUserBearer.mockResolvedValue({ data: { user: BEARER_USER }, error: null });
});

describe("requireUser — the cookie path is unchanged and always first", () => {
  it("returns the cookie user and NEVER builds a bearer client", async () => {
    getUserCookie.mockResolvedValue({ data: { user: COOKIE_USER }, error: null });
    const requireUser = await loadRequireUser();
    const gate = await requireUser(req({ authorization: "Bearer some-supabase-token" }));
    expect(gate.user).toEqual(COOKIE_USER);
    expect(getUserBearer).not.toHaveBeenCalled();
    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.global).toBeUndefined();
  });

  it("with no cookie and no bearer, still returns null — the existing 401, unchanged", async () => {
    const requireUser = await loadRequireUser();
    const gate = await requireUser(req());
    expect(gate.user).toBeNull();
    expect(constructed).toHaveLength(1);
  });
});

describe("requireUser — the Teams bearer path", () => {
  it("authenticates a Supabase access token when there is no cookie session", async () => {
    const requireUser = await loadRequireUser();
    const gate = await requireUser(req({ authorization: "Bearer supabase-access-token" }));
    expect(gate.user).toEqual(BEARER_USER);
    expect(getUserBearer).toHaveBeenCalledWith("supabase-access-token");
  });

  it("hands back a client that CARRIES the bearer, so downstream RLS reads act as that user", async () => {
    // `requireConsentedUser` passes this client to `isConsentCurrent`, which reads arena_profiles
    // under RLS. A client that could identify the user but not act as them would authenticate and
    // then read nothing.
    const requireUser = await loadRequireUser();
    const gate = await requireUser(req({ authorization: "Bearer supabase-access-token" }));
    expect((gate.supabase as unknown as { __bearer?: boolean }).__bearer).toBe(true);
    const bearerOpts = constructed.find((o) => o.global) as
      | { global?: { headers?: Record<string, string> } }
      | undefined;
    expect(bearerOpts?.global?.headers?.Authorization).toBe("Bearer supabase-access-token");
  });

  it("the bearer client sends NO cookies", async () => {
    const requireUser = await loadRequireUser();
    await requireUser(req({ authorization: "Bearer supabase-access-token" }));
    const bearerOpts = constructed.find((o) => o.global) as
      | { cookies?: { getAll: () => unknown[] } }
      | undefined;
    expect(bearerOpts?.cookies?.getAll()).toEqual([]);
  });

  it("a rejected bearer is still unauthenticated — it never falls back to anything", async () => {
    getUserBearer.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    const requireUser = await loadRequireUser();
    const gate = await requireUser(req({ authorization: "Bearer forged" }));
    expect(gate.user).toBeNull();
  });

  it("ignores a non-Bearer Authorization scheme", async () => {
    const requireUser = await loadRequireUser();
    const gate = await requireUser(req({ authorization: "Basic abc" }));
    expect(gate.user).toBeNull();
    expect(getUserBearer).not.toHaveBeenCalled();
  });
});
