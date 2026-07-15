'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KaraokeRequest } from '@/lib/rooms.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import type { DjEventStatus } from '@/lib/events.server';
import { selectStage } from '@/domain/queue';
import { moveWithin, orderChanged } from '@/domain/reorder';
import { primaryPlayTarget, runPlayOnTv, runOpenOnDevice } from '@/domain/play-flow';
import { requestDisplayTitle } from '@/domain/request-view';
import { displaySong } from '@/domain/song-title';
import { formatEventDuration } from '@/domain/live-presence';
import { safeYoutubeWatchUrl } from '@/domain/youtube';
import { badgeForVideo } from '@/domain/video-kind';
import DjActionSheet from './DjActionSheet';
import DjAdminMenu from './DjAdminMenu';
import DjEventStatusSheet from './DjEventStatusSheet';
import DjAddSongSheet from './DjAddSongSheet';

/** Small "likely has words on the TV" badge for a request's video. */
function VideoKindBadge({ title, channel }: { title: string; channel: string | null }) {
  const badge = badgeForVideo(title, channel ?? '');
  if (!badge) return null;
  return (
    <span className={`vk-badge vk-${badge.tone}`}>
      {badge.emoji} {badge.label}
    </span>
  );
}

// Inner content shared by the in-list sortable card and the lifted drag overlay,
// so the overlay is a pixel-identical copy of the card being dragged.
function QueueCardContent({ r, index, isNew }: { r: KaraokeRequest; index: number; isNew: boolean }) {
  const d = displaySong(r.youtube_title ?? '', r.youtube_channel_title);
  const song = d.song || requestDisplayTitle(r);
  return (
    <>
      <span className="q-pos">{String(index + 1).padStart(2, '0')}</span>
      <div className="q-main">
        <div className="q-singer">
          {isNew && <span className="new-badge">✨ NEW</span>}
          {r.guest_name}
        </div>
        <div className="q-song">{song}</div>
        {d.artist && <div className="q-artist">{d.artist}</div>}
        <VideoKindBadge title={r.youtube_title ?? ''} channel={r.youtube_channel_title} />
      </div>
    </>
  );
}

// One reorderable UP NEXT card. Drag is bound to the grip handle ONLY (via the
// activator ref + listeners), so the card body still scrolls the list and the
// ⋯ button still taps. While this card is the one being dragged, it stays in
// place as a dimmed placeholder (its content rides in the DragOverlay) — the
// slot never collapses and neighbours slide to open the drop target.
function SortableQueueCard({
  r,
  index,
  isNew,
  disabled,
  onOpenSheet,
}: {
  r: KaraokeRequest;
  index: number;
  isNew: boolean;
  disabled: boolean;
  onOpenSheet: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: r.id, disabled });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const d = displaySong(r.youtube_title ?? '', r.youtube_channel_title);
  const song = d.song || requestDisplayTitle(r);
  return (
    <div
      ref={setNodeRef}
      id={`req-${r.id}`}
      style={style}
      className={`q-card singer-first${index === 0 ? ' head' : ''}${isNew ? ' isnew' : ''}${isDragging ? ' placeholder' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="q-handle"
        aria-label={`${r.guest_name}님 순서 이동 핸들 · 현재 ${index + 1}번 · 끌거나 방향키로 순서 변경`}
        title="끌어서 순서 변경"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <QueueCardContent r={r} index={index} isNew={isNew} />
      <div className="q-actions">
        <button
          className="q-overflow"
          aria-label={`${r.guest_name}님의 신청곡 ${song}${d.artist ? ` — ${d.artist}` : ''} 관리 · 순서 이동`}
          aria-haspopup="dialog"
          onClick={onOpenSheet}
        >
          ⋯
        </button>
      </div>
    </div>
  );
}

interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: KaraokeRequest[];
  eventStatus: DjEventStatus | null;
}

interface Props {
  slug: string;
  displayName: string;
  data: QueuePayload | null;
  newIds: string[];
  reconnecting: boolean;
  busy: boolean;
  error: string | null;
  dev?: boolean;
  /** Admin-capable bearer, present only when the authenticated role is admin. */
  adminCred?: string | null;
  onStart: (id: string) => void | Promise<void>;
  onFinish: (id: string) => void | Promise<void>;
  onMoveNext: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  /** Persist a new waiting-queue order; resolves 'ok' | 'conflict' | 'error'. */
  onReorder: (orderedRequestIds: string[]) => Promise<'ok' | 'conflict' | 'error'>;
  /** DJ adds a song to the queue; resolves 'ok' | 'error'. */
  onAddSong: (payload: Record<string, unknown>) => Promise<'ok' | 'error'>;
  onRefresh: () => void | Promise<void>;
  onDisconnect: () => void;
  /** Ends the whole event (distinct from Disconnect); resolves 'ok' on success. */
  onEndEvent: () => Promise<'ok' | 'error'>;
}

export default function DjBoard({
  slug,
  displayName,
  data,
  newIds,
  reconnecting,
  busy,
  error,
  adminCred,
  onStart,
  onFinish,
  onMoveNext,
  onRemove,
  onReorder,
  onAddSong,
  onRefresh,
  onDisconnect,
  onEndEvent,
}: Props) {
  const [guestQr, setGuestQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [sheetFor, setSheetFor] = useState<KaraokeRequest | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nowMs, setNowMs] = useState(() => 0);
  // Re-entry guard so rapid taps can't open two tabs or fire two play mutations.
  const startingRef = useRef(false);

  // ── Queue reorder (optimistic, dnd-kit) ───────────────────────────────────
  // `override` is the order UP NEXT renders instead of the server's: it freezes
  // the list during a drag (so a 4s poll can't reshuffle mid-drag), then holds
  // the DJ's chosen order while the save is in flight. New server arrivals still
  // append at the tail, so a concurrent guest request is never hidden or lost.
  // `savingRef` serializes saves (no overlapping reorders; no stale response
  // clobbering). `activeId` is the card currently lifted into the DragOverlay.
  const [override, setOverride] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const savingRef = useRef(false);

  const requests = data?.requests ?? [];
  const { current, queue } = selectStage(requests);

  // Resolve the order to render: a pending/frozen `override` wins, else the
  // server's canonical order. Ids no longer present server-side drop out;
  // freshly-arrived waiting songs append at the tail.
  const displayQueue = useMemo(() => {
    if (!override) return queue;
    const byId = new Map(queue.map((r) => [r.id, r] as const));
    const head = override.map((id) => byId.get(id)).filter((r): r is KaraokeRequest => Boolean(r));
    const headIds = new Set(head.map((r) => r.id));
    const tail = queue.filter((r) => !headIds.has(r.id));
    return [...head, ...tail];
  }, [queue, override]);
  const displayIds = useCallback(() => displayQueue.map((r) => r.id), [displayQueue]);

  const reordering = busy || savingRef.current;

  const sensors = useSensors(
    // Mouse/trackpad: a tiny move starts the drag. Touch: a short press-hold
    // starts it (a quick flick still scrolls the list). Keyboard: full a11y DnD.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    if (reordering) return;
    setActiveId(String(e.active.id));
    setOverride(displayIds()); // freeze the current order for the drag duration
  }
  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    const base = displayIds();
    if (!over || over === active) {
      setOverride(null); // no drop target → unfreeze back to canonical
      return;
    }
    const next = moveWithin(base, active, over);
    if (orderChanged(next, base)) void applyReorder(next);
    else setOverride(null);
  }
  function onDragCancel() {
    setActiveId(null);
    setOverride(null); // pointercancel / Escape → snap back to canonical
  }

  // Save a new full waiting order optimistically. The console refetches canonical
  // truth on every outcome, so we clear the override afterwards: 'ok' matches the
  // optimistic order (no flicker); 'conflict'/'error' rolls back to the server.
  const applyReorder = useCallback(
    async (nextIds: string[]) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setOverride(nextIds);
      try {
        await onReorder(nextIds);
      } finally {
        setOverride(null);
        savingRef.current = false;
      }
    },
    [onReorder],
  );

  // Accessible reorder: move one waiting id up / down / to the top. Produces the
  // full new order and saves it — same server path as drag.
  const moveBy = useCallback(
    (id: string, to: 'up' | 'down' | 'top') => {
      if (savingRef.current || busy) return;
      const ids = displayIds();
      const from = ids.indexOf(id);
      if (from < 0) return;
      const next = ids.slice();
      next.splice(from, 1);
      const target = to === 'top' ? 0 : to === 'up' ? from - 1 : from + 1;
      const clamped = Math.max(0, Math.min(next.length, target));
      next.splice(clamped, 0, id);
      if (next.every((v, i) => v === ids[i])) return; // no change
      void applyReorder(next);
    },
    [displayIds, applyReorder, busy],
  );

  const live = Boolean(data?.session);
  const eventStatus = data?.eventStatus ?? null;
  const durationLabel = eventStatus ? formatEventDuration(eventStatus.startsAt, nowMs || Date.now()) : '';

  // Tick a coarse clock (30s) so the header/sheet duration stays current while a
  // live event is open. Only runs when there IS a live event.
  useEffect(() => {
    if (!eventStatus || eventStatus.status !== 'active') return;
    setNowMs(Date.now());
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [eventStatus]);

  async function copyGuestLink() {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/guest-qr`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      await navigator.clipboard.writeText(d.url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      /* clipboard blocked — Show Guest QR still works */
    }
  }
  const newSet = new Set(newIds);
  const isAdmin = data?.role === 'admin';
  // The single "▶ Play on TV" target: the first waiting song, only while the
  // stage is open. Null once a song is playing (finish it first — no swap).
  // Follows the DJ's visible order so a just-reordered top song plays first.
  const playTarget = primaryPlayTarget(current, displayQueue);

  // Navigate THIS Safari tab to the video (not window.open). On iPad this hands
  // off to the YouTube app without leaving a blank Safari window behind; the DJ
  // returns to the console with the browser Back gesture. The id is validated —
  // a malformed id yields no URL and we simply do not navigate.
  function openVideo(videoId: string) {
    const url = safeYoutubeWatchUrl(videoId);
    if (url) window.location.assign(url);
  }

  // Drop focus from any text input before we hand off to YouTube. A focused
  // <input> is (on iOS) in a magnified state; app-switching while focused is what
  // brings the DJ back to a zoomed console. Blurring first returns Safari to 1.0.
  function blurActive() {
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* ignore */
    }
  }

  // "Open on this iPad" — a personal-screen open of the CURRENT/selected video.
  // It ONLY navigates (runOpenOnDevice has no play effect), so it never changes a
  // request's state, never starts/finishes a song, and never disconnects the TV.
  function openOnThisIpad(videoId: string) {
    blurActive();
    runOpenOnDevice({ openVideo: () => openVideo(videoId) });
  }

  // One-tap play: commit waiting→playing FIRST, then navigate this tab to
  // YouTube (navigating away would abort the in-flight mutation, so it must land
  // first). Idempotent under repeated taps; on mutation failure the error banner
  // shows, we do NOT leave for YouTube, and the song stays waiting for a retry.
  function playOnTv(r: KaraokeRequest) {
    if (busy || startingRef.current) return;
    blurActive();
    startingRef.current = true;
    void runPlayOnTv({
      play: () => onStart(r.id),
      openVideo: () => openVideo(r.youtube_video_id),
    }).finally(() => {
      startingRef.current = false;
    });
  }

  async function showGuestQr() {
    setLoadingQr(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/guest-qr`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setGuestQr({ qrSvg: d.qrSvg, url: d.url });
      }
    } finally {
      setLoadingQr(false);
    }
  }

  // Awareness/navigation only: jump to the earliest still-highlighted new song
  // in its REAL queue position. Never reorders — the card does not move.
  function goToFirstNew() {
    const target = displayQueue.find((r) => newSet.has(r.id));
    if (!target) return;
    document
      .getElementById(`req-${target.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <main className="dj-console">
      {/* ── Status bar ─────────────────────────────────────────── */}
      <div className="statusbar" role="banner">
        {eventStatus ? (
          <button
            type="button"
            className="sb-event"
            aria-haspopup="dialog"
            aria-label={`Event status for ${displayName}`}
            onClick={() => setStatusOpen(true)}
          >
            <span className="sb-room">{displayName}</span>
            {eventStatus.status !== 'active' ? (
              <span className="pill">Ended</span>
            ) : (
              <span className="pill live">
                <span className="live-dot" aria-hidden />
                {live ? `LIVE · ${durationLabel}` : 'Paused'}
              </span>
            )}
            <span className="sb-chevron" aria-hidden>
              ›
            </span>
          </button>
        ) : (
          <>
            <span className="sb-room">{displayName}</span>
            {live ? (
              <span className="pill live">
                <span className="live-dot" aria-hidden />
                LIVE
              </span>
            ) : (
              <span className="pill">Paused</span>
            )}
          </>
        )}
        <span className="sb-sep" aria-hidden />
        <span className="sb-metric">
          <b>{data?.stats.guests ?? 0}</b> singers
        </span>
        <span className="sb-metric">
          <b>{data?.stats.requests ?? 0}</b> requests
        </span>
        <span className="grow" />
        {newIds.length > 0 && (
          <button
            type="button"
            className="new-chip"
            aria-live="polite"
            onClick={goToFirstNew}
            title="Jump to the newest song"
          >
            🎵 {newIds.length} new
          </button>
        )}
        <span className="sb-metric" title="This iPad is a connected DJ">
          <span className="status-dot ok" aria-hidden /> DJ connected
        </span>
        {isAdmin && (
          <button
            type="button"
            className="admin-trigger"
            aria-haspopup="dialog"
            onClick={() => setAdminOpen(true)}
          >
            ⋯ Admin
          </button>
        )}
      </div>

      {/* Always-available DJ actions — never hidden behind the empty state. */}
      <div className="dj-actions-bar" role="group" aria-label="DJ actions">
        <button className="ghost" onClick={showGuestQr} disabled={loadingQr}>
          🔳 Guest QR
        </button>
        <button className="cyan" onClick={() => setAddOpen(true)}>
          ＋ Add song
        </button>
      </div>

      {reconnecting && (
        <div className="reconnecting" role="status">
          <span className="status-dot warn" aria-hidden />
          Reconnecting… your queue is safe.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      <div className="dj-grid">
        {/* ── LEFT: NOW SINGING stage ──────────────────────────── */}
        <section className="dj-stage" aria-label="Now singing">
          {current ? (
            <div className="stage-hero stage-slide" key={current.id}>
              <div className="eyebrow" style={{ color: 'var(--magenta)' }}>
                Now singing
              </div>
              {current.youtube_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="stage-thumb"
                  src={current.youtube_thumbnail_url}
                  alt=""
                  style={{ marginTop: 12 }}
                />
              ) : (
                <div className="stage-thumb ph" style={{ marginTop: 12 }} aria-hidden>
                  🎤
                </div>
              )}
              <div className="stage-req strong">{current.guest_name}</div>
              {(() => {
                const d = displaySong(current.youtube_title ?? '', current.youtube_channel_title);
                return (
                  <>
                    <div className="stage-title">{d.song || requestDisplayTitle(current)}</div>
                    {d.artist && <div className="stage-artist">{d.artist}</div>}
                    <VideoKindBadge title={current.youtube_title ?? ''} channel={current.youtube_channel_title} />
                  </>
                );
              })()}
              <div className="playback-label">Playback options</div>
              <div className="stage-actions">
                <button
                  className="cyan lg"
                  disabled={!current.youtube_video_id}
                  onClick={() => openOnThisIpad(current.youtube_video_id)}
                >
                  Open on this iPad
                </button>
                <button className="ok lg" disabled={busy} onClick={() => onFinish(current.id)}>
                  ✓ Finish song
                </button>
              </div>
              <p className="muted playback-help">
                “Open on this iPad” opens the song here for a closer screen. When you return to
                Safari, the console reloads with this NOW SINGING card and Finish song still here.
              </p>
            </div>
          ) : playTarget ? (
            <div className="stage-hero ready" key={playTarget.id}>
              <div className="eyebrow">Up first</div>
              {playTarget.youtube_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="stage-thumb"
                  src={playTarget.youtube_thumbnail_url}
                  alt=""
                  style={{ marginTop: 12 }}
                />
              ) : (
                <div className="stage-thumb ph" style={{ marginTop: 12 }} aria-hidden>
                  🎤
                </div>
              )}
              <div className="stage-req strong">{playTarget.guest_name}</div>
              {(() => {
                const d = displaySong(playTarget.youtube_title ?? '', playTarget.youtube_channel_title);
                return (
                  <>
                    <div className="stage-title">{d.song || requestDisplayTitle(playTarget)}</div>
                    {d.artist && <div className="stage-artist">{d.artist}</div>}
                    <VideoKindBadge title={playTarget.youtube_title ?? ''} channel={playTarget.youtube_channel_title} />
                  </>
                );
              })()}
              <p className="lead">Play on the TV, or open it just on this iPad.</p>
              <div className="playback-label">Playback options</div>
              <div className="stage-actions">
                <button className="primary lg" disabled={busy} onClick={() => playOnTv(playTarget)}>
                  ▶ Play on TV
                </button>
                <button
                  className="ghost lg"
                  disabled={!playTarget.youtube_video_id}
                  onClick={() => openOnThisIpad(playTarget.youtube_video_id)}
                >
                  Open on this iPad
                </button>
              </div>
              <p className="muted playback-help">
                “Play on TV” marks the song playing, then opens YouTube to cast it to the TV.
                YouTube may open as its own screen — just switch back to Safari (app switcher or
                the tab bar) and the console returns at normal size with NOW SINGING and Finish
                song ready; no need to pinch or reload. “Open on this iPad” only opens the video
                here and doesn’t change the queue.
              </p>
            </div>
          ) : (
            <div className="stage-hero ready">
              <div className="eyebrow">The queue is open</div>
              <div className="stage-title" style={{ marginTop: 10 }}>
                Invite the room
              </div>
              <p className="lead">Share the guest QR and let everyone line up the first song.</p>
              <div className="stage-actions">
                <button className="primary lg" disabled={loadingQr} onClick={showGuestQr}>
                  {loadingQr ? 'Opening…' : 'Show guest QR'}
                </button>
              </div>
            </div>
          )}

          {/* Room controls under the stage */}
          <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <button className="ghost" disabled={loadingQr} onClick={showGuestQr}>
              Invite singers
            </button>
            <div className="row">
              <button className="linkish" onClick={() => onRefresh()}>
                Refresh
              </button>
              {!isAdmin && (
                <button className="linkish" onClick={onDisconnect}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── RIGHT: UP NEXT ───────────────────────────────────── */}
        <section className="dj-queue" aria-label="Up next">
          <div className="dj-col-title">
            <span className="eyebrow">Up next</span>
            <span className="muted">{displayQueue.length}</span>
          </div>

          {displayQueue.length === 0 ? (
            <div className="card empty">
              <div className="display-sm">No requests yet</div>
              <p className="lead">Share the guest QR and let the room choose the music.</p>
              <button
                className="cyan"
                style={{ marginTop: 12 }}
                disabled={loadingQr}
                onClick={showGuestQr}
              >
                Show guest QR
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext items={displayIds()} strategy={verticalListSortingStrategy}>
                {displayQueue.map((r, i) => (
                  <SortableQueueCard
                    key={r.id}
                    r={r}
                    index={i}
                    isNew={newSet.has(r.id)}
                    disabled={reordering}
                    onOpenSheet={() => setSheetFor(r)}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeId
                  ? (() => {
                      const i = displayQueue.findIndex((x) => x.id === activeId);
                      const r = displayQueue[i];
                      return r ? (
                        <div className="q-card singer-first overlay">
                          <span className="q-handle" aria-hidden>
                            ⠿
                          </span>
                          <QueueCardContent r={r} index={i} isNew={newSet.has(r.id)} />
                          <div className="q-actions">
                            <span className="q-overflow" aria-hidden>
                              ⋯
                            </span>
                          </div>
                        </div>
                      ) : null;
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
          )}
        </section>
      </div>

      {/* ── Full-screen guest QR overlay ─────────────────────────── */}
      {guestQr && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Guest song-request QR">
          <div>
            <div className="eyebrow">Request a song</div>
            <div className="display-sm" style={{ margin: '6px 0 14px' }}>
              Scan to join {displayName}
            </div>
            <div className="qr-surface" dangerouslySetInnerHTML={{ __html: guestQr.qrSvg }} />
            <div className="qr-caption">{data?.stats.guests ?? 0} singers joined</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="ghost" onClick={() => setGuestQr(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Status sheet (tap the event header) ────────────────── */}
      {statusOpen && eventStatus && (
        <DjEventStatusSheet
          status={eventStatus}
          nowMs={nowMs || Date.now()}
          copied={copiedLink}
          onShowGuestQr={() => {
            setStatusOpen(false);
            void showGuestQr();
          }}
          onCopyGuestLink={copyGuestLink}
          onEndEvent={onEndEvent}
          onClose={() => setStatusOpen(false)}
        />
      )}

      {/* ── DJ Add Song sheet (always reachable from the top actions) ─── */}
      {addOpen && <DjAddSongSheet onAddSong={onAddSong} onClose={() => setAddOpen(false)} />}

      {/* ── Admin menu (admin role only; secondary to the live surface) ─ */}
      {isAdmin && adminOpen && adminCred && (
        <DjAdminMenu
          slug={slug}
          displayName={displayName}
          cred={adminCred}
          onShowGuestQr={showGuestQr}
          onSessionEnded={() => onRefresh()}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {/* ── Custom queue action sheet (replaces window.confirm) ──── */}
      {sheetFor &&
        (() => {
          const idx = displayQueue.findIndex((r) => r.id === sheetFor.id);
          const total = displayQueue.length;
          return (
            <DjActionSheet
              request={sheetFor}
              busy={reordering}
              canMoveUp={idx > 0}
              canMoveDown={idx >= 0 && idx < total - 1}
              onMoveUp={(id) => {
                moveBy(id, 'up');
                setSheetFor(null);
              }}
              onMoveDown={(id) => {
                moveBy(id, 'down');
                setSheetFor(null);
              }}
              onMoveNext={(id) => {
                void onMoveNext(id);
                setSheetFor(null);
              }}
              onRemove={(id) => {
                void onRemove(id);
                setSheetFor(null);
              }}
              onClose={() => setSheetFor(null)}
            />
          );
        })()}
    </main>
  );
}
