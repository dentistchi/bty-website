'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestQueueStatus } from '@/domain/queue';
import type { DisplayState } from '@/domain/display';
import {
  collapsedSummary,
  cancelRowAction,
  shouldDropOwned,
  groupOwned,
  readyStageCopy,
  hasActiveMedia,
  type MyRequest,
  type OwnedRow,
} from '@/domain/guest-requests';
import { displaySong } from '@/domain/song-title';
import { resolvePerfStage } from '@/domain/self-service';
import SwipeableCard from './SwipeableCard';

interface Props {
  slug: string;
  requests: MyRequest[];
  /** The guest's name — used only for a warm MC-style greeting on the cards. */
  guestName?: string;
  onRemoved: (requestId: string) => void;
  /** Re-request a completed song (creates a NEW request; history is untouched). */
  onReRequest?: (row: MyRequest) => void;
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
export default function MyRequestsDock({ slug, requests, guestName, onRemoved, onReRequest }: Props) {
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [justStarted, setJustStarted] = useState(false); // V8: my Ready auto-started my song
  useEffect(() => {
    if (!justStarted) return;
    const t = window.setTimeout(() => setJustStarted(false), 4000);
    return () => window.clearTimeout(t);
  }, [justStarted]);
  // `arrived`: a brief one-time "It's your turn" flash flag.
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
              { requestId: r.requestId, state: 'not_found', position: 0, aheadCount: 0, isUpNext: false, isNowPlaying: false, readyAt: null } as GuestQueueStatus,
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

  // Drop ONLY cancelled/gone requests (removed / not_found). Completed songs are
  // KEPT — they move to the "오늘 부른 노래" history section, not pruned away.
  useEffect(() => {
    for (const r of requests) {
      const s = statuses[r.requestId];
      if (s && shouldDropOwned(s.state) && !terminalSeen.current.has(r.requestId)) {
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

  // READY signal (V6 single Admin Player): tell the ONE Admin Player "I'm ready".
  // A SHARED server signal — it NEVER opens YouTube, NEVER starts the song, NEVER
  // touches the stage. The Admin starts on the TV. `ready:false` withdraws it
  // (only while the request is still waiting). Ownership proven by the capability.
  async function doReady(r: MyRequest, ready: boolean) {
    if (actingId) return;
    if (!r.cancelToken) {
      setError('이 신청은 이 기기에서 준비할 수 없어요.');
      return;
    }
    setActingId(r.requestId);
    setError(null);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(r.requestId)}/ready`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ token: r.cancelToken, ready }),
        },
      );
      if (res.ok) {
        // V8 AUTOPILOT — the server may have auto-started this song (first in line +
        // stage open). Surface an honest "무대가 시작되었습니다" note; the YouTube
        // handoff still happens on the Admin Player (we never claim TV autoplay).
        const data = (await res.json().catch(() => ({}))) as { autoStarted?: boolean };
        if (data.autoStarted) setJustStarted(true);
        refreshAll();
        return;
      }
      if (res.status === 403) setError('이 기기에서는 준비할 수 없어요.');
      else if (res.status === 409) setError('이미 차례가 지나갔어요.');
      else if (res.status === 404) setError('신청곡을 찾을 수 없어요.');
      else setError('지금은 준비할 수 없어요.');
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

  if (requests.length === 0) return null;

  // The MyRequest backing the current stage (for cancelToken).
  const stageReq = stageId ? requests.find((r) => r.requestId === stageId) ?? null : null;
  // Ready is the SHARED server signal (status.readyAt) the Admin Player also sees.
  const isReady = stage.kind === 'my_turn' && !!(stageId && statuses[stageId]?.readyAt);
  // V8.1 — the compact dock exposes Ready for the guest's *nearest* waiting song even
  // when they are #2/#3 (Ready is a pre-signal, not a "your-turn-only" control).
  const waitReady = stage.kind === 'waiting' && !!(stageId && statuses[stageId]?.readyAt);
  const stageSong = stageReq ? displaySong(stageReq.title, stageReq.artist).song || stageReq.title : '';

  const summary = collapsedSummary(
    requests.map((r) => {
      const s = statuses[r.requestId];
      return s ? { state: s.state, position: s.position } : { state: 'waiting' as const, position: 0 };
    }),
  );

  // Canonical owned rows (state + ready + media) for grouping / dedupe / copy.
  const byId = new Map(requests.map((r) => [r.requestId, r]));
  const ownedRows: OwnedRow[] = requests.map((r) => {
    const s = statuses[r.requestId];
    return { requestId: r.requestId, state: s?.state ?? 'waiting', readyAt: s?.readyAt ?? null, videoId: r.videoId ?? null };
  });
  const { activeIds, completedIds } = groupOwned(ownedRows);
  const activeRequests = activeIds.map((id) => byId.get(id)!).filter(Boolean);
  const completedRequests = completedIds.map((id) => byId.get(id)!).filter(Boolean);
  // Ready active rows, earliest first — for honest "N번째 / 첫 곡 / 앞에 준비된 N곡" copy.
  const readyOrderIds = activeRequests
    .filter((r) => statuses[r.requestId]?.readyAt != null && (statuses[r.requestId]?.state === 'waiting' || statuses[r.requestId]?.state === 'up_next'))
    .sort((a, b) => (statuses[a.requestId]?.position ?? 0) - (statuses[b.requestId]?.position ?? 0))
    .map((r) => r.requestId);

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
            <div className="perf-title big">지금 노래하는 중</div>
            {stageSong && <div className="perf-song">{stageSong}</div>}
            {/* V6: the ONE Admin Player runs the TV. The guest neither opens
                YouTube nor ends the song — the Admin passes the turn. */}
            <div className="perf-sub">
              TV에서 노래가 재생되고 있어요. 노래가 끝나면 Admin이 다음 차례로 넘깁니다.
            </div>
          </div>
        )}

        {stageReq && stage.kind === 'my_turn' && !isReady && (
          <div className={`perf-card myturn hero${arrived ? ' arrival' : ''}`} role="status">
            <div className="perf-hero-ico" aria-hidden>🎤</div>
            <div className="perf-eyebrow">It’s your turn</div>
            <div className="perf-title big">{namePrefix ? `${namePrefix}, 다음은 당신의 무대예요` : '다음은 당신의 무대예요'}</div>
            {/* V8 AUTOPILOT — Ready is the go signal. If nothing is playing, pressing
                Ready starts the stage right away; otherwise it starts automatically the
                moment the current song ends. No Admin Start needed. */}
            <div className="perf-sub">준비되면 눌러주세요 · 앞의 무대가 끝나면 바로 이어집니다.</div>
            <div className="perf-actions">
              <button
                type="button"
                className="perf-btn ready"
                onClick={() => doReady(stageReq, true)}
                disabled={actingId === stageReq.requestId}
              >
                {actingId === stageReq.requestId ? '준비하는 중…' : '준비됐어요'}
              </button>
            </div>
          </div>
        )}

        {stageReq && stage.kind === 'my_turn' && isReady && (
          <div className="perf-card ready hero" role="status">
            <div className="perf-hero-ico" aria-hidden>✅</div>
            <div className="perf-eyebrow">{namePrefix ? namePrefix : '준비 완료'}</div>
            <div className="perf-title big">준비 완료</div>
            {stageSong && <div className="perf-song">{stageSong}</div>}
            {/* V8: honest — the stage auto-continues on the current song's end; the
                Admin opens the video on the TV. We never claim TV autoplay. */}
            <div className="perf-sub">
              {justStarted
                ? '무대가 시작되었습니다 · Admin 화면에서 노래를 열고 있어요.'
                : readyStageCopy({
                    state: 'up_next',
                    ready: true,
                    stageOpen,
                    isEarliestReady: stageOpen === true,
                    readyAheadCount: 0,
                  })}
            </div>
            <div className="perf-actions">
              <button
                type="button"
                className="perf-btn ghost"
                onClick={() => doReady(stageReq, false)}
                disabled={actingId === stageReq.requestId}
              >
                준비 취소
              </button>
            </div>
          </div>
        )}

        {stage.kind === 'waiting' && stageReq && (
          <div className="perf-card waiting" role="status">
            <span className="perf-wait-ico" aria-hidden>{waitReady ? '✅' : '🎶'}</span>
            <div className="perf-wait-main">
              <div className="perf-wait-text">
                {waitReady
                  ? '준비 완료'
                  : stage.aheadCount === 0
                    ? '곧 당신 차례예요'
                    : `가장 빠른 순번 ${stage.position}번`}
              </div>
              {/* V8.1 — Ready pre-signals well before the turn; when it lands, the song
                  auto-continues the moment the stage frees. We never claim TV autoplay. */}
              <div className="perf-wait-sub">
                {waitReady
                  ? readyStageCopy({
                      state: 'waiting',
                      ready: true,
                      stageOpen,
                      isEarliestReady: stage.aheadCount === 0,
                      readyAheadCount: 0, // perf-card lacks per-Ready-ahead data; idle/continuation only
                    })
                  : '미리 준비해두면 차례가 오면 자동으로 시작돼요'}
              </div>
            </div>
            {/* stopPropagation: a Ready tap must never bubble up to open the sheet. */}
            <button
              type="button"
              className={`perf-btn perf-btn-inline ${waitReady ? 'ghost' : 'ready'}`}
              onClick={(e) => {
                e.stopPropagation();
                void doReady(stageReq, !waitReady);
              }}
              disabled={actingId === stageReq.requestId}
            >
              {actingId === stageReq.requestId ? '처리 중…' : waitReady ? '준비 취소' : '준비됐어요'}
            </button>
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
              {activeRequests.map((r, i) => {
                const s = statuses[r.requestId];
                const state = s?.state ?? 'waiting';
                const confirming = confirmingId === r.requestId;
                const song = displaySong(r.title, r.artist);
                const action = cancelRowAction(state, Boolean(r.cancelToken));
                // V8.1 — Ready is offered on EVERY own waiting song, independently, not
                // only the one at the front. Terminal / now-playing rows never show it.
                const rowReady = Boolean(s?.readyAt);
                const canReady = (state === 'waiting' || state === 'up_next') && Boolean(r.cancelToken);
                const acting = actingId === r.requestId;
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
                        <div className="sheet-row-status">{rowReady && canReady ? '✓ 준비 완료' : statusText(s)}</div>
                        {/* Per-request Ready — pointer-isolated so a tap never starts the
                            swipe-to-cancel gesture on iOS. Ready ranks visually above cancel. */}
                        {canReady && (
                          <div className="sheet-row-ready" onPointerDown={(e) => e.stopPropagation()}>
                            {rowReady ? (
                              <>
                                <span className="sheet-ready-note">
                                  {readyStageCopy({
                                    state,
                                    ready: true,
                                    stageOpen,
                                    isEarliestReady: readyOrderIds[0] === r.requestId,
                                    readyAheadCount: Math.max(0, readyOrderIds.indexOf(r.requestId)),
                                  })}
                                </span>
                                <button
                                  type="button"
                                  className="sheet-ready-btn ghost"
                                  onClick={() => doReady(r, false)}
                                  disabled={acting}
                                >
                                  {acting ? '처리 중…' : '준비 취소'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="sheet-ready-btn primary"
                                onClick={() => doReady(r, true)}
                                disabled={acting}
                              >
                                {acting ? '준비하는 중…' : '준비됐어요'}
                              </button>
                            )}
                          </div>
                        )}
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
              {activeRequests.length === 0 && (
                <div className="sheet-empty-note">현재 신청한 노래가 없어요.</div>
              )}
            </div>

            {/* Completed history — collapsed by default, rendered ONLY when there is
                history. Completed rows never appear in the current list above. */}
            {completedRequests.length > 0 && (
              <div className="dock-history">
                <button
                  type="button"
                  className="dock-history-toggle"
                  aria-expanded={historyOpen}
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  오늘 부른 노래 {completedRequests.length} {historyOpen ? '〉' : '〉'}
                </button>
                {historyOpen && (
                  <div className="dock-history-list">
                    {completedRequests.map((r) => {
                      const song = displaySong(r.title, r.artist);
                      const dup = hasActiveMedia(r.videoId, ownedRows);
                      return (
                        <div className="history-row" key={r.requestId}>
                          <div className="history-row-main">
                            <div className="history-row-song">{song.song || r.title}</div>
                            {song.artist && <div className="history-row-artist">{song.artist}</div>}
                            <div className="history-row-status">이 곡을 불렀어요</div>
                          </div>
                          {onReRequest && (
                            dup ? (
                              <span className="history-dup-note">이미 신청됨</span>
                            ) : (
                              <button
                                type="button"
                                className="history-rerequest"
                                onClick={() => onReRequest(r)}
                              >
                                다시 신청
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
