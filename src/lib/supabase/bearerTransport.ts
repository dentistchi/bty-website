import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE SECOND TRANSPORT, IN ONE PLACE (Slice A0.2).
 *
 * BTY authenticates a server request in two ways and only two: a `SameSite=Lax` cookie (web and
 * native) and a Supabase access token in an `Authorization` header (the Teams tab, which is a
 * third-party browsing context and carries no cookie by construction).
 *
 * WHY THIS MODULE EXISTS RATHER THAN A THIRD COPY OF THE SAME TEN LINES. The repair has now been
 * needed at three different client factories, and it was missed twice:
 *
 *   A0          taught `requireUser`             — covered the routes composing it
 *   A0-RUNTIME2 taught `getSupabaseServer`       — reported as "74 routes"
 *   A0.2        found `getSupabaseServerClient`  — 61 routes, still refusing
 *
 * The "74" was WRONG and the way it was wrong is worth recording: it came from
 * `grep -l "getSupabaseServer"`, which also matches `getSupabaseServerClient` as a SUBSTRING. The
 * real split is 12 and 61. Two visible symptoms happened to sit in the smaller bucket, so the fix
 * looked complete and 61 routes stayed broken until a Founder tapped one of them.
 *
 * So the behaviour lives here once, every factory calls it, and `bearerTransport.test.ts` asserts
 * that EVERY server-side Supabase factory in the repo does — a new factory fails that test rather
 * than shipping another silent hole.
 *
 * THE BEARER IS A SUPABASE ACCESS TOKEN, NEVER A MICROSOFT ONE. The Entra token's authority ends
 * at `/api/auth/teams-bootstrap`; nothing in this file knows Microsoft exists.
 */

/**
 * Read the request's Authorization header, tolerating a context that has none.
 *
 * `headers()` is request-scoped. Every documented caller of these factories (Route Handlers,
 * Server Actions, Server Components) has one — but a factory that THROWS where it used to work
 * would turn "no bearer" into a 500, and the cookie path would never get its chance. An absent
 * header context means exactly one thing: this request presented no bearer.
 */
export async function readIncomingAuthorization(
  headersFn: () => Promise<{ get(name: string): string | null }> | { get(name: string): string | null },
): Promise<string | null> {
  try {
    const h = await headersFn();
    return bearerFromAuthorization(h.get("authorization"));
  } catch {
    return null;
  }
}

/** Extract a bearer token from an Authorization header value. Never logs it. */
export function bearerFromAuthorization(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const m = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  const t = m?.[1]?.trim();
  return t ? t : null;
}

/**
 * The `global` option a Supabase client needs so its RLS reads act as the bearer's owner.
 *
 * Attached globally rather than only used for `getUser`, because these routes keep using the same
 * client for real work after authenticating. A client that could identify the caller but not act
 * as them would authenticate correctly and then read nothing — which surfaces as an empty list,
 * not an error, and is the hardest kind of defect to notice.
 */
export function bearerGlobalOption(bearer: string | null): { global: { headers: Record<string, string> } } | Record<string, never> {
  return bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {};
}

/**
 * Wrap `auth.getUser` so a bearer-carrying request resolves without changing any call site.
 *
 * Callers invoke `getUser()` with no argument, which reads the cookie session; with no cookie that
 * is null and the route 401s. That behaviour is preserved exactly, plus one fallback: when the
 * cookie yields nothing AND a bearer was presented, ask again with the token.
 *
 * THE COOKIE PATH IS ALWAYS FIRST, so a browser request can never reach the bearer branch, and an
 * explicit `getUser(jwt)` is passed straight through — a caller that already knew what it wanted
 * is never second-guessed.
 */
export function withBearerFallback<T extends SupabaseClient>(client: T, bearer: string | null): T {
  if (!bearer) return client;
  const auth = client.auth;
  const original = auth.getUser.bind(auth);
  auth.getUser = (async (jwt?: string) => {
    if (jwt) return original(jwt);
    const viaCookie = await original();
    if (viaCookie.data?.user) return viaCookie;
    return original(bearer);
  }) as typeof auth.getUser;
  return client;
}
