/**
 * Bot Framework token verification — the security boundary of the Teams path. Slice T1.
 *
 * Everything else in this integration trusts what this module returns, so this is the one place
 * where "the request says so" becomes "Microsoft signed it". Until `verifyBotFrameworkToken`
 * succeeds, the tenant id, the `aadObjectId` and the message payload in the body are all just
 * attacker-supplied strings — the route verifies BEFORE it parses, never the other way round.
 *
 * WHY `jose` AND NOT A HAND-ROLLED CHECK. Signature verification, JWKS fetching and key rotation
 * are exactly the things that look simple and are not. `jose` is already a dependency of this app,
 * runs on the Cloudflare Worker runtime the rest of BTY deploys to, and caches + rotates the
 * remote key set itself. The Bot Builder SDK would do the same job while pulling in a large
 * Node-shaped dependency for one function.
 *
 * WHAT IS CHECKED, ALL OF IT REQUIRED:
 *   signature   against Microsoft's published Bot Framework signing keys (JWKS, rotating)
 *   issuer      https://api.botframework.com
 *   audience    THIS bot's Microsoft App ID — a token minted for another bot is not ours
 *   expiry      enforced by `jose` (`exp`, with a small clock tolerance)
 *
 * WHAT IS NEVER LOGGED: the token, any header, any claim value, the app id, or any Microsoft
 * identifier. Failures log a short stable reason and nothing else — a rejected request must not
 * become a place where credentials are written down.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

/** Microsoft's OpenID metadata for tokens the Bot Framework issues to a bot. */
const BOT_OPENID_CONFIG = "https://login.botframework.com/v1/.well-known/openidconfiguration";
/** The only issuer this route accepts. */
export const BOT_FRAMEWORK_ISSUER = "https://api.botframework.com";
/** Small tolerance for clock skew between Microsoft and the edge. */
const CLOCK_TOLERANCE_SECONDS = 60;

export type BotTokenVerification =
  | { ok: true; payload: JWTPayload }
  | { ok: false; reason: "not_configured" | "missing_token" | "malformed_token" | "invalid_token" };

/**
 * The JWKS location is published by Microsoft and MAY rotate, so it is discovered rather than
 * pinned. Both the discovery result and the key set are cached for the life of the isolate;
 * `jose` re-fetches keys on its own when it meets an unknown `kid`.
 */
let jwksPromise: Promise<ReturnType<typeof createRemoteJWKSet>> | null = null;

async function getJwks() {
  if (!jwksPromise) {
    jwksPromise = (async () => {
      const res = await fetch(BOT_OPENID_CONFIG);
      if (!res.ok) throw new Error("openid_config_unavailable");
      const conf = (await res.json()) as { jwks_uri?: unknown };
      const uri = typeof conf.jwks_uri === "string" ? conf.jwks_uri : "";
      if (!uri) throw new Error("jwks_uri_missing");
      return createRemoteJWKSet(new URL(uri));
    })().catch((e) => {
      // A failed discovery must not poison the isolate forever — the next request retries.
      jwksPromise = null;
      throw e;
    });
  }
  return jwksPromise;
}

/** Pull the bearer token out of an Authorization header without logging it. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  const t = m?.[1]?.trim();
  return t ? t : null;
}

/**
 * Verify a Bot Framework token. Fails CLOSED on every path, including a missing app id: an
 * unconfigured deployment must reject Teams traffic, never accept it unverified.
 */
export async function verifyBotFrameworkToken(
  authorizationHeader: string | null,
  botAppId: string | undefined,
  /**
   * The key resolver. Production omits it and gets Microsoft's live, rotating key set.
   *
   * It is injectable ONLY so tests can supply a local key set and exercise the checks this module
   * actually owns — signature, issuer, audience, expiry — against real signed tokens. Fetching and
   * caching a remote JWKS is `jose`'s behaviour, not ours, and a test that stubs global `fetch`
   * silently fails to intercept it: the request reaches Microsoft, returns real keys, and every
   * assertion still "passes" because everything is rejected. Injection makes the positive case
   * genuinely provable, which is what gives the negative cases their meaning.
   */
  keyResolver?: JWTVerifyGetKey,
): Promise<BotTokenVerification> {
  const audience = (botAppId ?? "").trim();
  if (!audience) {
    console.error("[teams-invoke] rejected: bot app id not configured");
    return { ok: false, reason: "not_configured" };
  }

  const token = bearerToken(authorizationHeader);
  if (!token) return { ok: false, reason: "missing_token" };
  // Three dot-separated segments. An `alg: none` token has an empty signature and dies here
  // before any key material is fetched.
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    console.error("[teams-invoke] rejected: malformed token");
    return { ok: false, reason: "malformed_token" };
  }

  try {
    const jwks = keyResolver ?? (await getJwks());
    const { payload } = await jwtVerify(token, jwks, {
      issuer: BOT_FRAMEWORK_ISSUER,
      audience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    return { ok: true, payload };
  } catch (e) {
    // `jose` error codes are stable and say nothing secret (e.g. ERR_JWT_EXPIRED).
    const code = (e as { code?: unknown })?.code;
    console.error("[teams-invoke] rejected: token verification failed", {
      code: typeof code === "string" ? code : "unknown",
    });
    return { ok: false, reason: "invalid_token" };
  }
}
