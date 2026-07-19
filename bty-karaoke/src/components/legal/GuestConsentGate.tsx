'use client';

import { useEffect, useState } from 'react';
import { CONSENT_STORAGE_KEY, LEGAL_VERSION, LEGAL_LINKS, consentSatisfied } from '@/lib/legal';

/**
 * First-use consent gate. Renders its children (the guest search/request flow) only
 * after the guest affirmatively accepts the current legal version. Consent is
 * site-wide (not tied to one request), stored as a VERSION (not a bare boolean) so a
 * material policy change re-prompts, and clearing browser storage asks again. No dark
 * pattern: the checkbox starts unchecked and Continue is disabled until it is checked.
 * Requires no Google account.
 */
export default function GuestConsentGate({ children }: { children: React.ReactNode }) {
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
    <div className="card consent-gate" role="group" aria-label="이용 동의 · Consent">
      <h2 className="consent-title">시작하기 전에 · Before you start</h2>

      <label className="consent-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          aria-describedby="consent-en"
        />
        <span>
          BTY Norebang의 <a href={LEGAL_LINKS.privacy} {...ext}>개인정보처리방침</a>과{' '}
          <a href={LEGAL_LINKS.terms} {...ext}>이용약관</a>을 확인했으며, YouTube 기능 이용 시{' '}
          <a href={LEGAL_LINKS.youtubeTerms} {...ext}>YouTube 이용약관</a>이 적용되는 것에 동의합니다.
        </span>
      </label>

      <p id="consent-en" className="muted consent-en">
        I have reviewed and agree to the BTY Norebang{' '}
        <a href={LEGAL_LINKS.privacy} {...ext}>Privacy Policy</a> and{' '}
        <a href={LEGAL_LINKS.terms} {...ext}>Terms of Service</a>, and understand that YouTube-powered
        features are also subject to the <a href={LEGAL_LINKS.youtubeTerms} {...ext}>YouTube Terms of
        Service</a>.
      </p>

      <button type="button" className="consent-continue" onClick={accept} disabled={!checked}>
        동의하고 계속 · Agree &amp; continue
      </button>
    </div>
  );
}
