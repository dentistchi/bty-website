'use client';

import { useEffect, useRef, useState } from 'react';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { badgeForVideo } from '@/domain/video-kind';
import DevelopedWithYouTube from '@/components/youtube/DevelopedWithYouTube';

interface Props {
  /** Adds the chosen song to the queue (server appends at the tail). */
  onAddSong: (payload: Record<string, unknown>) => Promise<'ok' | 'error'>;
  onClose: () => void;
}

type Mode = 'karaoke' | 'original';
type SearchState = 'idle' | 'searching' | 'done';

// DJ-side "Add Song": reuses the SAME public YouTube search API as guests, plus
// an Original ↔ Karaoke/Lyrics toggle and video-kind badges so the DJ can pick a
// version likely to show words on the TV. Adding routes through the DJ-authed
// endpoint; the song lands at the tail of the canonical queue.
export default function DjAddSongSheet({ onAddSong, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('karaoke');
  const [name, setName] = useState('');
  const [results, setResults] = useState<YoutubeSearchItem[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [note, setNote] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedTitle, setAddedTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    sheetRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => (openerRef.current as HTMLElement | null)?.focus?.();
  }, []);

  async function runSearch(e?: React.FormEvent, m: Mode = mode) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setState('searching');
    setError(null);
    setResults([]);
    setNote(null);
    setFallbackUrl(null);
    try {
      const url = `/api/youtube/search?q=${encodeURIComponent(query.trim())}${m === 'original' ? '&original=1' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Search failed');
        setState('idle');
        return;
      }
      const items: YoutubeSearchItem[] = data.items ?? [];
      setResults(items);
      setFallbackUrl(data.fallbackUrl ?? null);
      if (data.gated) setNote('Search is warming up — you can paste a link on the guest page.');
      else if (data.degraded) setNote('Search is busy right now. Try again in a moment.');
      else if (items.length === 0) setNote('No results. Try different words.');
      setState('done');
    } catch {
      setError('Network error. Try again.');
      setState('idle');
    }
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    if (query.trim().length >= 2) void runSearch(undefined, m);
  }

  async function add(item: YoutubeSearchItem) {
    if (addingId) return;
    setAddingId(item.videoId);
    setError(null);
    const r = await onAddSong({
      guestName: name.trim() || undefined,
      searchQuery: query.trim() || undefined,
      youtubeVideoId: item.videoId,
      youtubeTitle: item.title,
      youtubeChannelTitle: item.channelTitle,
      ...(item.thumbnailUrl ? { youtubeThumbnailUrl: item.thumbnailUrl } : {}),
      // R3 — this Host path DOES persist a YouTube snapshot into karaoke_requests, so it carries
      // provenance exactly as the guest path does. Verbatim, per item, never regenerated.
      ...(item.youtubeProvenance ? { youtubeProvenance: item.youtubeProvenance } : {}),
    });
    setAddingId(null);
    if (r === 'ok') {
      setAddedTitle(item.title);
      window.setTimeout(() => setAddedTitle(null), 2200);
    } else {
      setError('Could not add the song. Try again.');
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="action-sheet dj-add-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Add a song to the queue"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="sheet-eyebrow">Add a song</div>
        <div className="dj-add-forwhom">
          <label htmlFor="dj-add-name">For whom?</label>
          <input
            id="dj-add-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="DJ"
            maxLength={40}
          />
        </div>

        <form onSubmit={runSearch} className="dj-add-searchrow">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or artist"
            maxLength={100}
          />
          <button type="submit" disabled={query.trim().length < 2 || state === 'searching'}>
            {state === 'searching' ? '…' : 'Search'}
          </button>
        </form>

        <div className="dj-add-modes" role="group" aria-label="Search type">
          <button
            type="button"
            className={`seg${mode === 'karaoke' ? ' on' : ''}`}
            aria-pressed={mode === 'karaoke'}
            onClick={() => switchMode('karaoke')}
          >
            🎤 Karaoke / Lyrics
          </button>
          <button
            type="button"
            className={`seg${mode === 'original' ? ' on' : ''}`}
            aria-pressed={mode === 'original'}
            onClick={() => switchMode('original')}
          >
            Original
          </button>
        </div>

        {error && <div className="banner error" style={{ marginTop: 10 }}>{error}</div>}
        {addedTitle && (
          <div className="banner ok" style={{ marginTop: 10 }}>
            ✓ Added to the queue
          </div>
        )}
        {note && (
          <p className="muted" style={{ marginTop: 10 }}>
            {note}{' '}
            {fallbackUrl && (
              <a href={fallbackUrl} target="_blank" rel="noreferrer">
                Open on YouTube ↗
              </a>
            )}
          </p>
        )}

        <div className="dj-add-results">
          {/* J3 — this is a HOST surface that runs its own /api/youtube/search call, so the API has
              a presence here exactly as it does on the guest surface. Rendered only when results
              exist, for the same reason. */}
          {results.length > 0 && (
            <div className="dwyt-row">
              <DevelopedWithYouTube height={18} />
            </div>
          )}
          {results.map((item) => {
            const badge = badgeForVideo(item.title, item.channelTitle);
            return (
              <div className="dj-add-row" key={item.videoId}>
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <div className="thumb placeholder" aria-hidden />
                )}
                <div className="grow">
                  <div className="title">{item.title}</div>
                  <div className="muted">{item.channelTitle}</div>
                  {badge && (
                    <span className={`vk-badge vk-${badge.tone}`}>
                      {badge.emoji} {badge.label}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => add(item)}
                  disabled={addingId === item.videoId}
                  aria-label={`Add ${item.title} to the queue`}
                >
                  {addingId === item.videoId ? 'Adding…' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>

        <button type="button" className="sheet-close linkish" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
