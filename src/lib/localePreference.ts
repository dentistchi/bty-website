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

/** The exact `document.cookie` assignment. Built here so the attributes are stated once. */
export function localeCookieAssignment(locale: SavedLocale, secure: boolean): string {
  const attrs = [
    `${LOCALE_COOKIE}=${locale}`,
    "path=/",
    `max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ];
  if (secure) attrs.push("secure");
  return attrs.join("; ");
}

/**
 * Persist an EXPLICIT choice. Called only from the language control — never inferred from a route,
 * so simply visiting a `/ko` link can never silently rewrite someone's preference.
 */
export function saveLocalePreference(locale: SavedLocale): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  document.cookie = localeCookieAssignment(locale, secure);
}

/** The saved preference, read from the live document. Null when none has been made. */
export function currentSavedLocale(): SavedLocale | null {
  if (typeof document === "undefined") return null;
  return readSavedLocale(document.cookie);
}
