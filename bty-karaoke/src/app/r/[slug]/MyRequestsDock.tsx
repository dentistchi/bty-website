'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestQueueStatus } from '@/domain/queue';
import type { DisplayState } from '@/domain/display';
import { collapsedSummary, isTerminalState, cancelRowAction, type MyRequest } from '@/domain/guest-requests';
import { displaySong } from '@/domain/song-title';
import { safeYoutubeWatchUrl } from '@/domain/youtube';
import { resolvePerfStage, arrivalTrigger, reconcileReady } from '@/domain/self-service';
import SwipeableCard from './SwipeableCard';

interface Props {
  slug: string;
  requests: MyRequest[];
  /** The guest's name — used only for a warm MC-style greeting on the cards. */
  guestName?: string;
  onRemoved: (requestId: string) => void;
}

const POLL_MS = 4000;

function statusText(s?: GuestQueueStatus): string {
  if (!s) return '상태 확인 중…';
  switch (s.state) {
    case 'now_playing':
      return '지금 부를 차례입니다 🎤';
    case 'up_next':
      return '곧 당신 차례예요';
    case 'waiting':
      return `현재 대기 순서 #${s.position}`;
    case 'done':
      return '이 곡이 끝났어요 🎉';
    case 'removed':
      return '신청이 취소됐어요';
    default:
      return '대기열에 없어요';
  }
}

// COMPACT by default: a single floating pill during normal browsing. It NEVER
// auto-expands — a new request only bumps the count and flashes a short gold edge
// pulse. Tapping the pill opens a clean full-width bottom sheet (not a side
// column / split-screen). Every status comes from the canonical server resolver.
export default function MyRequestsDock({ slug, requests, guestName, onRemoved }: Props) {
  // A warm "MC" greeting: "한빛님" when we know the name, else a neutral fallback.
  const namePrefix = guestName && guestName.trim() ? `${guestName.trim()}님` : '';
  const [statuses, setStatuses] = useState<Record<string, GuestQueueStatus>>({});
  const [expanded, setExpanded] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Room-wide stage awareness (one /display poll): whether the stage is open and
  // which request is canonical-first, so "Start My Song" appears ONLY when this
  // guest is genuinely next AND nobody is singing. The server re-checks anyway.
  const [stageOpen, setStageOpen] = useState<boolean | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  // UI-local performance flow (never server state, never a DB column):
  //  - readyId: this guest tapped "I'm Ready" for a specific request (a psychological
  //    pre-start step; the server status stays `waiting` until Start is tapped).
  //  - finishConfirmId: the first tap of a 2-step inline Finish confirmation.
  //  - arrived: a brief one-time "It's your turn" flash flag.
  const [readyId, setReadyId] = useState<string | null>(null);
  const [finishConfirmId, setFinishConfirmId] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const arrivedRef = useRef<string | null>(null); // request id we already fired arrival for
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

  // One room-wide read to learn if the stage is open and who is first in line.
  const pollStage = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as DisplayState;
      setStageOpen(data.playing == null);
      setNextId(data.next?.id ?? null);
    } catch {
      /* transient — keep last known stage state */
    }
  }, [slug]);

  const refreshAll = useCallback(() => {
    void poll();
    void pollStage();
  }, [poll, pollStage]);

  useEffect(() => {
    refreshAll();
    const t = window.setInterval(() => {
      if (!document.hidden) refreshAll();
    }, POLL_MS);
    // Returning to the tab (app switch, YouTube handoff, screen unlock, bfcache)
    // refreshes #N immediately — the guest never has to reload to see a reorder.
    const onVisible = () => {
      if (!document.hidden) refreshAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [refreshAll]);

  // A new request bumps the count + a brief edge pulse. It NEVER auto-opens.
  useEffect(() => {
    if (requests.length > prevCount.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 900);
      prevCount.current = requests.length;
      return () => window.clearTimeout(t);
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
    // Compat guard: an older stored entry without a capability can't be cancelled
    // from this device — never send an unauthorized request.
    if (!r.cancelToken) {
      setError('이 신청은 이 기기에서 취소할 수 없어요.');
      return;
    }
    setCancellingId(r.requestId);
    setError(null);
    // Safe diagnostics only (no token/secret): id suffix, token presence, status.
    // eslint-disable-next-line no-console
    console.debug('[cancel] start', { rid: r.requestId.slice(-6), hasToken: true });
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(r.requestId)}/cancel`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ token: r.cancelToken }),
        },
      );
      // eslint-disable-next-line no-console
      console.debug('[cancel] result', { rid: r.requestId.slice(-6), status: res.status });
      if (res.ok) {
        // Only remove AFTER the server confirms — never optimistic.
        setConfirmingId(null);
        onRemoved(r.requestId);
        return;
      }
      if (res.status === 403) setError('이 기기에서는 이 신청을 취소할 수 없어요.');
      else if (res.status === 409) setError('이미 시작되었거나 취소할 수 없는 곡이에요.');
      else if (res.status === 404) setError('신청곡을 찾을 수 없어요.');
      else setError('지금은 취소할 수 없어요.');
      void poll(); // reconcile the real state; keep the row for retry
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요. 신청은 그대로 유지돼요.');
    } finally {
      setCancellingId(null);
    }
  }

  // Start MY song: promote my waiting request to the stage (only when I'm first
  // and the stage is open — the server enforces this atomically). On success I
  // hand THIS phone off to the YouTube app to cast to the TV; the iPad Display
  // shows the same video. Idempotent under double-tap via the acting guard.
  async function doStart(r: MyRequest) {
    if (actingId) return;
    if (!r.cancelToken) {
      setError('이 신청은 이 기기에서 시작할 수 없어요.');
      return;
    }
    setActingId(r.requestId);
    setError(null);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(r.requestId)}/start`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ token: r.cancelToken }),
        },
      );
      if (res.ok) {
        refreshAll();
        // Hand off to YouTube on THIS phone to cast to the TV. Same-window
        // navigation (no popup blocker; iPad Safari opens the YouTube app).
        const url = safeYoutubeWatchUrl(r.videoId ?? null);
        if (url) window.location.assign(url);
        return;
      }
      if (res.status === 403) setError('이 기기에서는 이 곡을 시작할 수 없어요.');
      else if (res.status === 409) setError('아직 차례가 아니거나 다른 곡이 재생 중이에요.');
      else if (res.status === 404) setError('신청곡을 찾을 수 없어요.');
      else setError('지금은 시작할 수 없어요.');
      refreshAll();
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요.');
    } finally {
      setActingId(null);
    }
  }

  // Finish MY song: end the request I'm currently singing. Idempotent server-side.
  async function doFinish(r: MyRequest) {
    if (actingId) return;
    if (!r.cancelToken) {
      setError('이 신청은 이 기기에서 끝낼 수 없어요.');
      return;
    }
    setActingId(r.requestId);
    setError(null);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(r.requestId)}/finish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ token: r.cancelToken }),
        },
      );
      if (res.ok) {
        refreshAll();
        return;
      }
      if (res.status === 403) setError('이 기기에서는 이 곡을 끝낼 수 없어요.');
      else if (res.status === 409) setError('이 곡은 재생 중이 아니에요.');
      else setError('지금은 끝낼 수 없어요.');
      refreshAll();
    } catch {
      setError('네트워크 오류 — 다시 시도해 주세요.');
    } finally {
      setActingId(null);
    }
  }

  // Canonical performance stage for THIS device — derived purely from the server
  // resolver + the room stage. The UI renders copy/buttons from this; it never
  // recomputes ordering and never auto-advances (Finish stays a human action).
  const stage = resolvePerfStage({
    requestIds: requests.map((r) => r.requestId),
    statuses,
    stageOpen,
    nextId,
  });
  const stageId = 'requestId' in stage ? stage.requestId : null;

  // One-time arrival: a single haptic + flash the first time this guest becomes
  // first-in-line with the stage open. Guarded by request id so repeated 4s polls
  // never re-fire; re-arms once the stage leaves `my_turn`.
  useEffect(() => {
    if (stage.kind === 'my_turn' && stageId && arrivedRef.current !== stageId) {
      arrivedRef.current = stageId;
      setArrived(true);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(35); } catch { /* haptics are optional */ }
      }
      const t = window.setTimeout(() => setArrived(false), 1200);
      return () => window.clearTimeout(t);
    }
    if (stage.kind !== 'my_turn') arrivedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, stageId]);

  // Reconcile UI-local intent against fresh server truth every poll: drop a stale
  // Ready selection (e.g. someone else started → NOT_NEXT), and clear a pending
  // Finish confirmation once the song is no longer on stage.
  useEffect(() => {
    setReadyId((prev) => reconcileReady(prev, stage));
    if (stage.kind !== 'playing') setFinishConfirmId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, stageId]);

  if (requests.length === 0) return null;

  // The MyRequest backing the current stage (for videoId / cancelToken).
  const stageReq = stageId ? requests.find((r) => r.requestId === stageId) ?? null : null;
  const isReady = stage.kind === 'my_turn' && readyId === stageId;
  const stageSong = stageReq ? displaySong(stageReq.title, stageReq.artist).song || stageReq.title : '';
  const stageYoutubeUrl = stageReq ? safeYoutubeWatchUrl(stageReq.videoId ?? null) : null;

  const summary = collapsedSummary(
    requests.map((r) => {
      const s = statuses[r.requestId];
      return s ? { state: s.state, position: s.position } : { state: 'waiting' as const, position: 0 };
    }),
  );

  return (
    <>
      {/* Permanent performance card — a persistent, stage-aware surface (never a
          disappearing toast). It walks the guest through WAITING → MY TURN →
          READY → PLAYING → FINISH. Finish is ALWAYS explicit (2-step inline
          confirm); nothing here auto-advances or auto-finishes. */}
      <div className="dock">
        {stageReq && stage.kind === 'playing' && (
          <div className="perf-card playing hero" role="status">
            <div className="perf-hero-ico" aria-hidden>🎙️</div>
            <div className="perf-eyebrow">
              <span className="live-dot" aria-hidden /> {namePrefix ? `${namePrefix} 무대 위` : '지금 무대 위'}
            </div>
            <div className="perf-title big">노래를 마쳤나요?</div>
            {stageSong && <div className="perf-song">{stageSong}</div>}
            {/* Honest: this app can't stop the YouTube app or the TV cast. The
                singer stops the video in YouTube, then passes the turn here. */}
            <div className="perf-sub">
              노래를 마치면 YouTube에서 영상을 먼저 멈춘 뒤 차례를 넘겨주세요.
            </div>
            <div className="perf-actions">
              {stageYoutubeUrl && (
                <button
                  type="button"
                  className="perf-btn ghost"
                  onClick={() => window.location.assign(stageYoutubeUrl)}
                >
                  ▶ YouTube 열기
                </button>
              )}
              {finishConfirmId === stageReq.requestId ? (
                <div className="perf-confirm">
                  <span className="perf-confirm-q">TV의 영상도 멈췄나요?</span>
                  <div className="perf-confirm-row">
                    <button
                      type="button"
                      className="perf-btn ghost"
                      onClick={() => setFinishConfirmId(null)}
                    >
                      아직이요
                    </button>
                    <button
                      type="button"
                      className="perf-btn finish"
                      onClick={() => doFinish(stageReq)}
                      disabled={actingId === stageReq.requestId}
                    >
                      {actingId === stageReq.requestId ? '넘기는 중…' : '네, 차례 넘기기'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="perf-btn finish"
                  onClick={() => setFinishConfirmId(stageReq.requestId)}
                >
                  ✓ 차례 넘기기
                </button>
              )}
            </div>
          </div>
        )}

        {stageReq && stage.kind === 'my_turn' && !isReady && (
          <div className={`perf-card myturn hero${arrived ? ' arrival' : ''}`} role="status">
            <div className="perf-hero-ico" aria-hidden>🎤</div>
            <div className="perf-eyebrow">It’s your turn</div>
            <div className="perf-title big">{namePrefix ? `${namePrefix}, 준비되셨나요?` : '준비되셨나요?'}</div>
            <div className="perf-sub">노래를 시작하면 YouTube 앱이 열립니다.</div>
            <div className="perf-actions">
              <button
                type="button"
                className="perf-btn ready"
                onClick={() => setReadyId(stageReq.requestId)}
              >
                준비됐어요
              </button>
            </div>
          </div>
        )}

        {stageReq && stage.kind === 'my_turn' && isReady && (
          <div className="perf-card ready hero" role="status">
            <div className="perf-hero-ico" aria-hidden>🎤</div>
            <div className="perf-eyebrow">{namePrefix ? namePrefix : '준비 완료'}</div>
            <div className="perf-title big">이제 시작할까요?</div>
            {stageSong && <div className="perf-song">{stageSong}</div>}
            <div className="perf-sub">
              시작하면 YouTube 앱이 열립니다. TV에 연결한 뒤 노래를 시작하세요.
            </div>
            <div className="perf-actions">
              <button
                type="button"
                className="perf-btn start"
                onClick={() => doStart(stageReq)}
                disabled={actingId === stageReq.requestId}
              >
                {actingId === stageReq.requestId ? '시작하는 중…' : '🎤 노래 시작'}
              </button>
              <button type="button" className="perf-btn ghost" onClick={() => setReadyId(null)}>
                아직이요
              </button>
            </div>
          </div>
        )}

        {stage.kind === 'waiting' && (
          <div className="perf-card waiting" role="status">
            <span className="perf-wait-ico" aria-hidden>🎶</span>
            <span className="perf-wait-text">
              {stage.aheadCount === 0
                ? '곧 당신 차례예요'
                : `앞에 ${stage.aheadCount}곡 · 순서를 기다리는 중`}
            </span>
          </div>
        )}
        <button
          type="button"
          className={`dock-pill${pulse ? ' pulse' : ''}`}
          onClick={() => setExpanded(true)}
          aria-haspopup="dialog"
          aria-label={`내 신청곡 ${summary.count}곡 열기`}
        >
          <span className="dock-ico" aria-hidden>🎤</span>
          <span className="dock-count">내 신청곡 {summary.count}</span>
          {summary.label && <span className="dock-sub">{summary.label}</span>}
        </button>
      </div>

      {/* Full-width bottom sheet — only on explicit tap */}
      {expanded && (
        <div className="dock-sheet-backdrop" onClick={() => setExpanded(false)}>
          <div
            className="dock-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="내 신청곡"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dock-sheet-head">
              <div>
                <div className="dock-sheet-title">내 신청곡 {summary.count}</div>
                <div className="dock-sheet-sub">오늘 대기열에 올린 노래</div>
              </div>
              <button
                type="button"
                className="dock-sheet-close"
                onClick={() => setExpanded(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {error && <div className="banner error">{error}</div>}

            <div className="dock-sheet-list">
              {requests.map((r, i) => {
                const s = statuses[r.requestId];
                const state = s?.state ?? 'waiting';
                const confirming = confirmingId === r.requestId;
                const song = displaySong(r.title, r.artist);
                const action = cancelRowAction(state, Boolean(r.cancelToken));
                // Swipe is an optional enhancement; disabled while confirming or
                // when there's nothing to cancel. The button below works regardless.
                const swipeDisabled = action !== 'cancel' || confirming;

                return (
                  <SwipeableCard
                    key={r.requestId}
                    direction="left"
                    tone="coral"
                    icon="✕"
                    label="신청 취소"
                    disabled={swipeDisabled}
                    onCommit={() => setConfirmingId(r.requestId)}
                  >
                    <div className={`sheet-row tone-${state}`}>
                      <span className="sheet-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                      <div className="sheet-row-main">
                        <div className="sheet-row-song">{song.song || r.title}</div>
                        {song.artist && <div className="sheet-row-artist">{song.artist}</div>}
                        <div className="sheet-row-status">{statusText(s)}</div>
                        {confirming && <div className="sheet-row-confirm-q">이 신청곡을 취소할까요?</div>}
                      </div>

                      {/* Action is pointer-isolated: touching it never starts a
                          swipe, so the button click can't be swallowed on iOS. */}
                      <div
                        className="sheet-row-action"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {confirming ? (
                          <div className="confirm-row">
                            <button type="button" className="linkish" onClick={() => setConfirmingId(null)}>
                              계속 대기
                            </button>
                            <button
                              type="button"
                              className="cancel-commit"
                              onClick={() => doCancel(r)}
                              disabled={cancellingId === r.requestId}
                            >
                              신청 취소
                            </button>
                          </div>
                        ) : action === 'cancel' ? (
                          <button
                            type="button"
                            className="linkish cancel-link"
                            onClick={() => setConfirmingId(r.requestId)}
                            aria-label={`${song.song || r.title} 신청 취소`}
                          >
                            신청 취소
                          </button>
                        ) : action === 'unavailable' ? (
                          <span className="sheet-row-note">이 기기에서 취소 불가</span>
                        ) : null}
                      </div>
                    </div>
                  </SwipeableCard>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
