'use client';

// "방금 부른 노래" (Recently Sung) — BUILD 20M-WEB8.
//
// BUILD 20B-WEB7 shipped this file as two sections: Recently Sung plus a browser-local
// "내 노래" saved library. The unauthenticated web Guest has no account-backed identity,
// so a manually curated library is not part of the product — WEB8 removed it and every
// bookmark control with it.
//
// What remains is RECENT ACTIVITY, not a saved library: the Guest's own just-finished
// performances for this Event, derived from the canonical queue by the pure
// `recently-sung` reducer. It is read-only — no bookmark, no request-from-saved, no
// remove — and it mutates no queue, Event or library state.

import { useState } from 'react';
import { songDisplay } from '@/domain/song-title';
import type { RecentlySung } from '@/domain/recently-sung';
import { useGuestT } from '@/components/guest/GuestLocaleProvider';

interface Props {
  recentlySung: readonly RecentlySung[];
}

export default function RecentlySungSection({ recentlySung }: Props) {
  const t = useGuestT();
  // Defaults COLLAPSED and never auto-expands on a new performance.
  const [recentOpen, setRecentOpen] = useState(false);

  // No history → render nothing at all (no empty state, no placeholder header).
  if (recentlySung.length === 0) return null;

  return (
    <div className="my-songs">
      <section className="ms-section" aria-label={t('guest.recently_sung.title')}>
        <button
          type="button"
          className="ms-head"
          aria-expanded={recentOpen}
          onClick={() => setRecentOpen((v) => !v)}
        >
          <span className="ms-caret" aria-hidden>{recentOpen ? '▾' : '▸'}</span>
          <span className="ms-title">{t('guest.recently_sung.title')}</span>
          <span className="ms-count">{recentlySung.length}</span>
        </button>
        {recentOpen && (
          <ul className="ms-list">
            {recentlySung.map((r) => {
              const song = songDisplay(r.title, r.artist);
              return (
                <li className="ms-row" key={r.requestId}>
                  <div className="ms-row-main">
                    <div className="ms-row-song">{song.title || r.title}</div>
                    {song.artist && <div className="ms-row-artist">{song.artist}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
