'use client';

// BUILD 26G — the Guest's own language control.
//
// It renders each language's ENDONYM (한국어 / English), never a flag: a flag names a
// country, not a language, and gets it wrong for most of the world. Choosing is immediate —
// no reload, no room exit, no rejoin — and the choice is persisted in this browser only.

import { GUEST_LOCALES, GUEST_LOCALE_ENDONYM } from '@/domain/guest-locale';
import { useGuestLocale } from './GuestLocaleProvider';

export default function GuestLanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useGuestLocale();

  return (
    <div
      className={className ? `guest-lang ${className}` : 'guest-lang'}
      role="group"
      aria-label={t('guest.language.a11y')}
      data-guest-language-switcher
    >
      {GUEST_LOCALES.map((option) => {
        const selected = option === locale;
        return (
          <button
            key={option}
            type="button"
            className="guest-lang-option"
            // `aria-pressed` (not `aria-current`) — these are toggle buttons, and the
            // selected one stays operable so a mis-tap is always recoverable.
            aria-pressed={selected}
            lang={option}
            data-locale={option}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => setLocale(option)}
          >
            {GUEST_LOCALE_ENDONYM[option]}
          </button>
        );
      })}
    </div>
  );
}
