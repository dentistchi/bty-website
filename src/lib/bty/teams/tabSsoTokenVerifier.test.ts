import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SignJWT,
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  type KeyLike,
  type JWTVerifyGetKey,
} from "jose";

/**
 * Teams TAB SSO token verification (Slice A0).
 *
 * Same rigour as the Bot Framework verifier tests, and for a sharper reason: these two token
 * classes look alike. A real RSA key pair signs real JWTs, served through a locally injected key
 * set, so the positive case is genuinely provable and every refusal therefore means something.
 *
 * Nothing here asserts on a decoded payload beyond the two claims the module is allowed to return.
 * The point is that a token which is not genuinely signed, not from the tenant it claims, not
 * addressed to THIS Application ID URI, or not currently valid is refused — and that a token
 * carrying an email, a upn or a sub but no `oid` identifies nobody.
 */

const TID = "11111111-1111-1111-1111-111111111111";
const OTHER_TID = "99999999-9999-9999-9999-999999999999";
const OID = "22222222-2222-2222-2222-222222222222";
const BOT_APP_ID = "820f231b-9dbb-4c84-94c5-65bc43d35d91";
const AUDIENCE = `api://arena.btydaily.com/botid-${BOT_APP_ID}`;
const ISSUER = `https://login.microsoftonline.com/${TID}/v2.0`;

let priv: KeyLike;
let pub: KeyLike;
let kid: string;
let jwks: JWTVerifyGetKey;

async function sign(
  over: {
    aud?: string;
    iss?: string;
    exp?: string | number;
    key?: KeyLike;
    claims?: Record<string, unknown>;
  } = {},
) {
  return new SignJWT({ tid: TID, oid: OID, ...(over.claims ?? {}) })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(over.exp ?? "5m")
    .sign(over.key ?? priv);
}

async function loadVerifier() {
  const { verifyTeamsTabSsoToken } = await import("@/lib/bty/teams/tabSsoTokenVerifier.server");
  return (auth: string | null, audience: string | null = AUDIENCE) =>
    verifyTeamsTabSsoToken(auth, audience, jwks);
}

beforeEach(async () => {
  const kp = await generateKeyPair("RS256");
  priv = kp.privateKey;
  pub = kp.publicKey;
  kid = "tab-key-1";
  const jwk = { ...(await exportJWK(pub)), kid, alg: "RS256", use: "sig" };
  jwks = createLocalJWKSet({ keys: [jwk] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyTeamsTabSsoToken — the accepted case", () => {
  it("accepts a correctly signed, tenant-issued, correctly addressed token", async () => {
    const verify = await loadVerifier();
    const r = await verify(`Bearer ${await sign()}`);
    expect(r).toEqual({ ok: true, identity: { tenantId: TID, aadObjectId: OID } });
  });

  it("returns ONLY tenantId and aadObjectId — no email, upn, name or sub ever escapes", async () => {
    const verify = await loadVerifier();
    const token = await sign({
      claims: {
        email: "founder@bty.example",
        preferred_username: "founder@bty.example",
        upn: "founder@bty.example",
        name: "The Founder",
        sub: "per-application-pairwise-subject",
      },
    });
    const r = await verify(`Bearer ${token}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.identity).sort()).toEqual(["aadObjectId", "tenantId"]);
    const serialized = JSON.stringify(r);
    for (const leak of ["founder@bty.example", "The Founder", "per-application-pairwise-subject"]) {
      expect(serialized).not.toContain(leak);
    }
  });
});

describe("verifyTeamsTabSsoToken — every refusal fails closed", () => {
  it("rejects a wrong ISSUER, even when the tenant claim looks right", async () => {
    const verify = await loadVerifier();
    // The Bot Framework issuer is the exact confusion this module exists to prevent.
    const r = await verify(`Bearer ${await sign({ iss: "https://api.botframework.com" })}`);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects /common as an issuer", async () => {
    const verify = await loadVerifier();
    const r = await verify(
      `Bearer ${await sign({ iss: "https://login.microsoftonline.com/common/v2.0" })}`,
    );
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a token whose tid names a DIFFERENT tenant than its issuer", async () => {
    // A forged tid selects a different tenant's issuer/keys — under which this token does not
    // validate. That is what makes the unverified pre-read safe.
    const verify = await loadVerifier();
    const r = await verify(`Bearer ${await sign({ claims: { tid: OTHER_TID } })}`);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a wrong AUDIENCE — a token for the bare bot app id is not a tab token", async () => {
    const verify = await loadVerifier();
    expect(await verify(`Bearer ${await sign({ aud: BOT_APP_ID })}`)).toEqual({
      ok: false,
      reason: "invalid_token",
    });
    expect(await verify(`Bearer ${await sign({ aud: "api://arena.btydaily.com/botid-other" })}`)).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("rejects an EXPIRED token", async () => {
    const verify = await loadVerifier();
    const r = await verify(`Bearer ${await sign({ exp: Math.floor(Date.now() / 1000) - 3600 })}`);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a BAD SIGNATURE — signed by a key the tenant does not publish", async () => {
    const other = await generateKeyPair("RS256");
    const verify = await loadVerifier();
    const r = await verify(`Bearer ${await sign({ key: other.privateKey })}`);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects an UNKNOWN kid — a rotated-away key is not a key", async () => {
    const other = await generateKeyPair("RS256");
    const strangerJwk = { ...(await exportJWK(other.publicKey)), kid: "not-published", alg: "RS256", use: "sig" };
    const { verifyTeamsTabSsoToken } = await import("@/lib/bty/teams/tabSsoTokenVerifier.server");
    const token = await new SignJWT({ tid: TID, oid: OID })
      .setProtectedHeader({ alg: "RS256", kid: "not-published" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(other.privateKey);
    // Verified against the key set that does NOT contain that kid — the live rotation case.
    const r = await verifyTeamsTabSsoToken(`Bearer ${token}`, AUDIENCE, jwks);
    expect(r.ok).toBe(false);
    // …and against a set that does contain it, it verifies — proving the refusal was about the key.
    const withStranger = createLocalJWKSet({ keys: [strangerJwk] });
    const r2 = await verifyTeamsTabSsoToken(`Bearer ${token}`, AUDIENCE, withStranger);
    expect(r2.ok).toBe(true);
  });

  it("rejects a token with NO tid before it fetches any key material", async () => {
    const verify = await loadVerifier();
    const token = await new SignJWT({ oid: OID })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(priv);
    expect(await verify(`Bearer ${token}`)).toEqual({ ok: false, reason: "missing_tenant" });
  });

  it("rejects a VERIFIED token that carries no oid — email/upn/sub are never a fallback", async () => {
    const verify = await loadVerifier();
    const token = await new SignJWT({
      tid: TID,
      email: "founder@bty.example",
      upn: "founder@bty.example",
      preferred_username: "founder@bty.example",
      sub: "per-application-pairwise-subject",
      name: "The Founder",
    })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(priv);
    expect(await verify(`Bearer ${token}`)).toEqual({ ok: false, reason: "missing_oid" });
  });

  it("rejects a token whose oid is not a GUID", async () => {
    const verify = await loadVerifier();
    const r = await verify(`Bearer ${await sign({ claims: { oid: "not-a-guid" } })}`);
    expect(r).toEqual({ ok: false, reason: "missing_oid" });
  });

  it("rejects a missing or non-bearer Authorization header", async () => {
    const verify = await loadVerifier();
    expect(await verify(null)).toEqual({ ok: false, reason: "missing_token" });
    expect(await verify("Basic abc")).toEqual({ ok: false, reason: "missing_token" });
    expect(await verify("Bearer   ")).toEqual({ ok: false, reason: "missing_token" });
  });

  it("rejects a malformed token, including alg:none, before any key is fetched", async () => {
    const verify = await loadVerifier();
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ tid: TID, oid: OID, aud: AUDIENCE })).toString("base64url");
    expect(await verify(`Bearer ${header}.${body}.`)).toEqual({ ok: false, reason: "malformed_token" });
    expect(await verify("Bearer not.a.jwt.at.all")).toEqual({ ok: false, reason: "malformed_token" });
  });

  it("fails closed when the Application ID URI is not configured", async () => {
    const verify = await loadVerifier();
    expect(await verify(`Bearer ${await sign()}`, null)).toEqual({ ok: false, reason: "not_configured" });
  });

  it("never logs the token, the tenant, the object id, or any personal claim", async () => {
    /*
      The contract CHANGED deliberately in A0-RUNTIME and this test says how. A rejection now
      reports the measured `aud` verbatim, because `aud` is OUR OWN resource identifier, already
      published in the Teams manifest, and it is the single value that distinguishes "Entra minted
      this for a different resource" from every other claim failure.

      Everything that identifies a PERSON or a TENANT is still forbidden, and that is what is
      asserted here: the raw token, `tid`, `oid`, and email/upn/name/sub.
    */
    const logged: unknown[] = [];
    (console.error as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void })
      .mockImplementation((...a: unknown[]) => logged.push(...a));
    const verify = await loadVerifier();
    const token = await sign({
      aud: "api://arena.btydaily.com/botid-other",
      claims: {
        email: "founder@bty.example",
        preferred_username: "founder@bty.example",
        upn: "founder@bty.example",
        name: "The Founder",
        sub: "per-application-pairwise-subject",
      },
    });
    await verify(`Bearer ${token}`);
    const dump = JSON.stringify(logged);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(TID);
    expect(dump).not.toContain(OID);
    for (const personal of [
      "founder@bty.example",
      "The Founder",
      "per-application-pairwise-subject",
    ]) {
      expect(dump).not.toContain(personal);
    }
  });

  it("reports the MEASURED audience, so a resource mismatch is readable in one line", async () => {
    const logged: unknown[] = [];
    (console.error as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void })
      .mockImplementation((...a: unknown[]) => logged.push(...a));
    const verify = await loadVerifier();
    // The exact real-world suspect: Entra issuing for the bare client id instead of the api:// URI.
    await verify(`Bearer ${await sign({ aud: BOT_APP_ID })}`);
    const dump = JSON.stringify(logged);
    expect(dump).toContain(`"aud":"${BOT_APP_ID}"`);
    expect(dump).toContain(`"expectedAud":"${AUDIENCE}"`);
    expect(dump).toContain('"issVersion":"v2.0"');
    expect(dump).toContain('"tidPresent":true');
    expect(dump).toContain('"oidPresent":true');
    expect(dump).toContain('"expired":false');
  });

  it("names a v1.0 issuer specifically, rather than calling it a claim failure", async () => {
    const logged: unknown[] = [];
    (console.error as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void })
      .mockImplementation((...a: unknown[]) => logged.push(...a));
    const verify = await loadVerifier();
    await verify(`Bearer ${await sign({ iss: `https://sts.windows.net/${TID}/` })}`);
    expect(JSON.stringify(logged)).toContain('"issVersion":"v1.0"');
  });

  it("reports an expired token as expired rather than as a mystery", async () => {
    const logged: unknown[] = [];
    (console.error as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void })
      .mockImplementation((...a: unknown[]) => logged.push(...a));
    const verify = await loadVerifier();
    await verify(`Bearer ${await sign({ exp: Math.floor(Date.now() / 1000) - 3600 })}`);
    expect(JSON.stringify(logged)).toContain('"expired":true');
  });
});

describe("tabSsoAudience — the Application ID URI is derived, never guessed", () => {
  it("builds the documented api:// shape from the bot app id", async () => {
    const { tabSsoAudience } = await import("@/lib/bty/teams/tabSsoTokenVerifier.server");
    expect(tabSsoAudience(BOT_APP_ID)).toBe(AUDIENCE);
    expect(tabSsoAudience(BOT_APP_ID.toUpperCase())).toBe(AUDIENCE);
  });

  it("returns null — and therefore fails closed — for an unconfigured or malformed app id", async () => {
    const { tabSsoAudience } = await import("@/lib/bty/teams/tabSsoTokenVerifier.server");
    for (const bad of [undefined, "", "   ", "not-a-guid", "820f231b"]) {
      expect(tabSsoAudience(bad)).toBeNull();
    }
  });
});
