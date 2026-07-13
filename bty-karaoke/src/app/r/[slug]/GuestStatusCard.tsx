'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestQueueStatus } from '@/domain/queue';

interface Props {
  slug: string;
  requestId: string;
  title: string;
  artist?: string | null;
  guestName: string;
  initial: GuestQueueStatus;
  /** Request another song — clears this card back to the form. */
  onReset: () => void;
}

const POLL_MS = 4000;

// A persistent, self-updating status card for the guest's own request. It polls
// the canonical server resolver — it never reconstructs queue order locally, so
// the number it shows always follows the DJ's real queue.
export default function GuestStatusCard({
  slug,
  requestId,
  title,
  artist,
  guestName,
  initial,
  onReset,
}: Props) {
  const [status, setStatus] = useState<GuestQueueStatus>(initial);
  const [stale, setStale] = useState(false);
  const stopRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(requestId)}`,
        { cache: 'no-store' },
      );
      if (res.status === 404) {
        // The request left the room entirely — show an honest terminal state.
        setStatus((s) => ({ ...s, state: 'not_found', isUpNext: false, isNowPlaying: false }));
        setStale(false);
        return;
      }
      if (!res.ok) {
        setStale(true);
        return;
      }
      const data = (await res.json()) as { status: GuestQueueStatus };
      setStatus(data.status);
      setStale(false);
    } catch {
      setStale(true);
    }
  }, [slug, requestId]);

  useEffect(() => {
    stopRef.current = false;
    const t = window.setInterval(() => {
      if (!stopRef.current) void poll();
    }, POLL_MS);
    return () => {
      stopRef.current = true;
      window.clearInterval(t);
    };
  }, [poll]);

  const terminal =
    status.state === 'done' || status.state === 'removed' || status.state === 'not_found';

  // Headline + supporting copy per state (Korean UI, matching the room page).
  let eyebrow = '신청 완료';
  let headline: string;
  let support: string | null = '실시간으로 계속 업데이트할게요.';
  let tone = 'waiting';

  if (status.state === 'now_playing') {
    eyebrow = '지금 무대 위';
    headline = '당신 차례예요! 🎤';
    support = '마이크를 잡으세요.';
    tone = 'now';
  } else if (status.state === 'up_next') {
    eyebrow = '곧 시작';
    headline = '곧 당신 차례예요';
    tone = 'next';
  } else if (status.state === 'waiting') {
    eyebrow = '대기 중';
    headline = `지금 대기 ${status.position}번이에요`;
  } else if (status.state === 'done') {
    eyebrow = '완료';
    headline = '이 곡이 끝났어요 🎉';
    support = '즐거우셨다면 한 곡 더 신청해 보세요.';
    tone = 'done';
  } else {
    // removed / not_found
    eyebrow = '대기열에서 내려감';
    headline = '이 신청은 더 이상 대기열에 없어요';
    support = '다시 신청해 주세요.';
    tone = 'done';
  }

  return (
    <div className={`status-card ${tone}`} role="status" aria-live="polite">
      <div className="status-top">
        <span className="status-eyebrow">{eyebrow}</span>
        {!terminal && (
          <span className="status-live" title="실시간 업데이트">
            <span className="status-live-dot" aria-hidden />
            {stale ? '재연결 중…' : '실시간'}
          </span>
        )}
      </div>

      <div className="status-headline">{headline}</div>

      <div className="status-song">
        <div className="status-song-title">{title}</div>
        <div className="status-song-sub">
          {artist ? `${artist} · ` : ''}신청: {guestName}
        </div>
      </div>

      {support && <p className="status-support">{support}</p>}

      <div className="status-actions">
        <button type="button" className="linkish" onClick={onReset}>
          {terminal ? '한 곡 더 신청하기' : '다른 곡 신청하기'}
        </button>
      </div>
    </div>
  );
}
