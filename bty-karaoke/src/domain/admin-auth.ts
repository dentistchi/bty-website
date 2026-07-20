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
 * The Authorization headers for an admin/DJ request.
 *  - cookie mode  -> {} (no header; the browser sends `bty_room` same-origin)
 *  - bearer mode  -> { authorization: 'Bearer <token>' }
 *  - null/empty   -> {} (unauthenticated probe)
 */
export function adminAuthHeader(cred: string | null | undefined): Record<string, string> {
  if (!cred || cred === COOKIE_CRED) return {};
  return { authorization: `Bearer ${cred}` };
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
