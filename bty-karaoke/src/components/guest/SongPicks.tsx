'use client';

import { useEffect, useRef, useState } from 'react';
import type { GuestLocale } from '@/domain/guest-locale';
import { guestT } from '@/domain/guest-messages';
import { SONG_PICKS, SONG_PICK_CATEGORIES, type SongPick, type SongPickCategory } from '@/domain/song-picks';

interface Props {
  locale: GuestLocale;
  disabled?: boolean;
  initiallyOpen?: boolean;
  onPick: (song: SongPick) => void;
}

/** Browsing is local; only an explicit song selection starts the existing search. */
export default function SongPicks({ locale, disabled = false, initiallyOpen = false, onPick }: Props) {
  const [category, setCategory] = useState<SongPickCategory>('together');
  const panel = useRef<HTMLDetailsElement>(null);
  const songs = SONG_PICKS.filter((song) => song.category === category);

  useEffect(() => {
    if (initiallyOpen && panel.current) panel.current.open = true;
  }, [initiallyOpen]);

  return (
    <details className="song-picks" ref={panel}>
      <summary>
        {guestT(locale, 'guest.picks.title')}
        <span className="song-picks-count">{guestT(locale, 'guest.picks.count', { count: SONG_PICKS.length })}</span>
      </summary>
      <p className="muted song-picks-hint">{guestT(locale, 'guest.picks.hint')}</p>
      <div className="song-picks-categories" role="group" aria-label={guestT(locale, 'guest.picks.categories')}>
        {SONG_PICK_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={`seg${category === item ? ' on' : ''}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {guestT(locale, `guest.picks.category.${item}`)}
          </button>
        ))}
      </div>
      <ul className="song-picks-list" aria-label={guestT(locale, `guest.picks.category.${category}`)}>
        {songs.map((song) => (
          <li key={song.id}>
            <button
              type="button"
              className="song-pick"
              disabled={disabled}
              aria-label={guestT(locale, 'guest.picks.search_song', { title: song.title, artist: song.artist })}
              onClick={() => {
                onPick(song);
                if (panel.current) panel.current.open = false;
              }}
            >
              <span className="song-pick-info">
                <span className="song-pick-title">{song.title}</span>
                <span className="song-pick-artist">{song.artist}</span>
              </span>
              <span className="song-pick-action">{guestT(locale, 'guest.picks.search')}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
