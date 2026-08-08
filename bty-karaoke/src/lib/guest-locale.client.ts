// BUILD 26G — the browser side of Guest locale persistence. Storage + `navigator` only;
// every decision is made by the pure resolver in `@/domain/guest-locale`.
//
// The Guest's choice is stored ONLY in this browser. Nothing here writes to the room, the
// Host account, the database, or a server session.

import {
  GUEST_LOCALE_COOKIE,
  GUEST_LOCALE_COOKIE_MAX_AGE,
  GUEST_LOCALE_STORAGE_KEY,
  normalizeGuestLocale,
  resolveGuestLocale,
  type GuestLocale,
} from '@/domain/guest-locale';

/** The Guest's explicit choice, if they have made one in this browser. */
export function readStoredGuestLocale(): GuestLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeGuestLocale(window.localStorage.getItem(GUEST_LOCALE_STORAGE_KEY));
  } catch {
    // Private mode / storage disabled: no stored choice, never a thrown render.
    return null;
  }
}

/** The browser's own ordered preference list. */
export function browserLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  const list = Array.isArray(navigator.languages) ? navigator.languages : [];
  if (list.length > 0) return [...list];
  return navigator.language ? [navigator.language] : [];
}

/**
 * Persist an explicit choice.
 *
 * localStorage is the authority (it survives cookie clearing policies that target
 * tracking); the cookie is a first-paint mirror so the SERVER can render the chosen
 * language immediately instead of flashing the browser default on every load.
 */
export function persistGuestLocale(locale: GuestLocale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore: the cookie mirror below still carries the choice.
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${GUEST_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${GUEST_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // Ignore.
  }
}

/** Resolve using this browser's real state. Same pure rule the server applies. */
export function resolveGuestLocaleInBrowser(): GuestLocale {
  return resolveGuestLocale({
    stored: readStoredGuestLocale(),
    browserLanguages: browserLanguages(),
  });
}
