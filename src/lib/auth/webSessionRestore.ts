"use client";

import { supabase } from "@/lib/supabase";
import { readWithBound, isAuthReadTimeout } from "@/lib/auth/boundedSessionRead";

/**
 * RE-SEAT THE SERVER COOKIE FROM THE SESSION THE BROWSER ALREADY HAS (Slice R4-R4B-R2).
 *
 * WHAT WAS MEASURED. `middleware.ts` gates on the httpOnly server cookie and nothing else. The
 * browser, meanwhile, holds a live Supabase session — `persistSession: true, autoRefreshToken:
 * true` — that nothing on the web path ever consulted: the restore effect on the login landing is
 * `isNative()`-gated, so web fell straight through to the form and on to Google. A MISSING SERVER
 * COOKIE WAS BEING TREATED AS NO USER SESSION, and every one of those unnecessary trips produced
 * another "You shared some Google Account data with BTY" email.
 *
 * This is the web twin of `restoreNativeSession`, and deliberately the same shape: ask for the
 * session that already exists, hand its tokens to the EXISTING `POST /api/auth/session` bridge,
 * and let the server write the cookie. No new endpoint, no new store, no new key, no new identity.
 * Native rebuilds from the iOS Keychain; web rebuilds from the Supabase client's own persisted
 * session. Both end in the same place, through the same route.
 *
 * MIDDLEWARE IS NOT WEAKENED. It still trusts only the server cookie. What changes is that the
 * cookie can now be re-established from a session the user genuinely holds, instead of being
 * rebuilt by sending them back through an identity provider they already authenticated with.
 *
 * BOUNDED, because this runs on a launch path. R4-R4B-R1 established the rule after an unbounded
 * session read left the app on a navy screen forever: a bound that expires means WE DO NOT KNOW.
 * Here that resolves to `false` — "could not restore" — which lands the person on the normal
 * sign-in form. It never asserts they are signed out, and it never retries itself.
 */

/** One attempt, bounded. `true` only when the server confirms the cookie is seated. */
export async function restoreWebSession(): Promise<boolean> {
  try {
    if (!supabase) return false;
    const client = supabase;

    /*
      `getSession()` returns the persisted session and refreshes it if the access token has
      expired — so an expired-but-refreshable session is restored rather than sent to Google, which
      is the majority of the returning-user case this slice exists for.
    */
    const { data, error } = await readWithBound(() => client.auth.getSession());
    if (error) return false;
    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) return false;

    // The EXISTING bridge — the same route the native restore and the auth callback both use.
    const res = await readWithBound((signal) =>
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
        credentials: "include",
        signal,
      }),
    );
    if (!res.ok) return false;

    // Only the server's own confirmation counts as restored.
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok === true;
  } catch (e) {
    /*
      Includes our own bound expiring. Reported as "could not restore" — never as "no session" —
      and the caller shows the sign-in form rather than looping. `isAuthReadTimeout` is referenced
      so the distinction is explicit at the seam rather than implied by a bare catch.
    */
    void isAuthReadTimeout(e);
    return false;
  }
}
