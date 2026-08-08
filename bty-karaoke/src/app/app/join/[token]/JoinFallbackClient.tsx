'use client';

import { useEffect, useState } from 'react';
import { GuestLocaleProvider, useGuestT } from '@/components/guest/GuestLocaleProvider';
import GuestLanguageSwitcher from '@/components/guest/GuestLanguageSwitcher';

// Resolves the handoff via the server API (slug derived server-side, never from the URL) and
// renders the non-installed fallback. Guest-safe: only a room name + a link to the public
// Guest page for a valid token; a generic message (no slug) for expired/invalid/revoked.

interface Resolved {
  resolution: 'active' | 'event_ended' | 'expired' | 'revoked' | 'invalid';
  roomSlug?: string;
  roomDisplayName?: string;
}

export default function JoinFallbackClient({ token }: { token: string }) {
  // This route is fully client-rendered, so the provider resolves from `navigator.languages`
  // (and any stored choice) on mount — no server locale is threaded in.
  return (
    <GuestLocaleProvider>
      <JoinFallbackBody token={token} />
    </GuestLocaleProvider>
  );
}

function JoinFallbackBody({ token }: { token: string }) {
  const t = useGuestT();
  const [state, setState] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/guest-app-handoffs/${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as Resolved;
        if (alive) setState(data?.resolution ? data : { resolution: 'invalid' });
      } catch {
        if (alive) setState({ resolution: 'invalid' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="card">
        <p className="muted">{t('guest.join.loading')}</p>
      </main>
    );
  }

  const valid = state?.resolution === 'active' || state?.resolution === 'event_ended';
  const roomUrl = valid && state?.roomSlug ? `/r/${encodeURIComponent(state.roomSlug)}` : null;

  return (
    <main className="card" style={{ textAlign: 'center', maxWidth: 520, margin: '48px auto' }}>
      <div className="brand-head" style={{ justifyContent: 'flex-end' }}>
        <GuestLanguageSwitcher />
      </div>
      {valid ? (
        <>
          <h1 style={{ marginBottom: 8 }}>{t('guest.join.ready.title')}</h1>
          <p className="muted" style={{ whiteSpace: 'pre-line', marginBottom: 20 }}>
            {t('guest.join.ready.body')}
          </p>
          {state?.roomDisplayName && (
            <p style={{ marginBottom: 16 }}>
              <b>{state.roomDisplayName}</b>
            </p>
          )}
          {roomUrl && (
            <a href={roomUrl} className="button" role="button">
              {t('guest.app_invite.continue_web')}
            </a>
          )}
        </>
      ) : state?.resolution === 'event_ended' ? (
        <>
          <h1 style={{ marginBottom: 8 }}>{t('guest.join.ended.title')}</h1>
          {roomUrl && (
            <a href={roomUrl} className="button" role="button">
              {t('guest.app_invite.continue_web')}
            </a>
          )}
        </>
      ) : (
        <>
          <h1 style={{ marginBottom: 8 }}>{t('guest.join.invalid.title')}</h1>
          <p className="muted">{t('guest.join.invalid.body')}</p>
        </>
      )}
    </main>
  );
}
