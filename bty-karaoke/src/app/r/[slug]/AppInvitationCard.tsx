'use client';

import { INVITE_COPY } from '@/domain/app-invite';

// BUILD 19C — the contextual, NON-BLOCKING app invitation shown after the first successful
// request in a guest session/Event. An inline dismissible card (never a modal that blocks web
// use). 앱에서 열기 is the BUILD 19B Universal Link; the App Store action is hidden until a real
// product page exists (BUILD 19D). Web continues uninterrupted via 웹에서 계속하기.

interface Props {
  universalLink: string;
  /** null → the public App Store action is hidden (no dead link). */
  appStoreUrl: string | null;
  onOpenApp: () => void;
  onGetApp: () => void;
  onContinue: () => void;
}

export default function AppInvitationCard({ universalLink, appStoreUrl, onOpenApp, onGetApp, onContinue }: Props) {
  return (
    <div className="card app-invite" role="region" aria-label="앱에서 계속하기">
      <h3 style={{ marginBottom: 6 }}>{INVITE_COPY.title}</h3>
      <p className="muted" style={{ whiteSpace: 'pre-line', marginBottom: 14 }}>
        {INVITE_COPY.body}
      </p>
      <div className="app-invite-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <a href={universalLink} className="button" role="button" onClick={onOpenApp}>
          {INVITE_COPY.openApp}
        </a>
        {appStoreUrl && (
          <a href={appStoreUrl} className="button secondary" role="button" target="_blank" rel="noreferrer" onClick={onGetApp}>
            {INVITE_COPY.getApp}
          </a>
        )}
        <button type="button" className="linkish" onClick={onContinue}>
          {INVITE_COPY.continueWeb}
        </button>
      </div>
    </div>
  );
}
