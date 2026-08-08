// BUILD 26G — QR Browser Guest locale resolution. PURE: no storage, no DOM, no network.
//
// THE RULE THIS FILE EXISTS TO ENFORCE:
//
//     Host language belongs to Host.
//     QR Browser Guest language belongs to the Browser Guest.
//     Room language controls neither.
//
// A QR identifies the ROOM, never the presentation language. Nothing here accepts a room,
// a host, an owner or an event — so a Korean Host's QR structurally cannot make a Guest's
// browser render Korean. That is not a convention; there is no parameter to pass.

export type GuestLocale = 'en' | 'ko';

/** Every language the Guest UI ships. */
export const GUEST_LOCALES: readonly GuestLocale[] = ['en', 'ko'] as const;

/**
 * The source/fallback language. English, deliberately: an unsupported browser language
 * must land on English and NEVER silently on Korean.
 */
export const DEFAULT_GUEST_LOCALE: GuestLocale = 'en';

/** Where an explicit Guest choice is persisted (browser-local only). */
export const GUEST_LOCALE_STORAGE_KEY = 'bty-karaoke:guest-locale';

/**
 * A first-paint mirror of the same choice.
 *
 * The server cannot read localStorage, so without this a Guest who chose English on a
 * Korean phone would see one Korean frame before hydration corrected it. The cookie is a
 * browser-local mirror carried on the request — it is NOT a server session, and it is
 * never written to the room, the Host account, or the database.
 */
export const GUEST_LOCALE_COOKIE = 'bty_guest_locale';

/** One year; a Guest's language choice should outlive a single night of karaoke. */
export const GUEST_LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * A BCP-47 tag → a supported locale, or null when unsupported.
 * `ko-KR` → `ko`, `en-GB` → `en`, `fr-FR` → null (the caller then falls back).
 */
export function normalizeGuestLocale(tag: string | null | undefined): GuestLocale | null {
  if (typeof tag !== 'string') return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (!primary) return null;
  return (GUEST_LOCALES as readonly string[]).includes(primary) ? (primary as GuestLocale) : null;
}

/**
 * The FIRST supported language in the browser's ordered preference list.
 *
 * Order is the whole point: `["en-US","ko-KR"]` is an English speaker who also reads
 * Korean and must get English, while `["ko-KR","en-US"]` must get Korean. Scanning for
 * "does Korean appear anywhere" would get both backwards.
 */
export function pickFromBrowserLanguages(languages: readonly string[] | null | undefined): GuestLocale | null {
  if (!Array.isArray(languages)) return null;
  for (const tag of languages) {
    const locale = normalizeGuestLocale(tag);
    if (locale) return locale;
  }
  return null;
}

/**
 * Parse an `Accept-Language` header into an ordered tag list, honouring q-values.
 *
 * This is the SERVER's view of the same browser setting `navigator.languages` exposes to
 * the client, so first paint and post-hydration agree for a Guest who has made no explicit
 * choice. `*` is dropped: it means "anything", which is the fallback, not a preference.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (typeof header !== 'string' || !header.trim()) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .filter((p) => p.startsWith('q='))
        .map((p) => Number.parseFloat(p.slice(2)))
        .find((n) => Number.isFinite(n));
      return { tag: tag.trim(), q: q === undefined ? 1 : q };
    })
    .filter((entry) => entry.tag.length > 0 && entry.tag !== '*' && entry.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag);
}

export interface GuestLocaleInput {
  /** An explicit choice this Browser Guest made previously (localStorage or its cookie mirror). */
  readonly stored?: string | null;
  /** `navigator.languages` on the client, or the parsed `Accept-Language` on the server. */
  readonly browserLanguages?: readonly string[] | null;
}

/**
 * The ONE resolution rule, in priority order:
 *
 *   1. an explicit choice by THIS Browser Guest
 *   2. the browser's own preferred languages
 *   3. English
 *
 * Note what is absent: there is no room, host, owner, or event input. A Host's language
 * cannot reach this function, so it cannot influence the result.
 */
export function resolveGuestLocale(input: GuestLocaleInput = {}): GuestLocale {
  const chosen = normalizeGuestLocale(input.stored);
  if (chosen) return chosen;
  const fromBrowser = pickFromBrowserLanguages(input.browserLanguages);
  if (fromBrowser) return fromBrowser;
  return DEFAULT_GUEST_LOCALE;
}

/** The label each language shows for ITSELF — an endonym is never translated. */
export const GUEST_LOCALE_ENDONYM: Readonly<Record<GuestLocale, string>> = {
  en: 'English',
  ko: '한국어',
};
