import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/auth/teams-bootstrap — ordering IS the security model (Slice A0).
 *
 * The claims that matter here are not "does it return a session", but: nothing downstream runs
 * before the Teams token verifies, the session that comes back belongs to the user the RESOLVER
 * chose, an unresolved Microsoft user causes NO write of any kind, and no client-supplied field
 * can influence any of it.
 */

const verifyTeamsTabSsoToken = vi.fn();
const resolveBtyUserFromMicrosoftIdentity = vi.fn();
const getUserById = vi.fn();
const generateLink = vi.fn();
const verifyOtp = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/bty/teams/tabSsoTokenVerifier.server", () => ({ verifyTeamsTabSsoToken }));
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({
  resolveBtyUserFromMicrosoftIdentity,
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { getUserById, generateLink } }, rpc }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { verifyOtp } }),
}));

const TID = "11111111-1111-1111-1111-111111111111";
const OID = "22222222-2222-2222-2222-222222222222";
const USER = "81f08aa1-0000-0000-0000-000000000000";
const OTHER_USER = "deadbeef-0000-0000-0000-000000000000";

function req(body?: unknown) {
  return new NextRequest("https://arena.btydaily.com/api/auth/teams-bootstrap", {
    method: "POST",
    headers: { authorization: "Bearer teams-entra-token", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function POST(r: NextRequest) {
  const mod = await import("@/app/api/auth/teams-bootstrap/route");
  return mod.POST(r);
}

const SESSION = {
  access_token: "supabase-access",
  refresh_token: "supabase-refresh",
  expires_in: 3600,
  expires_at: 1_800_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyTeamsTabSsoToken.mockResolvedValue({ ok: true, identity: { tenantId: TID, aadObjectId: OID } });
  resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "RESOLVED", userId: USER });
  getUserById.mockResolvedValue({ data: { user: { id: USER, email: "founder@bty.example" } }, error: null });
  generateLink.mockResolvedValue({
    data: { user: { id: USER }, properties: { hashed_token: "one-time-hash" } },
    error: null,
  });
  verifyOtp.mockResolvedValue({ data: { user: { id: USER }, session: SESSION }, error: null });
  rpc.mockResolvedValue({ data: [{ bound: 0 }], error: null });
});

describe("teams-bootstrap — RESOLVED", () => {
  it("returns a session, and only session material", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ session: SESSION });
    // No email, no magic link, no hashed token, no identity claims ever reach the client.
    const dump = JSON.stringify(body);
    for (const leak of ["founder@bty.example", "one-time-hash", TID, OID, USER, "action_link"]) {
      expect(dump).not.toContain(leak);
    }
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("verifies the Teams token BEFORE anything downstream runs", async () => {
    verifyTeamsTabSsoToken.mockResolvedValue({ ok: false, reason: "invalid_token" });
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(resolveBtyUserFromMicrosoftIdentity).not.toHaveBeenCalled();
    expect(getUserById).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("resolves on tid + oid only, and reads the email from the RESOLVED id", async () => {
    await POST(req());
    expect(resolveBtyUserFromMicrosoftIdentity).toHaveBeenCalledWith(expect.anything(), TID, OID);
    expect(getUserById).toHaveBeenCalledWith(USER);
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "founder@bty.example" });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time-hash", type: "email" });
  });

  it("ignores every identity field a client tries to supply", async () => {
    const res = await POST(
      req({ user_id: OTHER_USER, userId: OTHER_USER, email: "attacker@evil.test", tenantId: "x", oid: "y" }),
    );
    expect(res.status).toBe(200);
    expect(resolveBtyUserFromMicrosoftIdentity).toHaveBeenCalledWith(expect.anything(), TID, OID);
    expect(getUserById).toHaveBeenCalledWith(USER);
    const linkArg = JSON.stringify(generateLink.mock.calls[0]?.[0]);
    expect(linkArg).not.toContain("attacker@evil.test");
    expect(linkArg).not.toContain(OTHER_USER);
  });

  it("REFUSES when the generated link addressed a different user", async () => {
    generateLink.mockResolvedValue({
      data: { user: { id: OTHER_USER }, properties: { hashed_token: "h" } },
      error: null,
    });
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("REFUSES when the minted session belongs to a different user", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: OTHER_USER }, session: SESSION }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "bootstrap_failed" });
  });

  it("fails closed when the resolved user has no addressable email — never looks a user up BY email", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: USER, email: null } }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(generateLink).not.toHaveBeenCalled();
  });
});

describe("teams-bootstrap — announcement binding (Slice A1)", () => {
  it("binds recipient rows frozen for THIS Microsoft identity, using the resolved user", async () => {
    await POST(req());
    expect(rpc).toHaveBeenCalledWith("bty_bind_announcement_recipients", {
      p_user_id: USER,
      p_tenant_id: TID,
      p_aad_object_id: OID,
    });
  });

  it("a failed binding NEVER fails the sign-in", async () => {
    // A person's ability to open BTY must not depend on an announcement lookup.
    rpc.mockResolvedValue({ data: null, error: { code: "42P01", message: "boom" } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session: SESSION });
  });

  it("does NOT bind for someone with no BTY account — a recipient row is not an account", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "NOT_LINKED" });
    await POST(req());
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("teams-bootstrap — NOT_LINKED writes nothing", () => {
  it("returns needsFirstSignIn and touches no auth state", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "NOT_LINKED" });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ needsFirstSignIn: true });
    // No user creation, no link, no session. The person simply has not signed in yet.
    expect(getUserById).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("teams-bootstrap — ambiguous and failed lookups fail closed", () => {
  it("refuses an ambiguous identity rather than choosing an owner", async () => {
    resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status: "AMBIGUOUS_IDENTITY", matched: 2 });
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("refuses a broken lookup", async () => {
    for (const status of ["LOOKUP_FAILED", "INVALID_INPUT"]) {
      vi.clearAllMocks();
      verifyTeamsTabSsoToken.mockResolvedValue({ ok: true, identity: { tenantId: TID, aadObjectId: OID } });
      resolveBtyUserFromMicrosoftIdentity.mockResolvedValue({ status });
      const res = await POST(req());
      expect(res.status).toBe(503);
      expect(generateLink).not.toHaveBeenCalled();
    }
  });
});

describe("teams-bootstrap — throttling reaches the tab as 429", () => {
  it("maps a rate-limited generateLink to 429, not 500", async () => {
    generateLink.mockResolvedValue({ data: null, error: { status: 429, message: "rate limit" } });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("maps a rate-limited verifyOtp to 429 and returns no session", async () => {
    verifyOtp.mockResolvedValue({ data: null, error: { status: 429, message: "rate limit" } });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(JSON.stringify(await res.json())).not.toContain("access_token");
  });

  it("a non-429 refusal is NOT reported as throttling", async () => {
    verifyOtp.mockResolvedValue({ data: null, error: { status: 403, message: "expired" } });
    const res = await POST(req());
    expect(res.status).toBe(503);
  });
});
