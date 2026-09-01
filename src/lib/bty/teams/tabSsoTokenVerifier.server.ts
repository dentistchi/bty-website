/**
 * Teams TAB SSO token verification — the security boundary of the Personal App. Slice A0.
 *
 * THIS IS NOT `botTokenVerifier.server.ts`, AND THE TWO MUST NEVER BE MERGED.
 *
 * Teams hands BTY two Microsoft-signed JWTs that look alike and are not interchangeable:
 *
 *   Bot Framework invoke JWT      iss https://api.botframework.com
 *                                 aud the bot's Microsoft App ID (a bare GUID)
 *                                 keys login.botframework.com/v1/.well-known/keys
 *
 *   Teams TAB SSO Entra JWT       iss https://login.microsoftonline.com/{tid}/v2.0
 *                                 aud THIS app under either spelling — the bare client id (what a
 *                                     v2.0 token actually carries, measured on device) or the
 *                                     Application ID URI. See `tabSsoAudiences`.
 *                                 keys the TENANT's own OIDC discovery document
 *
 * They share a bot App ID and nothing else. Verifying a tab token with the bot verifier would
 * check the wrong issuer against the wrong key set for the wrong audience, and the failure mode
 * is not a rejection — it is accepting a token minted for a different purpose. So this module
 * exists separately, is named for what it verifies, and duplicates ~40 lines rather than sharing
 * a "flexible" verifier that could be pointed at either.
 *
 * TENANT-PINNED ISSUER. The issuer contains the tenant id, which the caller does not supply and
 * which we cannot know before reading the token. So the token is decoded ONCE, unverified, purely
 * to read `tid` — and that value is then used to construct the issuer and the discovery URL the
 * signature is checked against. A forged `tid` therefore selects a DIFFERENT tenant's key set,
 * under which the forged token's signature does not validate. The unverified read chooses which
 * authority to ask; it never becomes an answer. `/common` is deliberately never used: Microsoft
 * documents that it can return home-tenant tokens rather than tokens for the tenant the user is
 * signed into.
 *
 * WHAT IS RETURNED: `{ tenantId, aadObjectId }` and nothing else.
 *
 * WHAT IS NEVER RETURNED AND NEVER TRUSTED FOR IDENTITY: `email`, `preferred_username`, `upn`,
 * `name`, `sub`. `sub` in particular is per-application — the Supabase Azure app and this bot app
 * receive different `sub` values for the same person (measured, R1C-B-1a) — so it identifies an
 * application's view of a user, never a user. `oid` is the claim Microsoft documents as unique
 * across applications, and it is the only one this module reads as identity.
 *
 * WHAT IS NEVER LOGGED: the token, any header, `email`, `preferred_username`, `upn`, `name`,
 * `sub`, or the tenant and object ids themselves. A REJECTION additionally reports the measured
 * `aud` — our own resource identifier, already published in the manifest — plus the issuer VERSION
 * and three booleans, because the `jose` error code alone cannot distinguish a wrong audience from
 * a wrong issuer and that ambiguity cost a device cycle exactly once. See `rejectionShape`.
 *
 * FAILS CLOSED on every path, including an unconfigured deployment.
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Small tolerance for clock skew between Microsoft and the edge. */
const CLOCK_TOLERANCE_SECONDS = 60;

/**
 * The host the tab is served from. It appears inside the Application ID URI, and Microsoft
 * requires it to equal the app's own domain ("multiple domains per app aren't supported").
 * Overridable only so a non-production host can be verified against its own registration.
 */
const TAB_HOST = (process.env.TEAMS_TAB_SSO_HOST ?? "arena.btydaily.com").trim().toLowerCase();

/** GUID shape — the only thing a tenant id or an Entra object id can be. */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type TabSsoIdentity = { tenantId: string; aadObjectId: string };

export type TabSsoVerification =
  | { ok: true; identity: TabSsoIdentity }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "missing_token"
        | "malformed_token"
        | "missing_tenant"
        | "invalid_token"
        | "missing_oid";
    };

/**
 * The Application ID URI this deployment accepts as the audience.
 *
 * Built from the SAME bot App ID the invoke route already verifies against, in the exact shape
 * Microsoft documents for an app that carries a bot, a message extension and a tab:
 * `api://<fully-qualified-domain-name>/botid-<botAppId>`. Returns null when unconfigured, which
 * makes every verification fail closed rather than fall back to a permissive audience.
 */
export function tabSsoAudience(botAppId: string | undefined = process.env.TEAMS_BOT_APP_ID): string | null {
  const id = (botAppId ?? "").trim().toLowerCase();
  if (!GUID.test(id)) return null;
  return `api://${TAB_HOST}/botid-${id}`;
}

/**
 * THE TWO SPELLINGS OF THE SAME RESOURCE — corrected on device evidence (Slice A0-RUNTIME).
 *
 * A0 accepted only the Application ID URI, on the strength of Microsoft's Teams tab SSO article,
 * and shipped a test asserting that a token addressed to the bare bot app id "is not a tab token".
 * The first real launch disproved it. The Founder's live token verified its SIGNATURE against the
 * tenant's own published keys, carried `iss` `.../v2.0`, a valid `tid`, a valid `oid` and a future
 * `exp` — and was refused for one reason:
 *
 *     expectedAud  api://arena.btydaily.com/botid-820f231b-…
 *     aud          820f231b-…                                  ← what Entra actually issued
 *
 * That is documented identity-platform behaviour, not a misconfiguration: a **v2.0** access token
 * carries the resource application's **client ID** in `aud`, whereas a v1.0 token carries the App
 * ID URI. `requestedAccessTokenVersion: 2` is required for Teams SSO, so the GUID form is the
 * NORMAL case and the URI form was the guess.
 *
 * WHY ACCEPTING BOTH IS NOT A WIDENING OF TRUST. They are two spellings of ONE application — this
 * bot, whose id already gates the Bot Framework path and is published in the manifest. A token
 * minted for any other application still fails, and a token with no audience still fails. What
 * changes is only that BTY now recognises its own resource under the name Entra actually uses.
 *
 * Both are kept rather than swapping one guess for another: if the app's token version were ever
 * changed, the URI form would reappear, and a silent refusal is exactly the failure this cost a
 * device cycle to find once.
 */
export function tabSsoAudiences(
  botAppId: string | undefined = process.env.TEAMS_BOT_APP_ID,
): string[] | null {
  const id = (botAppId ?? "").trim().toLowerCase();
  if (!GUID.test(id)) return null;
  // v1.0 spelling first (the manifest's `webApplicationInfo.resource`), then the v2.0 spelling.
  return [`api://${TAB_HOST}/botid-${id}`, id];
}

/** The tenant's own OIDC issuer. Never `/common`. */
export function tenantIssuer(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/** Pull the bearer token out of an Authorization header without logging it. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  const t = m?.[1]?.trim();
  return t ? t : null;
}

/** Decode a token's payload WITHOUT verifying it. Only ever used to route or to diagnose. */
function unverifiedPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read `tid` from an UNVERIFIED token, for the sole purpose of choosing which tenant's keys to
 * verify against. The value is a routing hint until the signature check passes; a wrong `tid`
 * routes to a key set under which the token does not validate.
 */
function unverifiedTenantId(token: string): string | null {
  const tid = (() => {
    const v = unverifiedPayload(token)?.tid;
    return typeof v === "string" ? v.trim().toLowerCase() : "";
  })();
  return GUID.test(tid) ? tid : null;
}

/**
 * WHY A REJECTED TOKEN GETS ONE LINE OF SHAPE (Slice A0-RUNTIME).
 *
 * `jose` reports a stable code — `ERR_JWT_CLAIM_VALIDATION_FAILED` — for BOTH a wrong audience and
 * a wrong issuer, which is exactly the ambiguity that costs a device cycle: the code says a claim
 * was wrong and never which one or what it actually held. On a live SSO failure the difference
 * between "Entra minted this for a different resource" and "this is a v1.0 token" is the whole
 * diagnosis, and neither is inferable from the code alone.
 *
 * WHAT IS SAFE TO SAY, AND WHY EACH ITEM IS:
 *   aud   OUR OWN resource identifier. Whatever Entra put there names an application of ours and
 *         is already published in the Teams manifest. It is the one value worth having verbatim.
 *   iss   reported as a VERSION ONLY (`v2.0` / `v1.0` / `other`). The raw issuer embeds the tenant
 *         GUID, so the shape is reported and the identifier is not.
 *   tid / oid / exp  presence and validity as booleans. Never the values.
 *
 * NEVER: the token, any header, `email`, `preferred_username`, `upn`, `name`, `sub`, or the tenant
 * and object ids themselves. This function cannot emit them — it reads four fields and returns
 * primitives.
 */
function rejectionShape(token: string): Record<string, unknown> {
  const p = unverifiedPayload(token);
  if (!p) return { decodable: false };
  const iss = typeof p.iss === "string" ? p.iss : "";
  const exp = typeof p.exp === "number" ? p.exp : null;
  return {
    decodable: true,
    // The measured audience, verbatim: it is our own identifier, and it is the answer.
    aud: typeof p.aud === "string" ? p.aud : Array.isArray(p.aud) ? p.aud.join(",") : "(absent)",
    // Version only. `/v2.0` is required; a v1.0 token means the app still issues the old format.
    issVersion: iss.endsWith("/v2.0") ? "v2.0" : iss.startsWith("https://sts.windows.net/") ? "v1.0" : "other",
    tidPresent: typeof p.tid === "string" && GUID.test(p.tid.trim().toLowerCase()),
    oidPresent: typeof p.oid === "string" && GUID.test(p.oid.trim().toLowerCase()),
    expired: exp === null ? null : exp * 1000 < Date.now(),
  };
}

/**
 * One remote key set per tenant, cached for the life of the isolate. `jose` re-fetches on its own
 * when it meets an unknown `kid`, which is what makes key rotation a non-event here.
 */
const jwksByTenant = new Map<string, Promise<ReturnType<typeof createRemoteJWKSet>>>();

async function getTenantJwks(tenantId: string) {
  const existing = jwksByTenant.get(tenantId);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch(`${tenantIssuer(tenantId)}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error("openid_config_unavailable");
    const conf = (await res.json()) as { jwks_uri?: unknown };
    const uri = typeof conf.jwks_uri === "string" ? conf.jwks_uri : "";
    if (!uri) throw new Error("jwks_uri_missing");
    return createRemoteJWKSet(new URL(uri));
  })().catch((e) => {
    // A failed discovery must not poison the isolate forever — the next request retries.
    jwksByTenant.delete(tenantId);
    throw e;
  });
  jwksByTenant.set(tenantId, p);
  return p;
}

/**
 * Verify a Teams tab SSO token and return ONLY the canonical Microsoft identity tuple.
 *
 * @param keyResolver injectable ONLY so tests can supply a local key set and prove the checks this
 * module owns — signature, issuer, audience, expiry — against really signed tokens. Stubbing
 * global `fetch` does not intercept `jose`'s own fetching, so without injection the positive case
 * cannot be proven and the negative cases would pass for the wrong reason.
 */
export async function verifyTeamsTabSsoToken(
  authorizationHeader: string | null,
  audience: string | string[] | null = tabSsoAudiences(),
  keyResolver?: JWTVerifyGetKey,
): Promise<TabSsoVerification> {
  if (!audience || (Array.isArray(audience) && audience.length === 0)) {
    console.error("[teams-tab-sso] rejected: application id uri not configured");
    return { ok: false, reason: "not_configured" };
  }

  const token = bearerToken(authorizationHeader);
  if (!token) return { ok: false, reason: "missing_token" };

  // Three non-empty dot-separated segments. An `alg: none` token has an empty signature and dies
  // here, before any key material is fetched.
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    console.error("[teams-tab-sso] rejected: malformed token");
    return { ok: false, reason: "malformed_token" };
  }

  const tid = unverifiedTenantId(token);
  if (!tid) {
    console.error("[teams-tab-sso] rejected: no usable tenant claim");
    return { ok: false, reason: "missing_tenant" };
  }

  let payload: Record<string, unknown>;
  try {
    const jwks = keyResolver ?? (await getTenantJwks(tid));
    const verified = await jwtVerify(token, jwks, {
      issuer: tenantIssuer(tid),
      audience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (e) {
    // `jose` error codes are stable and say nothing secret (e.g. ERR_JWT_EXPIRED). The shape is
    // added because the code alone cannot distinguish a wrong audience from a wrong issuer.
    const code = (e as { code?: unknown })?.code;
    console.error("[teams-tab-sso] rejected: token verification failed", {
      code: typeof code === "string" ? code : "unknown",
      expectedAud: Array.isArray(audience) ? audience.join(" | ") : audience,
      ...rejectionShape(token),
    });
    return { ok: false, reason: "invalid_token" };
  }

  // The signature proved the token; these two claims are what it proved ABOUT. `tid` is re-read
  // from the verified payload rather than reused from the routing hint, so the value that reaches
  // the resolver is one Microsoft signed.
  const verifiedTid = typeof payload.tid === "string" ? payload.tid.trim().toLowerCase() : "";
  const oid = typeof payload.oid === "string" ? payload.oid.trim().toLowerCase() : "";
  if (!GUID.test(verifiedTid)) {
    console.error("[teams-tab-sso] rejected: verified token carries no tenant");
    return { ok: false, reason: "missing_tenant" };
  }
  if (!GUID.test(oid)) {
    // A token with an email, a upn or a sub but no `oid` identifies nobody this product can bind
    // to. There is deliberately no fallback to any of those claims.
    console.error("[teams-tab-sso] rejected: verified token carries no object id");
    return { ok: false, reason: "missing_oid" };
  }

  return { ok: true, identity: { tenantId: verifiedTid, aadObjectId: oid } };
}
