// Provider-neutral Admin credential mode (Slice 2.1). Shared by AdminConsole and
// DjConsole so both agree on: which credential is active, what header to send, and
// how to combine a Bearer probe with a Room-cookie probe.
//
// The client stores NO account id, workspace id, or ownership — the server remains
// canonical truth. Cookie mode is represented by a NON-EMPTY sentinel so existing
// `if (!cred)` guards keep working, while the auth header is omitted so the browser
// attaches the HttpOnly `bty_room` cookie on same-origin requests.

/** Result of probing /admin/session (401 = definitive reject; else transient). */
export type SessionProbe = 'ok' | 'unauth' | 'neterr';

export type CredentialMode = 'bearer' | 'cookie';

/** Non-empty, clearly-not-a-token sentinel meaning "authorize via the cookie".
 *  Never written to localStorage; only held in memory. Not a valid base64url token,
 *  so it can never collide with a real device credential. */
export const COOKIE_CRED = '__bty_room_cookie__';

export function isCookieCred(cred: string | null | undefined): boolean {
  return cred === COOKIE_CRED;
}

/**
 * The headers for an admin/DJ request.
 *  - cookie mode  -> no Authorization (the browser sends `bty_room` same-origin)
 *  - bearer mode  -> { authorization: 'Bearer <token>' }
 *  - null/empty   -> no Authorization (unauthenticated probe)
 *
 * BUILD 26U-R2 — every one of these carries the release-client discriminator too. This is the
 * ONE place the web Host console builds request headers, which is why the header is added here
 * rather than at each fetch: a call site cannot forget what it never writes.
 *
 * WHY WEB IDENTIFIES ITSELF AT ALL, given it has no old-binary problem: the server's DUAL
 * matrix treats an UNIDENTIFIED caller as legacy, because the immutable public app is
 * unidentified. If web stayed silent it would inherit that exception and become a permanent
 * free path around Premium Room — precisely the "native pays / web stays free" bypass R2 §9
 * forbids. Announcing itself is how web opts IN to the new contract.
 *
 * The build id is the same `NEXT_PUBLIC_KARAOKE_BUILD` the freshness guard already uses, so
 * server telemetry and the stale-tab guard name the same deploy.
 */
export function adminAuthHeader(cred: string | null | undefined): Record<string, string> {
  const client = { 'x-bty-client': webReleaseClient() };
  if (!cred || cred === COOKIE_CRED) return client;
  return { ...client, authorization: `Bearer ${cred}` };
}

/**
 * `web/<buildId>` for the running bundle. Falls back to `web/unknown` — still a WEB
 * classification, because the platform is what selects the contract and it is known for
 * certain here; only the deploy id is in doubt.
 */
export function webReleaseClient(): string {
  const raw = process.env.NEXT_PUBLIC_KARAOKE_BUILD;
  const id = typeof raw === 'string' ? raw.trim() : '';
  // The server accepts [A-Za-z0-9._-]{1,64}; anything else would be parsed as unidentified,
  // so an odd build id degrades to the literal rather than to silence.
  const safe = id.length > 0 && id.length <= 64 && /^[A-Za-z0-9._-]+$/.test(id) ? id : 'unknown';
  return `web/${safe}`;
}

export type AdminAuthPhase = 'authed' | 'need-auth' | 'retry';

export interface AdminAuthResolution {
  phase: AdminAuthPhase;
  mode: CredentialMode | null;
}

/**
 * Combine a Bearer probe and a Room-cookie probe into the final startup phase.
 * Order-independent and pure, so it is exhaustively testable.
 *
 *  - Bearer 'ok'            -> authed (bearer) — Bearer stays first priority.
 *  - else cookie 'ok'       -> authed (cookie).
 *  - else EITHER transient  -> retry (a network blip must NEVER show pairing).
 *  - else (both definitive rejects or absent) -> need-auth.
 *
 * `null` for a probe means it was not attempted (e.g. no stored Bearer, or the
 * cookie probe has not run yet).
 */
export function finalizeAdminAuth(
  bearer: SessionProbe | null,
  cookie: SessionProbe | null,
): AdminAuthResolution {
  if (bearer === 'ok') return { phase: 'authed', mode: 'bearer' };
  if (cookie === 'ok') return { phase: 'authed', mode: 'cookie' };
  if (bearer === 'neterr' || cookie === 'neterr') return { phase: 'retry', mode: null };
  return { phase: 'need-auth', mode: null };
}
