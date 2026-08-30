/**
 * WHERE NATIVE SESSION RESTORE MUST NOT RUN (Slice R1G). PURE.
 *
 * `AuthProvider` wraps the ROOT layout, so its boot check runs on EVERY route — including
 * `/{locale}/auth/callback`, whose entire job is to turn a fresh OAuth code into a session. On that
 * route the session gate is legitimately unauthenticated, which is exactly the condition that
 * triggers native durable-session restore.
 *
 * That restore calls `supabase.auth.setSession(...)`, and auth-js's `_saveSession()` — the success
 * path of setSession — deletes `<storageKey>-code-verifier`. So the restore DESTROYS the PKCE
 * verifier of the sign-in still in flight, racing the callback's own `exchangeCodeForSession`.
 * Production showed it exactly once the Microsoft leg started succeeding:
 *
 *   POST /auth/v1/token?grant_type=pkce → 400 bad_code_verifier
 *   "code challenge does not match previously saved code verifier"
 *
 * Native-only, because `isNative()` gates the restore — which is why the web flow was never
 * affected while the installed app failed every time.
 *
 * Restoring a stale session on the callback route is redundant as well as destructive: the callback
 * is about to establish the real one.
 */

/** `/en/auth/callback`, `/ko/auth/callback`, with or without a trailing segment or query. */
const AUTH_CALLBACK = /^\/[a-z]{2}\/auth\/callback(\/|$)/;

/**
 * True when the given path is establishing a session right now, so restoring an old one would
 * race it. A null/unknown path is NOT treated as the callback — the guard only ever suppresses
 * restore where it is provably harmful, and never silently disables the durable-session feature.
 */
export function isEstablishingSessionPath(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && AUTH_CALLBACK.test(pathname);
}
