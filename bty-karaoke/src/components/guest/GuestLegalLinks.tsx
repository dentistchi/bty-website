'use client';

// BUILD 26G — the Guest-surface legal footer.
//
// A SEPARATE component from `@/components/legal/LegalLinks` on purpose. That one is shared
// with Host and admin surfaces, which BUILD 26G does not localize; making it locale-aware
// would have silently flipped those pages to English. This renders the same routes and the
// same two links, in the Browser Guest's own language.

import { LEGAL_LINKS, CONTACT_EMAIL } from '@/lib/legal';
import { useGuestT } from './GuestLocaleProvider';

export default function GuestLegalLinks({ showContact = false }: { showContact?: boolean }) {
  const t = useGuestT();
  return (
    <footer className="legal-links" aria-label={t('guest.legal.a11y')}>
      <a href={LEGAL_LINKS.privacy}>{t('guest.legal.privacy')}</a>
      <span aria-hidden>·</span>
      <a href={LEGAL_LINKS.terms}>{t('guest.legal.terms')}</a>
      {showContact && (
        <>
          <span aria-hidden>·</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{t('guest.legal.contact')}</a>
        </>
      )}
    </footer>
  );
}
