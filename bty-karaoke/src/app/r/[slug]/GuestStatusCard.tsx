'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestQueueStatus } from '@/domain/queue';
import { canGuestCancel } from '@/domain/queue';
import SwipeableCard from './SwipeableCard';

interface Props {
  slug: string;
  requestId: string;
  title: string;
  artist?: string | null;
  guestName: string;
  initial: GuestQueueStatus;
  /** Bounded capability issued at submit — required to cancel this request. */
  cancelToken: string | null;
  /** Request another song — clears this card back to the form. */
  onReset: () => void;
}

const POLL_MS = 4000;

type Phase = 'live' | 'confirming' | 'cancelling' | 'cancelled';

// A persistent, self-updating status card for the guest's own request. It polls
// the canonical resolver (never reconstructs order locally). While still in line
// the guest can quietly step out: left-swipe reveals a calm coral 취소 surface,
// and a visible "신청 취소" button does the same — both require a confirmation.
export default function GuestStatusCard({
  slug,
  requestId,
  title,
  artist,
  guestName,
  initial,
  cancelToken,
  onReset,
}: Props) {
  const [status, setStatus] = useState<GuestQueueStatus>(initial);
  const [stale, setStale] = useState(false);
  const [phase, setPhase] = useState<Phase>('live');
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(requestId)}`,
        { cache: 'no-store' },
      );
      if (res.status === 404) {
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
    if (phase === 'cancelled') return; // stop polling once we've stepped out
    stopRef.current = false;
    const t = window.setInterval(() => {
      if (!stopRef.current) void poll();
    }, POLL_MS);
    return () => {
      stopRef.current = true;
      window.clearInterval(t);
    };
  }, [poll, phase]);

  const eligible = phase === 'live' && canGuestCancel(status.state) && Boolean(cancelToken);

  async function doCancel() {
    if (!cancelToken) return;
    setPhase('cancelling');
    setError(null);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(requestId)}/cancel`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: cancelToken }),
        },
      );
      if (res.ok) {
        setPhase('cancelled');
        setStatus((s) => ({ ...s, state: 'removed', isUpNext: false, isNowPlaying: false }));
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? '지금은 취소할 수 없어요.');
      setPhase('live');
      void poll();
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요');
      setPhase('live');
    }
  }

  // Calm terminal state after the guest steps out.
  if (phase === 'cancelled') {
    return (
      <div className="status-card cancelled fade-up" role="status">
        <div className="status-headline">신청이 취소됐어요</div>
        <p className="status-support">대기열에서 제거했습니다.</p>
        <div className="status-actions">
          <button type="button" className="linkish" onClick={onReset}>
            다른 곡 신청하기
          </button>
        </div>
      </div>
    );
  }

  const terminal =
    status.state === 'done' || status.state === 'removed' || status.state === 'not_found';

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
    eyebrow = '대기열에서 내려감';
    headline = '이 신청은 더 이상 대기열에 없어요';
    support = '다시 신청해 주세요.';
    tone = 'done';
  }

  const inner = (
    <div className={`status-card ${tone}`} role="status" aria-live="polite">
      <div className="status-top">
        <span className="status-eyebrow">{eyebrow}</span>
        {!terminal && phase !== 'confirming' && (
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
      {error && <div className="banner error">{error}</div>}

      <div className="status-actions">
        {phase === 'confirming' ? (
          <div className="confirm-row">
            <span className="muted">이 신청을 취소할까요?</span>
            <button
              type="button"
              className="cancel-commit"
              onClick={doCancel}
              disabled={phase !== 'confirming'}
            >
              네, 취소
            </button>
            <button type="button" className="linkish" onClick={() => setPhase('live')}>
              아니요
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="linkish" onClick={onReset}>
              {terminal ? '한 곡 더 신청하기' : '다른 곡 신청하기'}
            </button>
            {eligible && (
              <button
                type="button"
                className="linkish cancel-link"
                onClick={() => setPhase('confirming')}
                aria-label="내 신청 취소하기"
              >
                ✕ 신청 취소
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Left-swipe to reveal the calm cancel surface — only while still in line.
  return eligible ? (
    <SwipeableCard
      direction="left"
      tone="coral"
      icon="✕"
      label="신청 취소"
      onCommit={() => setPhase('confirming')}
    >
      {inner}
    </SwipeableCard>
  ) : (
    inner
  );
}
