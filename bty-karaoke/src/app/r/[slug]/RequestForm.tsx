'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import type { GuestQueueStatus } from '@/domain/queue';
import GuestStatusCard from './GuestStatusCard';

interface Props {
  slug: string;
  roomOpen: boolean;
}

// The guest's own live request, retained so its status card can keep polling.
interface Submitted {
  requestId: string;
  title: string;
  artist: string | null;
  guestName: string;
  status: GuestQueueStatus;
}

type SearchState = 'idle' | 'searching' | 'done';

export default function RequestForm({ slug, roomOpen }: Props) {
  const router = useRouter();
  const [guestName, setGuestName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YoutubeSearchItem[]>([]);
  const [selected, setSelected] = useState<YoutubeSearchItem | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setError(null);
    setSearchState('searching');
    setResults([]);
    setSelected(null);
    setFallbackUrl(null);
    setSearchNote(null);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Search failed');
        setSearchState('idle');
        return;
      }
      setResults(data.items ?? []);
      setFallbackUrl(data.fallbackUrl ?? null);
      if (data.gated) {
        setSearchNote('Search is being set up. Open YouTube to find your song, or paste a link below.');
      } else if (data.degraded) {
        setSearchNote('Search is busy right now. Open YouTube instead, or paste a link below.');
      } else if ((data.items ?? []).length === 0) {
        setSearchNote('No results. Try different words, or paste a YouTube link below.');
      }
      setSearchState('done');
    } catch {
      setError('Network error — please try again');
      setSearchState('idle');
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        guestName,
        searchQuery: query.trim() || undefined,
      };
      if (selected) {
        body.youtubeVideoId = selected.videoId;
        body.youtubeTitle = selected.title;
        body.youtubeChannelTitle = selected.channelTitle;
        if (selected.thumbnailUrl) body.youtubeThumbnailUrl = selected.thumbnailUrl;
      } else {
        body.youtubeInput = manualInput.trim();
      }

      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong');
        return;
      }
      const req = data.request;
      setSubmitted({
        requestId: req.id,
        title: req?.youtube_title ?? req?.search_query ?? '신청한 곡',
        artist: req?.youtube_channel_title ?? null,
        guestName: req?.guest_name ?? guestName.trim(),
        status: data.status as GuestQueueStatus,
      });
      setResults([]);
      setSelected(null);
      setManualInput('');
      setQuery('');
      setSearchState('idle');
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (!roomOpen) {
    return <div className="banner error">이 방은 닫혀 있어 신청을 받지 않습니다.</div>;
  }

  // After a successful request, the persistent live status card replaces the
  // form. "다른 곡 신청하기" clears it back to the form for another request.
  if (submitted) {
    return (
      <GuestStatusCard
        slug={slug}
        requestId={submitted.requestId}
        title={submitted.title}
        artist={submitted.artist}
        guestName={submitted.guestName}
        initial={submitted.status}
        onReset={() => {
          setSubmitted(null);
          setGuestName('');
        }}
      />
    );
  }

  const canSubmit = Boolean(guestName.trim() && (selected || manualInput.trim()));

  return (
    <div className="card">
      {error && <div className="banner error">{error}</div>}

      <label htmlFor="name">이름</label>
      <input
        id="name"
        type="text"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        placeholder="예: 지민"
        maxLength={40}
      />

      <form onSubmit={runSearch}>
        <label htmlFor="q">노래 또는 가수 검색</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            id="q"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 아이유 밤편지 / IU Blueming"
            maxLength={100}
          />
          <button type="submit" disabled={query.trim().length < 2 || searchState === 'searching'}>
            {searchState === 'searching' ? '…' : '검색'}
          </button>
        </div>
      </form>

      {searchNote && (
        <p className="muted" style={{ marginTop: 10 }}>
          {searchNote}{' '}
          {fallbackUrl && (
            <a href={fallbackUrl} target="_blank" rel="noreferrer">
              YouTube에서 열기 ↗
            </a>
          )}
        </p>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {results.map((r) => {
            const active = selected?.videoId === r.videoId;
            return (
              <button
                key={r.videoId}
                type="button"
                className={`result${active ? ' selected' : ''}`}
                onClick={() => {
                  setSelected(r);
                  setManualInput('');
                }}
              >
                {r.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={r.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <div className="thumb placeholder" />
                )}
                <div className="grow">
                  <div className="title">{r.title}</div>
                  <div className="muted">{r.channelTitle}</div>
                </div>
                <div className="pick">{active ? '✓' : ''}</div>
              </button>
            );
          })}
        </div>
      )}

      <details className="fallback">
        <summary>YouTube 링크 직접 붙여넣기</summary>
        <input
          type="text"
          value={manualInput}
          onChange={(e) => {
            setManualInput(e.target.value);
            if (e.target.value.trim()) setSelected(null);
          }}
          placeholder="https://youtu.be/… 또는 dQw4w9WgXcQ"
        />
      </details>

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? '신청 중…' : '노래 신청하기'}
        </button>
      </div>
    </div>
  );
}
