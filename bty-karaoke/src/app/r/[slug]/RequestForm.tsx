'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import type { GuestQueueStatus } from '@/domain/queue';
import { rankResults } from '@/domain/youtube-rank';
import { guestNameKey, normalizeGuestName, isValidGuestName } from '@/domain/guest-identity';
import GuestStatusCard from './GuestStatusCard';
import RequestResultCard from './RequestResultCard';

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
  cancelToken: string | null;
}

type SearchState = 'idle' | 'searching' | 'done';

export default function RequestForm({ slug, roomOpen }: Props) {
  const router = useRouter();

  // Identity — remembered once per room/device (never authentication).
  const [guestName, setGuestName] = useState('');
  const [nameLocked, setNameLocked] = useState(false);
  const [editingName, setEditingName] = useState(true);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YoutubeSearchItem[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [recos, setRecos] = useState<YoutubeSearchItem[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  // Load the remembered name once.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(guestNameKey(slug)) : null;
    if (saved && isValidGuestName(saved)) {
      setGuestName(normalizeGuestName(saved));
      setNameLocked(true);
      setEditingName(false);
    }
  }, [slug]);

  const ranked = useMemo(() => rankResults(results, resultQuery), [results, resultQuery]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setError(null);
    setSearchState('searching');
    setResults([]);
    setRecos([]);
    setShowMore(false);
    setFallbackUrl(null);
    setSearchNote(null);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '검색에 실패했어요');
        setSearchState('idle');
        return;
      }
      const items: YoutubeSearchItem[] = data.items ?? [];
      setResults(items);
      setResultQuery(query.trim());
      setFallbackUrl(data.fallbackUrl ?? null);
      if (data.gated) {
        setSearchNote('검색을 준비 중이에요. YouTube에서 찾거나 아래에 링크를 붙여넣어 주세요.');
      } else if (data.degraded) {
        setSearchNote('검색이 잠시 붐벼요. YouTube에서 열거나 아래에 링크를 붙여넣어 주세요.');
      } else if (items.length === 0) {
        setSearchNote('결과가 없어요. 다른 단어로 검색하거나 아래에 링크를 붙여넣어 주세요.');
      }
      setSearchState('done');
      void loadRecommendations(items, query.trim());
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요');
      setSearchState('idle');
    }
  }

  // Related songs — best-effort, never blocks the primary results.
  async function loadRecommendations(items: YoutubeSearchItem[], q: string) {
    const top = rankResults(items, q).top[0];
    if (!top) return;
    try {
      const url = `/api/youtube/recommend?title=${encodeURIComponent(top.title)}&channel=${encodeURIComponent(
        top.channelTitle,
      )}&videoId=${encodeURIComponent(top.videoId)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setRecos((data.items ?? []).filter((r: YoutubeSearchItem) => r.videoId !== top.videoId));
    } catch {
      /* recommendations are optional */
    }
  }

  async function submit(
    payload: Record<string, unknown>,
    displayTitle: string,
    displayArtist: string | null,
    key: string,
  ) {
    if (submittingKey) return; // one in-flight request at a time (dedupe)
    const name = normalizeGuestName(guestName);
    if (!isValidGuestName(name)) {
      setEditingName(true);
      setError('먼저 이름을 입력해 주세요');
      return;
    }
    setSubmittingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: name, searchQuery: resultQuery || undefined, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '문제가 발생했어요');
        return;
      }
      window.localStorage.setItem(guestNameKey(slug), name);
      setGuestName(name);
      setNameLocked(true);
      setEditingName(false);
      const req = data.request;
      setSubmitted({
        requestId: req.id,
        title: req?.youtube_title ?? req?.search_query ?? displayTitle,
        artist: req?.youtube_channel_title ?? displayArtist,
        guestName: req?.guest_name ?? name,
        status: data.status as GuestQueueStatus,
        cancelToken: data.cancelToken ?? null,
      });
      router.refresh();
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요');
    } finally {
      setSubmittingKey(null);
    }
  }

  const requestItem = (item: YoutubeSearchItem) =>
    submit(
      {
        youtubeVideoId: item.videoId,
        youtubeTitle: item.title,
        youtubeChannelTitle: item.channelTitle,
        ...(item.thumbnailUrl ? { youtubeThumbnailUrl: item.thumbnailUrl } : {}),
      },
      item.title,
      item.channelTitle,
      item.videoId,
    );

  const requestManual = () =>
    submit({ youtubeInput: manualInput.trim() }, manualInput.trim(), null, 'manual');

  if (!roomOpen) {
    return <div className="banner error">이 방은 닫혀 있어 신청을 받지 않습니다.</div>;
  }

  if (submitted) {
    return (
      <GuestStatusCard
        slug={slug}
        requestId={submitted.requestId}
        title={submitted.title}
        artist={submitted.artist}
        guestName={submitted.guestName}
        initial={submitted.status}
        cancelToken={submitted.cancelToken}
        onReset={() => {
          setSubmitted(null);
          setResults([]);
          setRecos([]);
          setQuery('');
          setSearchState('idle');
        }}
      />
    );
  }

  return (
    <div className="card">
      {error && <div className="banner error">{error}</div>}

      {/* Identity — entered once, then a compact row */}
      {nameLocked && !editingName ? (
        <div className="identity-row">
          <span className="identity-name">
            신청자 <b>{guestName}</b>
          </span>
          <button type="button" className="linkish" onClick={() => setEditingName(true)}>
            변경
          </button>
        </div>
      ) : (
        <div className="identity-edit">
          <label htmlFor="name">이름</label>
          <input
            id="name"
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="예: 한빛"
            maxLength={40}
          />
          {nameLocked && (
            <button
              type="button"
              className="linkish"
              onClick={() => isValidGuestName(guestName) && setEditingName(false)}
            >
              완료
            </button>
          )}
        </div>
      )}

      <form onSubmit={runSearch}>
        <label htmlFor="q">무슨 노래를 부르고 싶으세요?</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="노래 제목 또는 가수"
            maxLength={100}
            autoFocus
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

      {/* Primary results — best few, directly requestable */}
      {ranked.top.length > 0 && (
        <div className="result-group" style={{ marginTop: 12 }}>
          {ranked.top.map((r) => (
            <RequestResultCard
              key={r.videoId}
              item={r}
              onRequest={requestItem}
              pending={submittingKey === r.videoId}
            />
          ))}

          {!showMore && ranked.more.length > 0 && (
            <button type="button" className="linkish more-results" onClick={() => setShowMore(true)}>
              결과 더 보기 ({ranked.more.length})
            </button>
          )}
          {showMore &&
            ranked.more.map((r) => (
              <RequestResultCard
                key={r.videoId}
                item={r}
                onRequest={requestItem}
                pending={submittingKey === r.videoId}
              />
            ))}
        </div>
      )}

      {/* Related songs — visually distinct, same request interaction */}
      {recos.length > 0 && (
        <div className="reco-group">
          <div className="reco-head">이 노래와 잘 어울려요</div>
          {recos.slice(0, 3).map((r) => (
            <RequestResultCard
              key={r.videoId}
              item={r}
              onRequest={requestItem}
              pending={submittingKey === r.videoId}
              variant="reco"
            />
          ))}
        </div>
      )}

      <details className="fallback">
        <summary>YouTube 링크 직접 붙여넣기</summary>
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="https://youtu.be/… 또는 dQw4w9WgXcQ"
        />
        <button
          type="button"
          style={{ marginTop: 10 }}
          onClick={requestManual}
          disabled={!manualInput.trim() || submittingKey === 'manual'}
        >
          {submittingKey === 'manual' ? '신청 중…' : '이 링크로 신청'}
        </button>
      </details>
    </div>
  );
}
