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
 * Resolve the client-credentials identity Graph is called with.
 *
 * THREE TIERS, HIGHEST FIRST, resolved FIELD BY FIELD so a partial split-out still works:
 *
 *   1. MS_GRAPH_*          a dedicated daemon registration, if one is ever split out
 *   2. AZURE_AD_*          the web sign-in registration
 *   3. TEAMS_BOT_*         the BTY Teams bot registration
 *
 * ★ WHY TIER 3 EXISTS (Commander authorization, Teams Chat-Native Training V1).
 *
 * MEASURED ON PRODUCTION before this change: no `MS_GRAPH_*` and no `AZURE_AD_*` value exists as
 * a Worker secret or var, `graphConfigFromEnv` therefore returned null, and both Graph-fed tables
 * (`bty_microsoft_directory_authority`, `bty_microsoft_authority_snapshots`) held ZERO rows with
 * no timestamps at all — despite the hourly directory cron having run for days. Graph had never
 * once worked in production, and every feature that depends on it was inert.
 *
 * BTY already holds exactly one usable Entra credential pair: the Teams bot registration
 * (`TEAMS_BOT_APP_ID` / `TEAMS_BOT_APP_PASSWORD`) in tenant `TEAMS_BOT_TENANT_ID`. The Commander
 * authorized granting that SAME registration the one application permission this file already
 * specifies — `User.Read.All` — with tenant admin consent, explicitly rather than provisioning a
 * new app or rotating a new secret. This tier is what lets that consent take effect with no new
 * secret to manage and no second registration to keep in step.
 *
 * NOTHING ELSE CHANGES. The requested permission set is still exactly
 * {@link REQUIRED_GRAPH_APPLICATION_PERMISSIONS} — one entry, asserted by test. No write scope, no
 * Chat, no Channel, no Mail, no directory-wide read. A different credential does not widen what
 * that credential is allowed to do: the roles live on the app registration's consent, and this
 * function only decides which registration is asked.
 *
 * FIELD BY FIELD, NOT SET BY SET, deliberately: a deployment that splits out only a daemon client
 * id and secret while keeping one tenant id is a real configuration, and the existing behaviour
 * already supported it.
 */
export function graphConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): GraphConfig | null {
  const tenantId = (env.MS_GRAPH_TENANT_ID ?? env.AZURE_AD_TENANT_ID ?? env.TEAMS_BOT_TENANT_ID ?? "")
    .trim()
    .toLowerCase();
  const clientId = (env.MS_GRAPH_CLIENT_ID ?? env.AZURE_AD_CLIENT_ID ?? env.TEAMS_BOT_APP_ID ?? "").trim();
  const clientSecret = (
    env.MS_GRAPH_CLIENT_SECRET ??
    env.AZURE_AD_CLIENT_SECRET ??
    env.TEAMS_BOT_APP_PASSWORD ??
    ""
  ).trim();
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

export type ProfessionalProfileProbe =
  | { ok: true; jobTitle: string | null; employeeType: string | null }
  | { ok: false; reason: "http_error" | "network" | "invalid_oid" };

/** Read only the two measured professional fields for an already-linked identity. */
export async function probeProfessionalProfile(token: string, aadObjectId: string): Promise<ProfessionalProfileProbe> {
  const oid = (aadObjectId ?? "").trim().toLowerCase();
  if (!GUID.test(oid)) return { ok: false, reason: "invalid_oid" };
  try {
    const res = await fetch(`${GRAPH}/v1.0/users/${oid}?$select=id,jobTitle,employeeType`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) {
      console.error("[graph] professional profile probe failed", { status: res.status });
      return { ok: false, reason: "http_error" };
    }
    const body = (await res.json()) as { jobTitle?: unknown; employeeType?: unknown };
    return {
      ok: true,
      jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : null,
      employeeType: typeof body.employeeType === "string" ? body.employeeType : null,
    };
  } catch {
    console.error("[graph] professional profile probe threw");
    return { ok: false, reason: "network" };
  }
}

/**
 * RECIPIENT ELIGIBILITY — may BTY's bot be pointed at this person? (Teams Chat-Native Training V1.)
 *
 * ONE USER, BY OBJECT ID. No enumeration, no filter, no directory-wide read: the caller already
 * knows exactly whom the Host picked, and the only question is whether that object id names a real,
 * enabled, internal member of this tenant. `User.Read.All` is the same single application
 * permission this module already requires; nothing is widened to answer this.
 *
 * THE TENANT IS ENFORCED BY THE TOKEN. An app-only Graph token is issued FOR one tenant, so
 * `/users/{oid}` can only ever resolve an object in that tenant and a foreign one answers 404 —
 * which this reports as `not_found`. The caller additionally refuses a request whose tenant is not
 * the configured one before it ever gets here, so the boundary is stated twice.
 *
 * `displayName` is returned for PRESENTATION ONLY — a Host needs to be told which of their chosen
 * colleagues could not be reached. It is never an identity and never a lookup key.
 *
 * INDETERMINATE IS NOT INELIGIBLE. A transport failure returns `http_error`/`network`, and the
 * caller must treat that as "we do not know" rather than as a refusal — the same discipline the
 * revocation half of the directory sync already follows.
 */
export type RecipientEligibility =
  | { ok: true; eligible: true; displayName: string | null }
  | { ok: true; eligible: false; reason: "disabled" | "not_member" }
  | { ok: false; reason: "invalid_oid" | "not_found" | "http_error" | "network" };

export async function probeRecipientEligibility(
  token: string,
  aadObjectId: string,
): Promise<RecipientEligibility> {
  const oid = (aadObjectId ?? "").trim().toLowerCase();
  if (!GUID.test(oid)) return { ok: false, reason: "invalid_oid" };
  try {
    const res = await fetch(`${GRAPH}/v1.0/users/${oid}?$select=id,accountEnabled,userType,displayName`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) {
      // Status only. A Graph error body can echo the object id and the tenant.
      console.error("[graph] recipient eligibility probe failed", { status: res.status });
      return { ok: false, reason: "http_error" };
    }
    const body = (await res.json()) as { accountEnabled?: unknown; userType?: unknown; displayName?: unknown };
    if (body.accountEnabled !== true) return { ok: true, eligible: false, reason: "disabled" };
    // Guests and any non-Member type are refused: an internal training is for internal members.
    if (body.userType !== "Member") return { ok: true, eligible: false, reason: "not_member" };
    const displayName = typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim().slice(0, 120)
      : null;
    return { ok: true, eligible: true, displayName };
  } catch {
    console.error("[graph] recipient eligibility probe threw");
    return { ok: false, reason: "network" };
  }
}

export type DirectoryUser = { id: string; accountEnabled: boolean; userType: string; jobTitle: string | null; employeeType: string | null };

/** Page through authority fields only; directory population is independent of BTY auth users. */
export async function listDirectoryUsers(token: string): Promise<{ ok: true; users: DirectoryUser[] } | { ok: false }> {
  const users: DirectoryUser[] = [];
  let url: string | null = GRAPH + "/v1.0/users?$select=id,accountEnabled,userType,jobTitle,employeeType&$top=100";
  try {
    while (url) {
      const res = await fetch(url, { headers: { authorization: "Bearer " + token, accept: "application/json" } });
      if (!res.ok) return { ok: false };
      const body = (await res.json()) as { value?: unknown[]; "@odata.nextLink"?: unknown };
      for (const item of body.value ?? []) {
        const row = item as Record<string, unknown>;
        if (typeof row.id !== "string" || !GUID.test(row.id.toLowerCase())) continue;
        users.push({ id: row.id.toLowerCase(), accountEnabled: row.accountEnabled === true,
          userType: typeof row.userType === "string" ? row.userType : "",
          jobTitle: typeof row.jobTitle === "string" ? row.jobTitle : null,
          employeeType: typeof row.employeeType === "string" ? row.employeeType : null });
      }
      url = typeof body["@odata.nextLink"] === "string" ? body["@odata.nextLink"] : null;
    }
    return { ok: true, users };
  } catch { return { ok: false }; }
}
