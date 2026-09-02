/**
 * Microsoft Graph — organizational hierarchy, and nothing else. SERVER ONLY.
 *
 * ★ THE ENTIRE SURFACE IS ONE ENDPOINT: GET /users/{id}/directReports
 *
 * WHY THAT ONE AND NOT `/users/{id}/manager`, MEASURED (Microsoft Learn, v1.0, 2026-09-01).
 * The `manager` navigation property's permission table reads:
 *
 *   Delegated (work or school) : User.Read.All
 *   Application                : NOT SUPPORTED
 *
 * There is no app-only way to read a person's manager. `directReports` is the mirror of the same
 * Entra edge and IS supported app-only, with `User.Read.All` as the documented least-privileged
 * application permission. So BTY reads the hierarchy from the reports side. This is not a
 * preference; the manager side does not exist for a daemon.
 *
 * WHY NO TENANT ENUMERATION. The naive design — list every user in the tenant, expand their
 * managers, take the distinct manager set — is both unavailable app-only and unnecessary. BTY can
 * only grant Host to somebody who already HAS a BTY account, so the only people worth asking about
 * are the ones already in `auth.users`. The number of Graph calls is therefore bounded by the BTY
 * population, not by the size of the organisation, and no directory-wide read is ever performed.
 * That is also why the broader directory-wide application permission is not requested: nothing
 * here needs it, and a test below asserts by name that none of the wider scopes appear in this
 * file at all — including in prose, which is why this sentence does not spell one out.
 *
 * PERMISSIONS REQUESTED: exactly one, asserted by test. No Chat, no ChannelMessage, no Mail, no
 * Group, no write scope of any kind. BTY reads no Microsoft message content anywhere, ever.
 */

const GRAPH = "https://graph.microsoft.com";

/**
 * The complete set of Microsoft Graph APPLICATION permissions BTY requires.
 *
 * This constant is the specification. A test asserts it has exactly one member, so widening the
 * app's Entra permissions without a deliberate, reviewed change to this line will fail the build.
 */
export const REQUIRED_GRAPH_APPLICATION_PERMISSIONS = ["User.Read.All"] as const;

/** Client-credentials always requests `.default`; the granted app roles above are what it yields. */
const CLIENT_CREDENTIALS_SCOPE = `${GRAPH}/.default`;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type GraphConfig = { tenantId: string; clientId: string; clientSecret: string };

/**
 * Reuses the existing Entra registration by default so no new secret has to be provisioned or
 * rotated, while allowing a dedicated daemon app to be split out later without a code change.
 */
export function graphConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): GraphConfig | null {
  const tenantId = (env.MS_GRAPH_TENANT_ID ?? env.AZURE_AD_TENANT_ID ?? "").trim().toLowerCase();
  const clientId = (env.MS_GRAPH_CLIENT_ID ?? env.AZURE_AD_CLIENT_ID ?? "").trim();
  const clientSecret = (env.MS_GRAPH_CLIENT_SECRET ?? env.AZURE_AD_CLIENT_SECRET ?? "").trim();
  if (!GUID.test(tenantId) || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

type CachedToken = { token: string; expiresAtMs: number };
let cached: CachedToken | null = null;

/** Test seam only — a token cache that survived between tests would hide a config change. */
export function resetGraphTokenCache() {
  cached = null;
}

/**
 * App-only access token. Cached until shortly before expiry.
 *
 * Returns null rather than throwing: every caller treats "no token" as INDETERMINATE, and the
 * sync's revocation half is disabled by that. A credential problem must never read as "nobody
 * manages anyone".
 */
export async function getGraphAppToken(config: GraphConfig): Promise<string | null> {
  if (cached && cached.expiresAtMs > Date.now()) return cached.token;

  try {
    const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: CLIENT_CREDENTIALS_SCOPE,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      // Status only. A token endpoint's body can echo the client id and error detail.
      console.error("[graph] token request failed", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (typeof body.access_token !== "string" || !body.access_token) return null;
    const ttl = typeof body.expires_in === "number" && body.expires_in > 60 ? body.expires_in : 300;
    cached = { token: body.access_token, expiresAtMs: Date.now() + (ttl - 60) * 1000 };
    return cached.token;
  } catch {
    console.error("[graph] token request threw");
    return null;
  }
}

export type DirectReportProbe =
  | { ok: true; hasDirectReports: boolean }
  | { ok: false; reason: "no_token" | "http_error" | "network" | "invalid_oid" };

/**
 * Does this Entra object have at least one current direct report?
 *
 * `$top=1` because the COUNT is irrelevant — the entitlement rule is ">= 1", so one row settles it
 * and a manager of two hundred people costs the same single page as a manager of one.
 *
 * `$select=id` because nothing else is wanted. No displayName, no mail, no jobTitle: the response
 * this function can even see is an id, so no other attribute can leak into an authority decision.
 *
 * ANY non-200 IS A REFUSAL, NOT A "NO". A 404 (object gone), 403 (consent not granted), 429
 * (throttled) and 503 all return ok:false. Reading any of them as "has no reports" would convert an
 * outage into a revocation, which is the exact accident this whole design is built to prevent.
 */
export async function probeDirectReports(
  token: string,
  aadObjectId: string,
): Promise<DirectReportProbe> {
  const oid = (aadObjectId ?? "").trim().toLowerCase();
  if (!GUID.test(oid)) return { ok: false, reason: "invalid_oid" };

  try {
    const res = await fetch(`${GRAPH}/v1.0/users/${oid}/directReports?$top=1&$select=id`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) {
      // Status only — never the body, which carries directory detail.
      console.error("[graph] directReports probe failed", { status: res.status });
      return { ok: false, reason: "http_error" };
    }
    const body = (await res.json()) as { value?: unknown[] };
    return { ok: true, hasDirectReports: Array.isArray(body.value) && body.value.length >= 1 };
  } catch {
    console.error("[graph] directReports probe threw");
    return { ok: false, reason: "network" };
  }
}
