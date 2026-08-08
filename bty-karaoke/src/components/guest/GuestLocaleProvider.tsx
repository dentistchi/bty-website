'use client';

// BUILD 26G — the Guest locale context.
//
// `initialLocale` is what the SERVER resolved from this request's own `Accept-Language`
// header and the Guest's cookie mirror, so first paint is already in the right language.
// After mount the provider re-resolves against `localStorage` + `navigator.languages` —
// the authoritative browser state — and corrects itself if they disagree.
//
// The provider takes no room, host, or event. A Host's language has no path into it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_GUEST_LOCALE, type GuestLocale } from '@/domain/guest-locale';
import { guestTranslator, type GuestTranslator } from '@/domain/guest-messages';
import { persistGuestLocale, resolveGuestLocaleInBrowser } from '@/lib/guest-locale.client';

interface GuestLocaleContextValue {
  readonly locale: GuestLocale;
  readonly setLocale: (locale: GuestLocale) => void;
  readonly t: GuestTranslator;
}

const GuestLocaleContext = createContext<GuestLocaleContextValue | null>(null);

export function GuestLocaleProvider({
  initialLocale = DEFAULT_GUEST_LOCALE,
  children,
}: {
  initialLocale?: GuestLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<GuestLocale>(initialLocale);

  // Reconcile with the browser AFTER hydration. Doing it during render would mismatch the
  // server HTML; doing it never would ignore a choice made before the cookie existed.
  useEffect(() => {
    const resolved = resolveGuestLocaleInBrowser();
    setLocaleState((current) => (current === resolved ? current : resolved));
  }, []);

  // Keep <html lang> honest for screen readers and browser translation prompts.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: GuestLocale) => {
    persistGuestLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<GuestLocaleContextValue>(
    () => ({ locale, setLocale, t: guestTranslator(locale) }),
    [locale, setLocale],
  );

  return <GuestLocaleContext.Provider value={value}>{children}</GuestLocaleContext.Provider>;
}

/**
 * Guest components read the language from here.
 *
 * Outside a provider it falls back to English rather than throwing — a Guest surface that
 * renders untranslated is recoverable; one that crashes on a locale lookup is not.
 */
export function useGuestLocale(): GuestLocaleContextValue {
  const ctx = useContext(GuestLocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_GUEST_LOCALE,
    setLocale: () => {},
    t: guestTranslator(DEFAULT_GUEST_LOCALE),
  };
}

/** Shorthand for the common case. */
export function useGuestT(): GuestTranslator {
  return useGuestLocale().t;
}
