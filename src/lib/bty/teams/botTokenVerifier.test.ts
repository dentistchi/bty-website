import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, type KeyLike, type JWTVerifyGetKey } from "jose";

/**
 * Bot Framework token verification — the security boundary of the Teams path.
 *
 * These tests use a REAL RSA key pair and a real signed JWT, served through a stubbed JWKS
 * endpoint. Nothing here asserts on a decoded payload: the point is that a token which is not
 * genuinely signed by the published key, not addressed to THIS bot, or not currently valid is
 * refused — which a decode-only implementation would happily accept.
 */

const ISSUER = "https://api.botframework.com";
const BOT_APP_ID = "00000000-0000-0000-0000-00000000beef";
const JWKS_URI = "https://login.botframework.com/v1/.well-known/keys";

let priv: KeyLike;
let pub: KeyLike;
let kid: string;

async function sign(over: {
  aud?: string;
  iss?: string;
  exp?: string | number;
  key?: KeyLike;
} = {}) {
  return new SignJWT({ serviceUrl: "https://smba.trafficmanager.net/teams/" })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? BOT_APP_ID)
    .setIssuedAt()
    .setExpirationTime(over.exp ?? "5m")
    .sign(over.key ?? priv);
}

/** The published key set, served locally so the positive case is genuinely provable. */
let jwks: JWTVerifyGetKey;

async function loadVerifier() {
  const { verifyBotFrameworkToken } = await import("@/lib/bty/teams/botTokenVerifier.server");
  return (auth: string | null, appId: string | undefined) => verifyBotFrameworkToken(auth, appId, jwks);
}

beforeEach(async () => {
  const kp = await generateKeyPair("RS256");
  priv = kp.privateKey;
  pub = kp.publicKey;
  kid = "test-key-1";
  const jwk = { ...(await exportJWK(pub)), kid, alg: "RS256", use: "sig" };
  jwks = createLocalJWKSet({ keys: [jwk] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyBotFrameworkToken", () => {
  it("accepts a correctly signed, correctly addressed, unexpired token", async () => {
    const verify = await loadVerifier();
    const r = await verify(`Bearer ${await sign()}`, BOT_APP_ID);
    expect(r.ok).toBe(true);
  });

  it("rejects a token minted for a DIFFERENT bot (wrong audience)", async () => {
    const verify = await loadVerifier();
    const token = await sign({ aud: "11111111-1111-1111-1111-111111111111" });
    const r = await verify(`Bearer ${token}`, BOT_APP_ID);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects an expired token", async () => {
    const verify = await loadVerifier();
    // Well beyond the 60s clock tolerance.
    const token = await sign({ exp: Math.floor(Date.now() / 1000) - 3600 });
    const r = await verify(`Bearer ${token}`, BOT_APP_ID);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a token from an untrusted issuer", async () => {
    const verify = await loadVerifier();
    const token = await sign({ iss: "https://evil.example.com" });
    const r = await verify(`Bearer ${token}`, BOT_APP_ID);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a token signed by a key Microsoft does not publish", async () => {
    const verify = await loadVerifier();
    const attacker = await generateKeyPair("RS256");
    const token = await sign({ key: attacker.privateKey });
    const r = await verify(`Bearer ${token}`, BOT_APP_ID);
    expect(r).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects an unsigned (alg:none) token", async () => {
    const verify = await loadVerifier();
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ iss: ISSUER, aud: BOT_APP_ID })).toString("base64url");
    const r = await verify(`Bearer ${header}.${body}.`, BOT_APP_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const verify = await loadVerifier();
    for (const bad of ["Bearer not-a-jwt", "Bearer a.b", "Bearer ..", "Bearer a..c"]) {
      const r = await verify(bad, BOT_APP_ID);
      expect(r).toEqual({ ok: false, reason: "malformed_token" });
    }
  });

  it("rejects a missing or non-bearer Authorization header", async () => {
    const verify = await loadVerifier();
    expect(await verify(null, BOT_APP_ID)).toEqual({ ok: false, reason: "missing_token" });
    expect(await verify("Basic abc", BOT_APP_ID)).toEqual({ ok: false, reason: "missing_token" });
  });

  it("FAILS CLOSED when the bot app id is not configured — never open", async () => {
    const verify = await loadVerifier();
    const token = await sign();
    expect(await verify(`Bearer ${token}`, undefined)).toEqual({ ok: false, reason: "not_configured" });
    expect(await verify(`Bearer ${token}`, "   ")).toEqual({ ok: false, reason: "not_configured" });
  });

  it("never writes the token or a claim value to the log", async () => {
    const verify = await loadVerifier();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = await sign({ aud: "11111111-1111-1111-1111-111111111111" });
    await verify(`Bearer ${token}`, BOT_APP_ID);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(BOT_APP_ID);
    expect(logged).not.toContain("11111111-1111-1111-1111-111111111111");
  });
});
