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
 */

/** Microsoft's fixed tenant and audience for bot-to-connector auth — not our tenant. */
const BOT_TOKEN_ENDPOINT = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";
const BOT_SCOPE = "https://api.botframework.com/.default";
/** Renew a little early, so a token cannot expire between being chosen and being used. */
const SAFETY_MARGIN_SECONDS = 60;

export type BotTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "credential_missing" | "auth_failed" | "unreachable" };

let cached: { token: string; expiresAtMs: number } | null = null;

/** Test seam only. Never called by application code. */
export function __resetBotTokenCache() {
  cached = null;
}

export async function getBotFrameworkToken(env?: {
  appId?: string;
  appPassword?: string;
}): Promise<BotTokenResult> {
  const appId = env?.appId ?? process.env.TEAMS_BOT_APP_ID;
  const appPassword = env?.appPassword ?? process.env.TEAMS_BOT_APP_PASSWORD;

  // The expected state today. Named distinctly so the caller — and the report — can say
  // "not configured" rather than "authentication failed", which would send someone looking
  // for a wrong password that does not exist.
  if (!appId || !appPassword) return { ok: false, reason: "credential_missing" };

  if (cached && cached.expiresAtMs > Date.now()) return { ok: true, token: cached.token };

  try {
    const res = await fetch(BOT_TOKEN_ENDPOINT, {
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
    cached = { token: body.access_token, expiresAtMs: Date.now() + (ttl - SAFETY_MARGIN_SECONDS) * 1000 };
    return { ok: true, token: cached.token };
  } catch {
    // Network, DNS, TLS. Deliberately indistinguishable from each other and carrying no detail.
    console.error("[teams-proactive] bot token endpoint unreachable");
    return { ok: false, reason: "unreachable" };
  }
}
