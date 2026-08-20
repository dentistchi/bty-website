/**
 * THE SAVED BTY LANGUAGE PREFERENCE (Slice R4-R4B-R1N-R1).
 *
 * WHAT WAS MEASURED. `LangSwitch` is two `<a href>` links that swap the path prefix and persist
 * NOTHING — its own comment states the contract: "Locale still lives in exactly one place, the path
 * prefix." That works while a tab is alive. It does not survive the WebView being destroyed, and
 * the native shell always relaunches at `https://arena.btydaily.com/start` — a locale-NEUTRAL path.
 * `SetLocale` then sees no `/ko` prefix, writes `document.documentElement.lang = "en"`, and
 * `currentLocale()` reads it back, so every native cold launch routed to `/en/app` no matter what
 * the person had chosen. Device Korean plus product Korean still opened in English, which is what
 * proves nothing was being consulted rather than the wrong thing winning.
 *
 * `middleware.ts` already documents `NEXT_LOCALE` as "the single entry resolver — do not add a
 * parallel locale system", and already PREFERS it over `Accept-Language`. It simply had no writer:
 * zero in the repo. This module is that writer, and the matching reader, in one place so the two
 * cannot drift the way a hand-rolled `document.cookie` parse on each side eventually would.
 *
 * IT IS A PRESENTATION PREFERENCE AND NOTHING ELSE. The value is `"en"` or `"ko"` — no identity, no
 * session, no protected content — so it is deliberately NOT httpOnly: `/start` has to read it in
 * the browser before it decides where to send the launch.
 *
 * THIS MODULE ONLY READS (R4-R4B-R1N-R1-R1). A client-side writer lived here briefly and failed on
 * device: a `document.cookie` write racing a full-page navigation is not the reliable direction for
 * the hosted WKWebView, and WebKit flushes that store to disk asynchronously. `/api/locale/set` is
 * now the single writer, setting the cookie and redirecting in one HTTP response. The writer was
 * REMOVED rather than kept as a fallback — two writers for one preference is two things to reason
 * about and two places for them to disagree.
 */

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year. A language choice should outlive anything else a person does in the app. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type SavedLocale = "en" | "ko";

/** Fail-closed: only the two values the product actually has. Anything else is not a preference. */
export function isSavedLocale(v: unknown): v is SavedLocale {
  return v === "en" || v === "ko";
}

/**
 * Read the saved preference from a raw cookie string (`document.cookie`, or a header value).
 *
 * Takes the string rather than touching `document` so the same function is testable and usable
 * server-side. Returns null for absent, malformed, or unrecognised values — never a guess.
 */
export function readSavedLocale(cookieString: string | null | undefined): SavedLocale | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== LOCALE_COOKIE) continue;
    const raw = decodeURIComponent(part.slice(eq + 1).trim());
    return isSavedLocale(raw) ? raw : null;
  }
  return null;
}

/** The saved preference, read from the live document. Null when none has been made. */
export function currentSavedLocale(): SavedLocale | null {
  if (typeof document === "undefined") return null;
  return readSavedLocale(document.cookie);
}
