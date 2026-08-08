'use client';

import { persistentCtaCopy } from '@/domain/app-invite';
import { useGuestLocale } from '@/components/guest/GuestLocaleProvider';

// BUILD 19C — the PERSISTENT web-to-app entry CTA, always rendered directly under the Room hero.
// Independent of the one-time invitation card: dismissing that card never removes this.
//   ACTIVE (a canonical BUILD 19B Universal Link exists — after the first successful request):
//     an "앱에서 보기" link that opens the app on an installed device and safely falls back to the
//     web link otherwise. No App Store link, and never the words 앱 설치하기 / App Store에서 받기
//     before BUILD 19D provides a real product URL.
//   INFORMATIONAL (before the first request — no handoff can exist without a source request, and
//     we never fabricate one): the same message, not tappable, hinting that the entry activates
//     after the first request.
// Non-blocking: sits in the normal document flow under the hero — never obscures search, the
// request CTA, the keyboard, or queue controls.

interface Props {
  active: boolean;
  universalLink: string | null;
  onOpen: () => void;
}

export default function PersistentAppEntry({ active, universalLink, onOpen }: Props) {
  const { locale, t } = useGuestLocale();
  const copy = persistentCtaCopy(locale);
  return (
    <div className="app-cta" role="region" aria-label={copy.label}>
      <p className="muted app-cta-support">{copy.supporting}</p>
      {active && universalLink ? (
        <a href={universalLink} className="button app-cta-action" onClick={onOpen}>
          {copy.label}
        </a>
      ) : (
        <button
          type="button"
          className="button app-cta-action"
          disabled
          aria-disabled="true"
          title={t('guest.app_entry.title')}
        >
          {copy.label}
        </button>
      )}
    </div>
  );
}
