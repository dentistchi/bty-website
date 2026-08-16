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
import {
  mergeResolutions,
  resolutionAccessibilityLabel,
  resolutionCopy,
  resolutionsSurviveEvent,
  type ResolvedRequestView,
} from '@/domain/request-resolution';
import { songDisplay } from '@/domain/song-title';
import { unavailableCopy } from '@/domain/youtube-unavailable';
import { resolvePerfStage } from '@/domain/self-service';
import type { OwnStatusRow } from '@/domain/recently-sung';
import type { RecordInput } from './recently-sung.hooks';
import SwipeableCard from './SwipeableCard';
import { useGuestLocale } from '@/components/guest/GuestLocaleProvider';
import type { GuestTranslator } from '@/domain/guest-messages';

interface Props {
  slug: string;
  requests: MyRequest[];
  /** The room's canonical live event id (scopes Recently Sung, gates false history). */
  eventId?: string | null;
  /** The guest's name — used only for a warm MC-style greeting on the cards. */
  guestName?: string;
  onRemoved: (requestId: string) => void;
  /** Re-request a completed song (creates a NEW request; history is untouched). */
  onReRequest?: (row: MyRequest) => void;
  /** BUILD 20B-WEB7 — report each poll's own statuses so Recently Sung can record. */
  onRecordRecentlySung?: (input: RecordInput) => void;
}

const POLL_MS = 4000;

function statusText(t: GuestTranslator, s?: GuestQueueStatus): string {
  if (!s) return t('guest.status.checking');
  switch (s.state) {
    case 'now_playing':
      return t('guest.status.now_playing');
    case 'up_next':
      return t('guest.status.up_next');
    case 'waiting':
      return t('guest.status.waiting', { position: s.position });
    case 'done':
      return t('guest.status.done');
    case 'removed':
      return t('guest.status.cancelled');
    default:
      return t('guest.status.gone');
  }
}

// COMPACT by default: a single floating pill during normal browsing. It NEVER
// auto-expands — a new request only bumps the count and flashes a short gold edge
// pulse. Tapping the pill opens a clean full-width bottom sheet (not a side
// column / split-screen). Every status comes from the canonical server resolver.
export default function MyRequestsDock({
  slug,
  requests,
  eventId = null,
  guestName,
  onRemoved,
  onReRequest,
  onRecordRecentlySung,
}: Props) {
  const { locale, t } = useGuestLocale();
  // A warm "MC" greeting: "한빛님" / "Alex" when we know the name, else a neutral fallback.
  // The honorific is a per-language template — English has no equivalent to 님, and
  // inventing one would read as a bug.
  const namePrefix =
    guestName && guestName.trim() ? t('guest.name.honorific', { name: guestName.trim() }) : '';
  const [statuses, setStatuses] = useState<Record<string, GuestQueueStatus>>({});
  /** BUILD 25 — the owner-verified resolutions, newest first. Keyed by requestId throughout. */
  const [resolutions, setResolutions] = useState<ResolvedRequestView[]>([]);
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

  // Latest known statuses, mirrored into a ref so the record pass reads fresh values
  // without re-subscribing every poll (avoids a stale-closure read of `statuses`).
  const statusesRef = useRef(statuses);
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  const poll = useCallback(async (): Promise<Record<string, GuestQueueStatus>> => {
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
    const fresh: Record<string, GuestQueueStatus> = {};
    for (const e of entries) if (e) fresh[e[0]] = e[1];
    setStatuses((prev) => ({ ...prev, ...fresh }));
    return fresh;
  }, [slug, requests]);

  // One room-wide read to learn if the stage is open, who is first in line, and
  // whether THIS screen's Event is still the live one (guards false Recently Sung).
  const pollStage = useCallback(async (): Promise<{ ok: boolean; eventActive: boolean; playing: DisplayState['playing'] }> => {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display`, { cache: 'no-store' });
      if (!res.ok) return { ok: false, eventActive: true, playing: null };
      const data = (await res.json()) as DisplayState;
      setStageOpen(data.playing == null);
      setNextId(data.next?.id ?? null);
      // Legacy eventless room → always active. Otherwise the live Event must match
      // this screen's id AND still be running (an ended/replaced Event is inactive).
      const eventActive = data.event == null ? true : data.event.id === eventId && data.event.status === 'active';
      return { ok: true, eventActive, playing: data.playing };
    } catch {
      // Transient — keep last known stage state; a blip must never drop proofs.
      return { ok: false, eventActive: true, playing: null };
    }
  }, [slug, eventId]);

  // BUILD 25 — the owner-only resolution fetch.
  //
  // POST, with the capability for each id in the BODY: a capability in a URL leaks into access
  // logs and history. Only ids this device holds a capability for are asked about, and the server
  // re-verifies every one before reading — the client's claim of ownership is never trusted.
  const fetchResolutions = useCallback(async (): Promise<void> => {
    const items = requests
      .filter((r) => r.cancelToken)
      .map((r) => ({ requestId: r.requestId, token: r.cancelToken as string }));
    if (items.length === 0) return;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/requests/resolved`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ items }),
      });
      if (!res.ok) return; // transient — a blip must never erase an explanation already shown
      const data = (await res.json()) as { resolved: ResolvedRequestView[]; eventId: string | null };
      setResolutions((prev) => {
        // Event isolation: a genuinely different Event starts clean, so last night's results
        // cannot appear under tonight's room. An absent/unknown id is NOT treated as a change.
        const carried = resolutionsSurviveEvent(prev[0]?.eventId ?? null, data.eventId) ? prev : [];
        return mergeResolutions<{ requestId: string }>([], carried, data.resolved ?? []).resolved;
      });
    } catch {
      // Network blip — keep what is on screen.
    }
  }, [slug, requests]);

  const refreshAll = useCallback(async () => {
    // BUILD 25 — the resolution read rides the SAME 4s poll as the status read, so a resolved
    // request cannot sit unexplained for a whole extra interval.
    const [fresh, stage] = await Promise.all([poll(), pollStage(), fetchResolutions()]);
    if (!onRecordRecentlySung) return;
    const merged = { ...statusesRef.current, ...fresh };
    const own: OwnStatusRow[] = requests.map((r) => {
      const s = merged[r.requestId];
      // Thumbnail is only knowable while the song is on stage (display.playing) —
      // captured exactly when the proof is taken (state === now_playing).
      const thumb = stage.playing && stage.playing.id === r.requestId ? stage.playing.thumbnailUrl : null;
      return {
        requestId: r.requestId,
        state: s?.state ?? 'waiting',
        videoId: r.videoId ?? null,
        title: r.title,
        artist: r.artist,
        thumbnailUrl: thumb,
      };
    });
    onRecordRecentlySung({ own, eventActive: stage.eventActive, pollOk: stage.ok });
  }, [poll, pollStage, fetchResolutions, requests, onRecordRecentlySung]);

  useEffect(() => {
    void refreshAll();
    const t = window.setInterval(() => {
      if (!document.hidden) void refreshAll();
    }, POLL_MS);
    // Returning to the tab (app switch, YouTube handoff, screen unlock, bfcache)
    // refreshes #N immediately — the guest never has to reload to see a reorder.
    const onVisible = () => {
      if (!document.hidden) void refreshAll();
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

  // BUILD 25 — THE SECOND HALF OF THE DISAPPEARANCE, REMOVED.
  //
  // This effect used to schedule `onRemoved(requestId)` 6 seconds after a request went
  // removed/not_found, which DELETES it from the persisted my-requests list. Combined with
  // `groupOwned` dropping the row from every collection, that is how a Host removal became a
  // song that silently vanished: shown briefly with no reason, then erased from storage so a
  // refresh could not recover it either.
  //
  // A resolved request is now KEPT, exactly like completed history is kept — it moves to the
  // "신청 결과" section below. Persistence is already Event-scoped by `myRequestsKey(slug,
  // eventId)`, so retaining it survives refresh without leaking into a different Event.
  //
  // `terminalSeen` is still tracked: it marks which requests have reached a terminal state so
  // the resolution fetch below knows which ids are worth asking about.
  useEffect(() => {
    for (const r of requests) {
      const s = statuses[r.requestId];
      if (s && shouldDropOwned(s.state)) terminalSeen.current.add(r.requestId);
    }
  }, [statuses, requests]);


  async function doCancel(r: MyRequest) {
    // Compat guard: an older stored entry without a capability can't be cancelled
    // from this device — never send an unauthorized request.
    if (!r.cancelToken) {
      setError(t('guest.cancel.error.not_this_device'));
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
      if (res.status === 403) setError(t('guest.cancel.error.forbidden'));
      else if (res.status === 409) setError(t('guest.cancel.error.conflict'));
      else if (res.status === 404) setError(t('guest.cancel.error.not_found'));
      else setError(t('guest.cancel.error.generic'));
      void poll(); // reconcile the real state; keep the row for retry
    } catch {
      setError(t('guest.cancel.error.network'));
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
      setError(t('guest.ready.error.not_this_device'));
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
        void refreshAll();
        return;
      }
      if (res.status === 403) setError(t('guest.ready.error.forbidden'));
      else if (res.status === 409) setError(t('guest.ready.error.conflict'));
      else if (res.status === 404) setError(t('guest.ready.error.not_found'));
      else setError(t('guest.ready.error.generic'));
      void refreshAll();
    } catch {
      setError(t('guest.ready.error.network'));
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
  const stageSong = stageReq ? songDisplay(stageReq.title, stageReq.artist).title || stageReq.title : '';

  const summary = collapsedSummary(
    locale,
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
  // BUILD 25 — the server's resolution list IS the resolved collection; `groupOwned`'s
  // `resolvedIds` is the local view of the same fact and is used only to keep a resolved request
  // out of the active list below. Both key on requestId, never videoId, so a same-video
  // re-request stays a genuinely different row.
  const resolvedIdSet = new Set(resolutions.map((r) => r.requestId));
  const activeRequests = activeIds
    // MUTUAL EXCLUSION + STALE-POLL PROTECTION in one line: a poll that was in flight when the
    // Host acted still calls this request active. The resolution wins, so it can never flicker
    // back into the queue.
    .filter((id) => !resolvedIdSet.has(id))
    .map((id) => byId.get(id)!)
    .filter(Boolean);
  const completedRequests = completedIds
    .filter((id) => !resolvedIdSet.has(id))
    .map((id) => byId.get(id)!)
    .filter(Boolean);
  // Only resolutions for requests this device still holds locally, so a stale server row cannot
  // render for a request the Guest no longer has a capability for.
  const resolvedViews = resolutions.filter((v) => byId.has(v.requestId));
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
              <span className="live-dot" aria-hidden />{' '}
              {namePrefix ? t('guest.stage.on_stage_named', { name: namePrefix }) : t('guest.stage.on_stage')}
            </div>
            <div className="perf-title big">{t('guest.stage.singing_now')}</div>
            {stageSong && <div className="perf-song">{stageSong}</div>}
            {/* V6: the ONE Admin Player runs the TV. The guest neither opens
                YouTube nor ends the song — the Admin passes the turn. */}
            <div className="perf-sub">
              {t('guest.stage.singing_note')}
            </div>
            {/* BUILD 20B-WEB7 — bookmark THIS song (own, canonically playing by
                requestId). Save is independent: it never Ready/cancels/starts/
                finishes/opens YouTube and never mutates the Event. */}
          </div>
        )}

        {stageReq && stage.kind === 'my_turn' && !isReady && (
          <div className={`perf-card myturn hero${arrived ? ' arrival' : ''}`} role="status">
            <div className="perf-hero-ico" aria-hidden>🎤</div>
            <div className="perf-eyebrow">It’s your turn</div>
            <div className="perf-title big">
              {namePrefix ? t('guest.stage.next_named', { name: namePrefix }) : t('guest.stage.next')}
            </div>
            {/* V8 AUTOPILOT — Ready is the go signal. If nothing is playing, pressing
                Ready starts the stage right away; otherwise it starts automatically the
                moment the current song ends. No Admin Start needed. */}
            <div className="perf-sub">{t('guest.stage.next_note')}</div>
            <div className="perf-actions">
              <button
                type="button"
                className="perf-btn ready"
                onClick={() => doReady(stageReq, true)}
                disabled={actingId === stageReq.requestId}
              >
                {t(actingId === stageReq.requestId ? 'guest.stage.readying' : 'guest.stage.ready_action')}
              </button>
            </div>
          </div>
        )}

        {stageReq && stage.kind === 'my_turn' && isReady && (
          <div className="perf-card ready hero" role="status">
            <div className="perf-hero-ico" aria-hidden>✅</div>
            <div className="perf-eyebrow">{namePrefix ? namePrefix : t('guest.stage.ready_title')}</div>
            <div className="perf-title big">{t('guest.stage.ready_title')}</div>
            {stageSong && <div className="perf-song">{stageSong}</div>}
            {/* V8: honest — the stage auto-continues on the current song's end; the
                Admin opens the video on the TV. We never claim TV autoplay. */}
            <div className="perf-sub">
              {justStarted
                ? t('guest.stage.ready_note')
                : readyStageCopy(locale, {
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
                {t('guest.stage.cancel_ready')}
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
                  ? t('guest.stage.ready_title')
                  : stage.aheadCount === 0
                    ? t('guest.status.up_next')
                    : t('guest.summary.earliest', { position: stage.position })}
              </div>
              {/* V8.1 — Ready pre-signals well before the turn; when it lands, the song
                  auto-continues the moment the stage frees. We never claim TV autoplay. */}
              <div className="perf-wait-sub">
                {waitReady
                  ? readyStageCopy(locale, {
                      state: 'waiting',
                      ready: true,
                      stageOpen,
                      isEarliestReady: stage.aheadCount === 0,
                      readyAheadCount: 0, // perf-card lacks per-Ready-ahead data; idle/continuation only
                    })
                  : t('guest.stage.prepare_note')}
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
              {actingId === stageReq.requestId
                ? t('guest.stage.working')
                : t(waitReady ? 'guest.stage.cancel_ready' : 'guest.stage.ready_action')}
            </button>
          </div>
        )}
        <button
          type="button"
          className={`dock-pill${pulse ? ' pulse' : ''}`}
          onClick={() => setExpanded(true)}
          aria-haspopup="dialog"
          aria-label={t('guest.dock.open_a11y', { count: summary.count })}
        >
          <span className="dock-ico" aria-hidden>🎤</span>
          <span className="dock-count">{t('guest.dock.title', { count: summary.count })}</span>
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
            aria-label={t('guest.dock.a11y')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dock-sheet-head">
              <div>
                <div className="dock-sheet-title">{t('guest.dock.title', { count: summary.count })}</div>
                <div className="dock-sheet-sub">{t('guest.dock.subtitle')}</div>
              </div>
              <button
                type="button"
                className="dock-sheet-close"
                onClick={() => setExpanded(false)}
                aria-label={t('guest.dock.close')}
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
                const song = songDisplay(r.title, r.artist);
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
                    label={t('guest.dock.cancel_request')}
                    disabled={swipeDisabled}
                    onCommit={() => setConfirmingId(r.requestId)}
                  >
                    <div className={`sheet-row tone-${state}`}>
                      <span className="sheet-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                      <div className="sheet-row-main">
                        <div className="sheet-row-song">{song.title || r.title}</div>
                        {song.artist && <div className="sheet-row-artist">{song.artist}</div>}
                        <div className="sheet-row-status">
                          {rowReady && canReady ? t('guest.stage.ready_check') : statusText(t, s)}
                        </div>
                        {/* Per-request Ready — pointer-isolated so a tap never starts the
                            swipe-to-cancel gesture on iOS. Ready ranks visually above cancel. */}
                        {canReady && (
                          <div className="sheet-row-ready" onPointerDown={(e) => e.stopPropagation()}>
                            {rowReady ? (
                              <>
                                <span className="sheet-ready-note">
                                  {readyStageCopy(locale, {
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
                                  {t(acting ? 'guest.stage.working' : 'guest.stage.cancel_ready')}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="sheet-ready-btn primary"
                                onClick={() => doReady(r, true)}
                                disabled={acting}
                              >
                                {t(acting ? 'guest.stage.readying' : 'guest.stage.ready_action')}
                              </button>
                            )}
                          </div>
                        )}
                        {confirming && (
                          <div className="sheet-row-confirm-q">{t('guest.dock.cancel_confirm')}</div>
                        )}
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
                              {t('guest.dock.keep_waiting')}
                            </button>
                            <button
                              type="button"
                              className="cancel-commit"
                              onClick={() => doCancel(r)}
                              disabled={cancellingId === r.requestId}
                            >
                              {t('guest.dock.cancel_request')}
                            </button>
                          </div>
                        ) : action === 'cancel' ? (
                          <button
                            type="button"
                            className="linkish cancel-link"
                            onClick={() => setConfirmingId(r.requestId)}
                            aria-label={t('guest.dock.cancel_a11y', { title: song.title || r.title })}
                          >
                            {t('guest.dock.cancel_request')}
                          </button>
                        ) : action === 'unavailable' ? (
                          <span className="sheet-row-note">{t('guest.dock.cancel_unavailable')}</span>
                        ) : null}
                      </div>
                    </div>
                  </SwipeableCard>
                );
              })}
              {activeRequests.length === 0 && (
                <div className="sheet-empty-note">{t('guest.dock.empty')}</div>
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
                  {t('guest.dock.history', { count: completedRequests.length })} {historyOpen ? '〉' : '〉'}
                </button>
                {historyOpen && (
                  <div className="dock-history-list">
                    {completedRequests.map((r) => {
                      const song = songDisplay(r.title, r.artist);
                      const dup = hasActiveMedia(r.videoId, ownedRows);
                      return (
                        <div className="history-row" key={r.requestId}>
                          <div className="history-row-main">
                            <div className="history-row-song">{song.title || r.title}</div>
                            {song.artist && <div className="history-row-artist">{song.artist}</div>}
                            <div className="history-row-status">{t('guest.dock.history_status')}</div>
                          </div>
                          {onReRequest && (
                            dup ? (
                              <span className="history-dup-note">{t('guest.dock.already_requested')}</span>
                            ) : (
                              <button
                                type="button"
                                className="history-rerequest"
                                onClick={() => onReRequest(r)}
                              >
                                {t('guest.dock.request_again')}
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

            {/* BUILD 25 — 신청 결과. The quiet, durable explanation for a request that left the
                queue without completing. Rendered ONLY from server rows this device proved it
                owns, so another Guest's outcome can never appear here.

                Deliberately CONTROL-FREE: no Cancel, no Ready, no queue position, no Host action,
                no 다시 신청. The request is over; the only job of this card is to say what
                happened. Distinct from both the active list (which has controls) and 오늘 부른
                노래 (which is a completed song the Guest actually sang). */}
            {resolvedViews.length > 0 && (
              <div className="dock-resolved">
                <div className="dock-resolved-title">{t('guest.dock.resolved_title')}</div>
                <ul className="dock-resolved-list" aria-label={t('guest.dock.resolved_title')}>
                  {resolvedViews.map((v) => {
                    // R9 §I — an unavailable row shows the approved copy in place of the YouTube
                    // identity we no longer have. Its RESOLUTION is untouched below: a request
                    // that was cancelled still reads as cancelled. Unavailability describes the
                    // content, never what historically happened to the request.
                    const gone = v.youtubeUnavailable === true;
                    const song = gone
                      ? { title: '', artist: null as string | null }
                      : songDisplay(v.title ?? '', v.channelTitle ?? '');
                    const shown = gone
                      ? unavailableCopy(locale).title
                      : song.title || v.title || t('guest.dock.requested_song');
                    return (
                      <li
                        className="resolved-row"
                        key={v.requestId}
                        // One label per card: which song, then what happened to it.
                        aria-label={resolutionAccessibilityLabel(locale, shown, v.resolutionCode)}
                      >
                        <div className="resolved-row-song">{shown}</div>
                        {gone ? (
                          <div className="resolved-row-artist">{unavailableCopy(locale).body}</div>
                        ) : (
                          song.artist && <div className="resolved-row-artist">{song.artist}</div>
                        )}
                        {/* aria-hidden: the <li> label already reads this sentence, so exposing
                            it again would make VoiceOver announce the reason twice. */}
                        <div className="resolved-row-reason" aria-hidden="true">
                          {resolutionCopy(locale, v.resolutionCode)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
