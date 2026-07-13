'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestQueueStatus } from '@/domain/queue';
import { canGuestCancel } from '@/domain/queue';
import { collapsedSummary, isTerminalState, type MyRequest } from '@/domain/guest-requests';
import SwipeableCard from './SwipeableCard';

interface Props {
  slug: string;
  requests: MyRequest[];
  /** Drop a request from the retained list (after cancel or a terminal state). */
  onRemoved: (requestId: string) => void;
}

const POLL_MS = 4000;

function statusText(s?: GuestQueueStatus): string {
  if (!s) return '상태 확인 중…';
  switch (s.state) {
    case 'now_playing':
      return '지금 무대 위 🎤';
    case 'up_next':
      return '곧 당신 차례예요';
    case 'waiting':
      return `지금 대기 ${s.position}번이에요`;
    case 'done':
      return '이 곡이 끝났어요 🎉';
    case 'removed':
      return '대기열에서 내려갔어요';
    default:
      return '대기열에 없어요';
  }
}

// The floating "내 신청곡" experience. Enters expanded on a new request, collapses
// to a compact pill, and tracks EVERY request this device submitted — each status
// resolved by the canonical server resolver (never local order). Cancel via the
// visible button OR a left-swipe; both open the same confirmation.
export default function MyRequestsDock({ slug, requests, onRemoved }: Props) {
  const [statuses, setStatuses] = useState<Record<string, GuestQueueStatus>>({});
  const [expanded, setExpanded] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const collapseTimer = useRef<number | null>(null);
  const prevCount = useRef(0);
  const terminalSeen = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    const entries = await Promise.all(
      requests.map(async (r) => {
        try {
          const res = await fetch(
            `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(r.requestId)}`,
            { cache: 'no-store' },
          );
          if (res.status === 404) {
            return [
              r.requestId,
              { requestId: r.requestId, state: 'not_found', position: 0, aheadCount: 0, isUpNext: false, isNowPlaying: false } as GuestQueueStatus,
            ] as const;
          }
          if (!res.ok) return null;
          const data = (await res.json()) as { status: GuestQueueStatus };
          return [r.requestId, data.status] as const;
        } catch {
          return null;
        }
      }),
    );
    setStatuses((prev) => {
      const next = { ...prev };
      for (const e of entries) if (e) next[e[0]] = e[1];
      return next;
    });
  }, [slug, requests]);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(t);
  }, [poll]);

  // Expand briefly when a new request arrives, then collapse to the pill.
  useEffect(() => {
    if (requests.length > prevCount.current) {
      setExpanded(true);
      if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
      collapseTimer.current = window.setTimeout(() => setExpanded(false), 4500);
    }
    prevCount.current = requests.length;
  }, [requests.length]);

  // Prune requests that reach a terminal state (after a brief honest note).
  useEffect(() => {
    for (const r of requests) {
      const s = statuses[r.requestId];
      if (s && isTerminalState(s.state) && !terminalSeen.current.has(r.requestId)) {
        terminalSeen.current.add(r.requestId);
        window.setTimeout(() => onRemoved(r.requestId), 6000);
      }
    }
  }, [statuses, requests, onRemoved]);

  async function doCancel(r: MyRequest) {
    if (!r.cancelToken) return;
    setCancellingId(r.requestId);
    setError(null);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(r.requestId)}/cancel`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: r.cancelToken }),
        },
      );
      if (res.ok) {
        setConfirmingId(null);
        onRemoved(r.requestId);
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d?.error ?? '지금은 취소할 수 없어요.');
      void poll();
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요');
    } finally {
      setCancellingId(null);
    }
  }

  if (requests.length === 0) return null;

  const summaryRows = requests.map((r) => {
    const s = statuses[r.requestId];
    return s ? { state: s.state, position: s.position } : { state: 'waiting' as const, position: 0 };
  });
  const summary = collapsedSummary(summaryRows);

  if (!expanded) {
    return (
      <div className="dock" data-collapsed="true">
        <button className="dock-pill fade-up" onClick={() => setExpanded(true)} aria-label={`내 신청곡 ${summary.count}곡 펼치기`}>
          <span className="dock-ico" aria-hidden>🎤</span>
          <span className="dock-count">내 신청곡 {summary.count}</span>
          <span className="dock-sub">{summary.label}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="dock expanded" role="dialog" aria-label="내 신청곡" aria-modal="false">
      <div className="dock-head">
        <span className="dock-title">
          <span aria-hidden>🎤</span> 내 신청곡 {summary.count}
        </span>
        <button type="button" className="linkish" onClick={() => setExpanded(false)} aria-label="접기">
          접기
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
      <div className="dock-list">
        {requests.map((r, i) => {
          const s = statuses[r.requestId];
          const state = s?.state ?? 'waiting';
          const confirming = confirmingId === r.requestId;
          const eligible = Boolean(s) && canGuestCancel(state) && Boolean(r.cancelToken);

          const row = (
            <div className={`dock-row tone-${state}`}>
              <span className="dock-num" aria-hidden>{i + 1}</span>
              <div className="grow">
                <div className="dock-song">{r.title}</div>
                <div className="dock-status">{statusText(s)}</div>
              </div>
              {confirming ? (
                <div className="confirm-row">
                  <button
                    type="button"
                    className="cancel-commit"
                    onClick={() => doCancel(r)}
                    disabled={cancellingId === r.requestId}
                  >
                    취소
                  </button>
                  <button type="button" className="linkish" onClick={() => setConfirmingId(null)}>
                    유지
                  </button>
                </div>
              ) : eligible ? (
                <button
                  type="button"
                  className="linkish cancel-link"
                  onClick={() => setConfirmingId(r.requestId)}
                  aria-label={`${r.title} 신청 취소`}
                >
                  ✕ 신청 취소
                </button>
              ) : null}
            </div>
          );

          return eligible && !confirming ? (
            <SwipeableCard
              key={r.requestId}
              direction="left"
              tone="coral"
              icon="✕"
              label="신청 취소"
              onCommit={() => setConfirmingId(r.requestId)}
            >
              {row}
            </SwipeableCard>
          ) : (
            <div key={r.requestId}>{row}</div>
          );
        })}
      </div>
    </div>
  );
}
