/**
 * Bot Framework app-only access token. SERVER ONLY.
 *
 * EXTENDS THE EXISTING PRECEDENT rather than introducing a platform. `getGraphAppToken` already
 * does client_credentials against Microsoft with native `fetch`, caches to just before expiry,
 * logs status only, and returns null instead of throwing. This is the same shape pointed at the
 * Bot Framework audience, so no Bot Framework SDK is added: the SDK's value is conversation
 * plumbing and state, and this slice needs one token and two HTTP calls.
 *
 * THE CREDENTIAL IS ALLOWED TO BE ABSENT. `TEAMS_BOT_APP_PASSWORD` does not exist yet, and the
 * code must ship before it does — so absence is a typed result, never a throw. A notification
 * that cannot authenticate is a notification that did not happen; it is not a broken Track.
 *
 * NOTHING FROM THE TOKEN RESPONSE IS EVER LOGGED. A token endpoint echoes the client id in its
 * error bodies, and the success body is the credential itself.
 *
 * ---------------------------------------------------------------------------
 * ★ THE AUTHORITY IS THE BOT'S OWN TENANT, NOT `botframework.com`.
 *
 * The first real Stage 1 attempt obtained a token from `botframework.com` and was then refused by
 * the Connector with a bare 401 — no error code, no WWW-Authenticate. The Developer Portal shows
 * why: `bty-arena-teams` is a TEAMS-MANAGED registration, and a Teams-managed bot is
 * `isSingleTenant: true` even when its Entra app is `AzureADMultipleOrgs`. So the Entra app
 * resolves happily at the multi-tenant authority and issues a token, and the Connector then
 * declines to accept it. A successfully issued token is NOT evidence of the right authority.
 *
 * The scope is unchanged — `api.botframework.com/.default` is correct for both — and so are the
 * client id and secret. Only the directory the token is minted in moves.
 * ---------------------------------------------------------------------------
 */

/** Where the BOT REGISTRATION lives. Fixed infrastructure, never a value from a request. */
const tokenEndpoint = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const BOT_SCOPE = "https://api.botframework.com/.default";
/** Renew a little early, so a token cannot expire between being chosen and being used. */
const SAFETY_MARGIN_SECONDS = 60;
/** A directory id is a GUID. Anything else is a misconfiguration, not an authority. */
const TENANT_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BotTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "credential_missing" | "tenant_not_configured" | "auth_failed" | "unreachable" };

/** Cached per authority: a token minted in one directory is not valid for another. */
let cached: { token: string; expiresAtMs: number; authority: string } | null = null;

/** Test seam only. Never called by application code. */
export function __resetBotTokenCache() {
  cached = null;
}

export async function getBotFrameworkToken(env?: {
  appId?: string;
  appPassword?: string;
  /** The BOT REGISTRATION's tenant. Callers pass this only in tests. */
  tenantId?: string;
}): Promise<BotTokenResult> {
  const appId = env?.appId ?? process.env.TEAMS_BOT_APP_ID;
  const appPassword = env?.appPassword ?? process.env.TEAMS_BOT_APP_PASSWORD;
  const tenantId = (env?.tenantId ?? process.env.TEAMS_BOT_TENANT_ID ?? "").trim();

  // Named distinctly so the caller — and the report — can say "not configured" rather than
  // "authentication failed", which would send someone looking for a wrong password.
  if (!appId || !appPassword) return { ok: false, reason: "credential_missing" };

  /*
    ★ FAIL CLOSED, AND NEVER FALL BACK TO `botframework.com`.

    A fallback would recreate exactly the ambiguity that cost this slice: the multi-tenant
    authority ISSUES a token for this app, so the fallback would look like it worked and fail
    later at the Connector with a bare 401. A missing or malformed tenant is a configuration
    error and is reported as one, before any network call.
  */
  if (!TENANT_GUID.test(tenantId)) {
    console.error("[teams-proactive] bot tenant not configured", { configured: tenantId !== "" });
    return { ok: false, reason: "tenant_not_configured" };
  }

  const authority = tokenEndpoint(tenantId);
  if (cached && cached.authority === authority && cached.expiresAtMs > Date.now()) {
    return { ok: true, token: cached.token };
  }

  try {
    const res = await fetch(authority, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: appId,
        client_secret: appPassword,
        scope: BOT_SCOPE,
      }),
    });
    if (!res.ok) {
      // Status only. The body can echo the client id and the failed secret's shape.
      console.error("[teams-proactive] bot token request failed", { status: res.status });
      return { ok: false, reason: "auth_failed" };
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (typeof body.access_token !== "string" || !body.access_token) {
      console.error("[teams-proactive] bot token response had no token");
      return { ok: false, reason: "auth_failed" };
    }
    const ttl = typeof body.expires_in === "number" && body.expires_in > SAFETY_MARGIN_SECONDS
      ? body.expires_in
      : 300;
    cached = { token: body.access_token, expiresAtMs: Date.now() + (ttl - SAFETY_MARGIN_SECONDS) * 1000, authority };
    return { ok: true, token: cached.token };
  } catch {
    // Network, DNS, TLS. Deliberately indistinguishable from each other and carrying no detail.
    console.error("[teams-proactive] bot token endpoint unreachable");
    return { ok: false, reason: "unreachable" };
  }
}
