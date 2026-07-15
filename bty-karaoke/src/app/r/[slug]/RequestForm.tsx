'use client';

import { useEffect, useMemo, useState } from 'react';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { rankResults } from '@/domain/youtube-rank';
import {
  type PerformanceStyle,
  PERFORMANCE_STYLES,
  DEFAULT_STYLE,
  styleCopy,
} from '@/domain/performance-style';
import { guestNameKey, normalizeGuestName, isValidGuestName } from '@/domain/guest-identity';
import {
  myRequestsKey,
  legacyMyRequestsKey,
  pruneMyRequests,
  addMyRequest,
  type MyRequest,
} from '@/domain/guest-requests';
import RequestResultCard from './RequestResultCard';
import MyRequestsDock from './MyRequestsDock';

interface Props {
  slug: string;
  roomOpen: boolean;
  /** The room's canonical live event id, or null (namespaces ownership storage). */
  eventId?: string | null;
  /**
   * Optional: fired after a request is successfully submitted. The event guest
   * screen uses it to refresh live presence immediately; legacy callers omit it
   * (no behavior change).
   */
  onSubmitted?: () => void;
}

type SearchState = 'idle' | 'searching' | 'done';

export default function RequestForm({ slug, roomOpen, eventId = null, onSubmitted }: Props) {
  // Identity — remembered once per room/device (never authentication).
  const [guestName, setGuestName] = useState('');
  const [nameLocked, setNameLocked] = useState(false);
  const [editingName, setEditingName] = useState(true);

  const [query, setQuery] = useState('');
  // Performance Style: MR is the default (Dr. Chi's preference — clean backing
  // tracks). Karaoke biases toward on-screen-words videos; Original is the raw
  // query. Changing style re-runs the search with the same query.
  const [style, setStyle] = useState<PerformanceStyle>(DEFAULT_STYLE);
  const [results, setResults] = useState<YoutubeSearchItem[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [recos, setRecos] = useState<YoutubeSearchItem[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Every request this device submitted (presentation only — statuses come from
  // the server resolver). Persisted per room so a reload keeps continuity.
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedName = window.localStorage.getItem(guestNameKey(slug));
    if (savedName && isValidGuestName(savedName)) {
      setGuestName(normalizeGuestName(savedName));
      setNameLocked(true);
      setEditingName(false);
    }
    try {
      const key = myRequestsKey(slug, eventId);
      let raw = window.localStorage.getItem(key);
      // Transition (V5): when this room now has an event, adopt the guest's
      // legacy room-scoped list ONCE into the event-scoped key. Same room, same
      // in-flight requests, same still-valid capabilities → safe to carry into
      // the FIRST event. A different eventId always yields a different key, so a
      // later event can never inherit a prior event's requests.
      if (!raw && eventId) {
        const legacy = window.localStorage.getItem(legacyMyRequestsKey(slug));
        if (legacy) {
          window.localStorage.setItem(key, legacy);
          raw = legacy;
        }
      }
      if (raw) setMyRequests(pruneMyRequests(JSON.parse(raw) as MyRequest[], Date.now()));
    } catch {
      /* ignore corrupt storage */
    }
  }, [slug, eventId]);

  function persistRequests(list: MyRequest[]) {
    setMyRequests(list);
    try {
      window.localStorage.setItem(myRequestsKey(slug, eventId), JSON.stringify(list));
    } catch {
      /* storage full / disabled — presentation only */
    }
  }

  const removeMyRequest = (requestId: string) =>
    persistRequests(myRequests.filter((r) => r.requestId !== requestId));

  const ranked = useMemo(() => rankResults(results, resultQuery), [results, resultQuery]);

  async function runSearch(e: React.FormEvent | null, mode: PerformanceStyle = style) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setError(null);
    setSearchState('searching');
    setResults([]);
    setRecos([]);
    setShowMore(false);
    setFallbackUrl(null);
    setSearchNote(null);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query.trim())}&style=${mode}`,
      );
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
      if (data.gated) setSearchNote('검색을 준비 중이에요. YouTube에서 찾거나 아래에 링크를 붙여넣어 주세요.');
      else if (data.degraded) setSearchNote('검색이 잠시 붐벼요. YouTube에서 열거나 아래에 링크를 붙여넣어 주세요.');
      else if (items.length === 0) setSearchNote('결과가 없어요. 다른 단어로 검색하거나 아래에 링크를 붙여넣어 주세요.');
      setSearchState('done');
      void loadRecommendations(items, query.trim());
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요');
      setSearchState('idle');
    }
  }

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
      // Keep search/results/recommendations exactly as they are — just track it.
      persistRequests(
        addMyRequest(myRequests, {
          requestId: req.id,
          cancelToken: data.cancelToken ?? null,
          title: req?.youtube_title ?? req?.search_query ?? displayTitle,
          artist: req?.youtube_channel_title ?? displayArtist,
          videoId: req?.youtube_video_id ?? null,
          submittedAt: Date.now(),
        }),
      );
      // Brief "✓ 신청됨" on the card that was submitted.
      setRequestedIds((prev) => [...prev, key]);
      window.setTimeout(() => setRequestedIds((prev) => prev.filter((k) => k !== key)), 2500);
      onSubmitted?.(); // event guest screen refreshes live presence immediately
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

  return (
    <>
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
          <div className="search-modes" role="group" aria-label="공연 스타일">
            {PERFORMANCE_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                className={`seg${style === s ? ' on' : ''}`}
                aria-pressed={style === s}
                onClick={() => {
                  setStyle(s);
                  if (query.trim().length >= 2) void runSearch(null, s);
                }}
              >
                {styleCopy(s).label}
              </button>
            ))}
          </div>
          <p className="muted style-hint">{styleCopy(style).hint}</p>
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

        {ranked.top.length > 0 && (
          <div className="result-group" style={{ marginTop: 12 }}>
            {ranked.top.map((r) => (
              <RequestResultCard
                key={r.videoId}
                item={r}
                onRequest={requestItem}
                pending={submittingKey === r.videoId}
                requested={requestedIds.includes(r.videoId)}
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
                  requested={requestedIds.includes(r.videoId)}
                />
              ))}
          </div>
        )}

        {recos.length > 0 && (
          <div className="reco-group">
            <div className="reco-head">이 노래와 잘 어울려요</div>
            {recos.slice(0, 3).map((r) => (
              <RequestResultCard
                key={r.videoId}
                item={r}
                onRequest={requestItem}
                pending={submittingKey === r.videoId}
                requested={requestedIds.includes(r.videoId)}
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

      {/* Floating live confirmation / my-requests dock */}
      <MyRequestsDock slug={slug} requests={myRequests} guestName={guestName} onRemoved={removeMyRequest} />
    </>
  );
}
