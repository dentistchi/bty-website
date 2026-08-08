'use client';

import { useEffect, useState } from 'react';
import { CONSENT_STORAGE_KEY, LEGAL_VERSION, LEGAL_LINKS, consentSatisfied } from '@/lib/legal';
import { useGuestT } from '@/components/guest/GuestLocaleProvider';

/**
 * First-use consent gate. Renders its children (the guest search/request flow) only
 * after the guest affirmatively accepts the current legal version. Consent is
 * site-wide (not tied to one request), stored as a VERSION (not a bare boolean) so a
 * material policy change re-prompts, and clearing browser storage asks again. No dark
 * pattern: the checkbox starts unchecked and Continue is disabled until it is checked.
 * Requires no Google account.
 */
export default function GuestConsentGate({ children }: { children: React.ReactNode }) {
  const t = useGuestT();
  // null = still reading storage (avoid a flash of either state).
  const [consented, setConsented] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setConsented(consentSatisfied(window.localStorage.getItem(CONSENT_STORAGE_KEY)));
    } catch {
      setConsented(false);
    }
  }, []);

  if (consented === null) return null;
  if (consented) return <>{children}</>;

  function accept() {
    if (!checked) return;
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, LEGAL_VERSION);
    } catch {
      /* storage disabled — consent still proceeds for this session */
    }
    setConsented(true);
  }

  const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

  return (
    <div className="card consent-gate" role="group" aria-label={t('guest.consent.a11y')}>
      <h2 className="consent-title">{t('guest.consent.title')}</h2>

      <label className="consent-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          aria-describedby="consent-statement"
        />
        {/* BUILD 26G — ONE language, the Guest's own. This used to render the Korean
            sentence and an English paragraph together; that was a stand-in for
            localization, and now that the Guest has a real language it reads once. Every
            named document — Privacy, Terms, YouTube Terms — is still linked and still
            focusable, so nothing was dropped from what the Guest consents to. */}
        <span id="consent-statement">
          {t('guest.consent.body.before_privacy')}
          <a href={LEGAL_LINKS.privacy} {...ext}>{t('guest.legal.privacy')}</a>
          {t('guest.consent.body.between_links')}
          <a href={LEGAL_LINKS.terms} {...ext}>{t('guest.legal.terms')}</a>
          {t('guest.consent.body.before_youtube')}
          <a href={LEGAL_LINKS.youtubeTerms} {...ext}>{t('guest.consent.youtube_terms')}</a>
          {t('guest.consent.body.after_youtube')}
        </span>
      </label>

      <button type="button" className="consent-continue" onClick={accept} disabled={!checked}>
        {t('guest.consent.agree')}
      </button>
    </div>
  );
}
