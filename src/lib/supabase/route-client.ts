import { NextRequest, NextResponse } from "next/server";
import { isConsentCurrent } from "@/lib/legal/activeConsent";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { authCookieSecureForRequest } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Whitelist-only cookie setter: path="/" always, no domain; only expires/maxAge from options. */
export function setAuthCookie(
  res: NextResponse,
  name: string,
  value: string,
  options: Record<string, unknown> | undefined,
  secure: boolean,
) {
  const expires = options && "expires" in options ? (options as { expires?: Date }).expires : undefined;
  const maxAge = options && "maxAge" in options ? (options as { maxAge?: number }).maxAge : undefined;

  res.cookies.set(name, value, {
    path: "/",
    sameSite: "lax",
    secure,
    httpOnly: true,
    ...(expires != null ? { expires } : {}),
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  });
}

/**
 * App Router Route Handlers: `NextRequest.cookies` can miss cookies that are visible on the
 * incoming request as parsed by `cookies()` from `next/headers` (same Cookie header, different wiring).
 * Supabase SSR must see `sb-*-auth-token` here or `getUser()` returns null → 401 on `/api/*`.
 */
export function mergeCookiesForRouteHandler(
  req: NextRequest,
  headerStore: { getAll(): { name: string; value: string }[] },
): { name: string; value: string }[] {
  const merged = new Map<string, string>();
  for (const c of req.cookies.getAll()) merged.set(c.name, c.value);
  for (const c of headerStore.getAll()) merged.set(c.name, c.value);
  return [...merged.entries()].map(([name, value]) => ({ name, value }));
}

export function createSupabaseRouteClient(req: NextRequest, res: NextResponse) {
  const secure = authCookieSecureForRequest(req);
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          const names = cookiesToSet.map((c) => c.name).slice(0, 12);
          res.headers.set("x-cookie-writer", "route-client");
          res.headers.set("x-cookie-write-count", String(cookiesToSet.length));
          res.headers.set("x-cookie-write-names", names.join(","));
          res.headers.set("x-cookie-write-path", "/");
          res.headers.set("x-cookie-path-enforced", "/");
        } catch {}
        cookiesToSet.forEach(({ name, value, options }) => {
          setAuthCookie(res, name, value, options, secure);
        });
      },
    },
  });
}

/** Copy Set-Cookie from Supabase refresh (tmp/base response) onto any JSON response — fixes 401 without losing session refresh on Edge. */
export function mergeAuthCookiesFromResponse(from: NextResponse, to: NextResponse, req?: NextRequest) {
  const secure = req ? authCookieSecureForRequest(req) : true;
  const opts = { path: "/" as const, sameSite: "lax" as const, secure, httpOnly: true };
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, opts);
  }
}

export function copyCookiesAndDebug(
  from: NextResponse,
  to: NextResponse,
  req: NextRequest,
  userExists: boolean
) {
  const secure = authCookieSecureForRequest(req);
  const opts = { path: "/" as const, sameSite: "lax" as const, secure, httpOnly: true };
  to.headers.set("Cache-Control", "no-store");
  to.headers.set("x-auth-user", userExists ? "1" : "0");
  to.headers.set("x-auth-path", new URL(req.url).pathname);
  const rawCookieHeader = req.headers.get("cookie");
  to.headers.set("x-auth-cookie-header-len", String(rawCookieHeader?.length ?? 0));
  const all = req.cookies.getAll();
  to.headers.set("x-auth-cookie-count", String(all.length));
  to.headers.set("x-auth-cookie-names", all.slice(0, 8).map((c) => c.name).join(","));
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, opts);
  }
}

/**
 * The Supabase ACCESS TOKEN a Teams-tab request carries, or null. Slice A0.
 *
 * DO NOT CONFUSE THIS WITH A MICROSOFT TOKEN. The bearer read here is a Supabase access token
 * that `POST /api/auth/teams-bootstrap` already minted for a Microsoft identity it verified. The
 * Entra token's authority ends at that route and never reaches this one, so nothing in this file
 * needs to know Microsoft exists.
 */
export function bearerAccessToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  const t = m?.[1]?.trim();
  return t ? t : null;
}

/**
 * A Supabase client whose authority is a bearer access token rather than cookies.
 *
 * The header is attached GLOBALLY, not just used for `getUser()`, because callers keep using the
 * returned client for real work — `requireConsentedUser` hands it to `isConsentCurrent`, which
 * reads `arena_profiles` under RLS. A client that could identify the user but not act as them
 * would authenticate correctly and then read nothing, which is a worse failure than refusing.
 */
function createBearerClient(accessToken: string) {
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * AUTHENTICATION ONLY, and deliberately still only that (see `requireConsentedUser`).
 *
 * TWO TRANSPORTS, ONE SESSION AUTHORITY (Slice A0). Web and native carry the Supabase session in
 * `SameSite=Lax` cookies. A Teams personal tab cannot — it is a third-party browsing context, and
 * Microsoft documents that Teams iOS blocks third-party cookies for personal apps outright — so it
 * carries the SAME session in an `Authorization` header instead. Both paths end at
 * `supabase.auth.getUser()`, resolve to the same `auth.users.id`, and give the same `auth.uid()`
 * under RLS. This is a second transport, never a second session model and never a second identity.
 *
 * The cookie path is tried first and is completely unchanged, so no existing caller can be
 * affected: a request that carries cookies never reaches the bearer branch.
 */
export async function requireUser(req: NextRequest) {
  const base = NextResponse.json({ ok: true }, { status: 200 });
  const cookieSecure = authCookieSecureForRequest(req);
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return mergeCookiesForRouteHandler(req, cookieStore);
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          const names = cookiesToSet.map((c) => c.name).slice(0, 12);
          base.headers.set("x-cookie-writer", "route-client");
          base.headers.set("x-cookie-write-count", String(cookiesToSet.length));
          base.headers.set("x-cookie-write-names", names.join(","));
          base.headers.set("x-cookie-write-path", "/");
          base.headers.set("x-cookie-path-enforced", "/");
        } catch {}
        cookiesToSet.forEach(({ name, value, options }) => {
          setAuthCookie(base, name, value, options, cookieSecure);
        });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (user) return { user, supabase, base, error };

  // No cookie session. A Teams tab has none by construction, so fall back to the bearer it does
  // carry. Anything else — a browser with an expired cookie and no header — still returns null
  // here and gets the existing 401, unchanged.
  const token = bearerAccessToken(req);
  if (!token) return { user: null, supabase, base, error };

  const bearer = createBearerClient(token);
  const viaBearer = await bearer.auth.getUser(token);
  const bearerUser = viaBearer.data?.user ?? null;
  if (!bearerUser) return { user: null, supabase, base, error: viaBearer.error ?? error };

  // The bearer client is returned as `supabase` so downstream RLS reads act as this user.
  return { user: bearerUser, supabase: bearer, base, error: null };
}

export function unauthenticated(req: NextRequest, base: NextResponse) {
  const out = NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}

/**
 * AUTHENTICATED **AND** CURRENTLY CONSENTED (Slice 3.2R-R9B.1).
 *
 * R9A made the PAGE gate require exact consent-version equality, but the middleware matcher
 * excludes `/api/*`, so a signed-in learner whose consent was null, outdated or invented could
 * still call the product APIs directly — measured across five distinct auth seams, none of which
 * checked consent at all. Pages said no; the API said yes.
 *
 * WHY THIS IS A SEPARATE HELPER AND NOT A CHANGE TO `requireUser`. `requireManager` composes
 * `requireUser`, so teaching `requireUser` about consent would silently place every Host and admin
 * under the LEARNER agreement — a legal question the Founder has explicitly reserved. `requireUser`
 * therefore stays authentication-only, forever, and learner routes opt in here by name.
 *
 * CONSENT IS SERVER-DERIVED. The version is read from `arena_profiles` for the authenticated user
 * and judged by R9A's `consentSatisfied`; nothing in the request body, headers or query can
 * influence it, and there is no second copy of the active version anywhere.
 *
 * FAILS CLOSED. A missing profile, an unreadable profile and a thrown query all refuse — "we could
 * not establish consent" is never allowed to read as "consented".
 *
 * SHAPE. Additive on purpose: the returned object is exactly `requireUser`'s plus `consentDenied`,
 * so a route keeps its existing 401 handling and adds one line:
 *
 *     const { user, base, supabase, consentDenied } = await requireConsentedUser(req);
 *     if (!user) return unauthenticated(req, base);
 *     if (consentDenied) return consentDenied;
 *
 * The refusal is returned BEFORE the route does any protected work, which is the point: no
 * protected payload is assembled and no mutation runs for an unconsented caller.
 */
export async function requireConsentedUser(req: NextRequest) {
  const gate = await requireUser(req);
  if (!gate.user) return { ...gate, consentDenied: null as NextResponse | null };

  const satisfied = await isConsentCurrent(gate.supabase, gate.user.id);

  if (satisfied) return { ...gate, consentDenied: null as NextResponse | null };
  return { ...gate, consentDenied: consentRequired(req, gate.base) };
}

/**
 * 403, not 401 and not 409 (Slice 3.2R-R9B.1).
 *
 * 401 means "we do not know who you are" and clients route it to login — an authenticated learner
 * would be bounced into a login loop. 409 is already spoken for by R9A's `consent_document_stale`.
 * 403 with a machine code matches the measured convention on this API (`practice_forbidden`,
 * `contract_user_mismatch`), so a client can recognise it and send the learner to the consent
 * screen without guessing.
 */
export function consentRequired(req: NextRequest, base: NextResponse) {
  const out = NextResponse.json({ error: "consent_required" }, { status: 403 });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}
