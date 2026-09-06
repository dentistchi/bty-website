import { NextRequest, NextResponse } from "next/server";
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  isSavedLocale,
} from "@/lib/localePreference";

export const runtime = "nodejs";

/**
 * SAVE THE LANGUAGE CHOICE AND MOVE, IN ONE RESPONSE (Slice R4-R4B-R1N-R1-R1).
 *
 * WHY A SERVER ROUTE FOR A COOKIE THE CLIENT COULD WRITE ITSELF.
 *
 * The first attempt did write it client-side: `document.cookie` inside the language link's
 * `onClick`, immediately before a full-page navigation. It passed every test and failed on device —
 * choose Korean, terminate the app, reopen in English. This repository had already measured why,
 * twice, for a different cookie:
 *
 *   auth/callback — "The client exchange wrote the session to document.cookie (JS store), invisible
 *     to the server gate … POST the tokens so the server Set-Cookies … into WKHTTPCookieStore
 *     (the reliable server→HTTP-store direction)."
 *   durableSession — "WebKit flushes that store to disk ASYNCHRONOUSLY. A hard-kill immediately
 *     after login can drop the cookie before it reaches disk."
 *
 * A JS-store write racing a document teardown, followed by a deliberate hard kill, is both of those
 * failure modes at once. jsdom has a single synchronous cookie store, so no unit test could have
 * caught it.
 *
 * THE INVARIANT THIS ROUTE EXISTS FOR: the `Set-Cookie` and the redirect are THE SAME RESPONSE.
 * The cookie arrives over HTTP — the direction already proven on this platform — and there is no
 * window in which the document could be torn down before the write lands, because the response
 * that writes it is the response that navigates.
 *
 * It is the ONLY writer of `NEXT_LOCALE`. The client-side write was removed rather than kept as a
 * fallback: two writers for one preference is two things to reason about and two places for them
 * to disagree.
 *
 * ★ `mode=json` — THE SAME WRITE, WITHOUT THE MOVE (Teams).
 *
 * MEASURED on the Founder's iPhone: inside a Teams tab the redirect is the problem. The language
 * control was an `<a href="/api/locale/set?...">`, and `/teams` installs a capture-phase click
 * guard that opens any href leaving `/teams` in a real browser -- because every other BTY route is
 * served `X-Frame-Options: DENY` and would otherwise blank the tab. `/api/locale/set` is not
 * `/teams`, so changing language opened iOS's in-app browser at an origin with no Teams host
 * context, and BTY could not start there.
 *
 * Inside Teams, changing language must not move the document at all. So this mode returns the
 * IDENTICAL `Set-Cookie` with a 200 the caller can `fetch` and actually read. It is not a second
 * writer and not a second cookie: the same validation, the same cookie attributes, the same route.
 * Only the response shape differs -- one says "and go here", the other says "done".
 *
 * A plain `fetch` of the redirect form would also have worked, but it downloads a whole page to
 * throw away, and a 200 from the followed destination says nothing about whether the cookie was
 * written. This says exactly what happened, which is what the failure UX needs.
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to");

  /*
    An unrecognised language writes NOTHING and says so. Falling back to a default here would
    record a preference the person never expressed — and once written, that is indistinguishable
    from a real choice for a year.
  */
  if (!isSavedLocale(to)) {
    const bad = NextResponse.json({ ok: false, error: "invalid_locale" }, { status: 400 });
    bad.headers.set("Cache-Control", "no-store");
    return bad;
  }

  /*
    The SAME safe-redirect primitive the auth flow uses — blocks absolute, protocol-relative,
    backslash and login-loop targets, and falls back to `/{locale}/bty` on any violation. The
    locale passed as the fallback is the one just chosen, so even a rejected `next` lands the
    person in the language they asked for.
  */
  const next = sanitizeNextForRedirect(req.nextUrl.searchParams.get("next"), { locale: to });

  /*
    ONE cookie write, TWO response shapes. `mode=json` is for callers that must not navigate; every
    other caller gets the redirect that has always been here. The cookie below is set on whichever
    response this is, so the two can never drift apart.

    303 for the navigating form: the browser follows with GET regardless of how it arrived, and it
    is not cached by default — the right semantics for "I did something, now go here".
  */
  const res =
    req.nextUrl.searchParams.get("mode") === "json"
      ? NextResponse.json({ ok: true, locale: to, next })
      : NextResponse.redirect(new URL(next, req.nextUrl.origin), 303);

  res.cookies.set({
    name: LOCALE_COOKIE,
    value: to,
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    // Secure only where the origin can carry it, so local http development still works.
    secure: req.nextUrl.protocol === "https:",
    /*
      NOT httpOnly, deliberately. `/start` reads this in the browser to decide which locale to
      launch into, before any server round trip exists to ask. It carries "en" or "ko" — no
      identity, no session, nothing protected — so JS visibility costs nothing.
    */
    httpOnly: false,
  });

  res.headers.set("Cache-Control", "no-store");
  return res;
}
