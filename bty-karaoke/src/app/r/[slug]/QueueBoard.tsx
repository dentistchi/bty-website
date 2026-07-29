'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayState } from '@/domain/display';
import { badgeForKind } from '@/domain/video-kind';
import { songDisplay } from '@/domain/song-title';
import { myRequestsKey, legacyMyRequestsKey } from '@/domain/guest-requests';

interface Props {
  slug: string;
  /** The room's canonical live event id, or null (namespaces "my songs"). */
  eventId?: string | null;
  /** Poll cadence; guests use 4s (the room-wide default). */
  pollMs?: number;
}

// Read-only, compact view of the WHOLE room so every guest understands the flow:
// who's on stage now, who's next, how many are waiting, and — highlighted —
// where their OWN songs sit. Nothing here mutates state (that lives in the dock);
// the numbers come straight from the canonical /display resolver. My-song ids are
// read from localStorage so no prop coupling to the request form is needed.
export default function QueueBoard({ slug, eventId = null, pollMs = 4000 }: Props) {
  const [state, setState] = useState<DisplayState | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const seq = useRef(0);

  const readMine = useCallback(() => {
    try {
      // Event-scoped key first; fall back to the legacy room-scoped key during
      // the V5 transition so highlighting never disappears for existing guests.
      const raw =
        window.localStorage.getItem(myRequestsKey(slug, eventId)) ??
        (eventId ? window.localStorage.getItem(legacyMyRequestsKey(slug)) : null);
      if (!raw) return new Set<string>();
      const list = JSON.parse(raw) as { requestId?: string }[];
      return new Set(list.map((r) => r.requestId).filter(Boolean) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [slug, eventId]);

  const poll = useCallback(async () => {
    const n = ++seq.current;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as DisplayState;
      if (n !== seq.current) return; // drop a stale response
      setState(data);
      setMine(readMine());
    } catch {
      /* transient — keep last good state */
    }
  }, [slug, readMine]);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => {
      if (!document.hidden) void poll();
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [poll, pollMs]);

  if (!state) return null;
  const { playing, waiting, waitingCount } = state;
  if (!playing && waitingCount === 0) return null; // empty — the search card leads

  return (
    <div className="qb card" aria-label="대기 현황">
      {playing && (
        <div className={`qb-now${mine.has(playing.id) ? ' me' : ''}`}>
          <div className="qb-now-label">
            <span className="live-dot" aria-hidden /> 지금 부르는 중
          </div>
          <div className="qb-now-song">{songDisplay(playing.title).title || playing.title}</div>
          <div className="qb-now-singer">
            {playing.guestName}
            {mine.has(playing.id) && <span className="qb-me-tag">나</span>}
            <QbBadge kind={playing.videoKind} />
          </div>
        </div>
      )}

      <div className="qb-head">
        <span className="eyebrow">다음 대기</span>
        <span className="muted">{waitingCount}곡</span>
      </div>

      {waiting.length === 0 ? (
        <p className="muted qb-empty">대기 중인 곡이 없어요.</p>
      ) : (
        <ol className="qb-list">
          {waiting.map((r, i) => (
            <li key={r.id} className={`qb-row${mine.has(r.id) ? ' me' : ''}`}>
              <span className="qb-pos">{i + 1}</span>
              <span className="qb-row-main">
                <span className="qb-song">{songDisplay(r.title).title || r.title}</span>
                <span className="qb-singer">
                  {r.guestName}
                  {mine.has(r.id) && <span className="qb-me-tag">나</span>}
                </span>
              </span>
              <QbBadge kind={r.videoKind} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QbBadge({ kind }: { kind: DisplayState['waiting'][number]['videoKind'] }) {
  const badge = badgeForKind(kind);
  if (!badge) return null;
  return (
    <span className={`vk-badge vk-${badge.tone} qb-badge`}>
      {badge.emoji} {badge.label}
    </span>
  );
}
