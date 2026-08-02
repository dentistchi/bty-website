'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
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
import {
  orderChanged,
  reconcileDecision,
  resolveInsertionIndex,
  insertAt,
  type DragRowRect,
} from '@/domain/reorder';
import { requestDisplayTitle } from '@/domain/request-view';
import { displaySong } from '@/domain/song-title';
import { formatEventDuration } from '@/domain/live-presence';
import { badgeForVideo } from '@/domain/video-kind';
import DjActionSheet from './DjActionSheet';
import DjAdminMenu from './DjAdminMenu';
import DjEventStatusSheet from './DjEventStatusSheet';
import DjAddSongSheet from './DjAddSongSheet';
import NowSingingClock from './NowSingingClock';
import { usePlaybackClock } from './usePlaybackClock';
import type { PlaybackAuthorityWire } from '@/domain/playback-clock';

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
// Memoized so a routine 4s queue poll (which hands down fresh row objects) does
// NOT re-render every card mid-drag — the biggest source of touch jank. It
// re-renders only when a field it actually paints changes. `onOpenSheet` is a
// stable callback that takes the request, so it never breaks memoization.
// V5.1.2 — the list is FROZEN during a drag: rows never take a sort transform and
// never animate, so nothing on the page moves except the single overlay preview.
// When `frozen` is true the row renders statically; the row being dragged is fully
// hidden (visibility:hidden) so its original card can never double-paint under the
// overlay — its space stays as the drop gap. No neighbour movement = no jitter.
const SortableQueueCard = memo(
  function SortableQueueCard({
    r,
    index,
    isNew,
    disabled,
    frozen,
    onOpenSheet,
  }: {
    r: KaraokeRequest;
    index: number;
    isNew: boolean;
    disabled: boolean;
    frozen: boolean;
    onOpenSheet: (r: KaraokeRequest) => void;
  }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
      useSortable({ id: r.id, disabled });
    // Frozen (any drag active): no transform, no transition — the row does not move.
    const style = frozen
      ? { transform: undefined, transition: 'none' }
      : { transform: CSS.Translate.toString(transform), transition };
    const d = displaySong(r.youtube_title ?? '', r.youtube_channel_title);
    const song = d.song || requestDisplayTitle(r);
    return (
      <div
        ref={setNodeRef}
        id={`req-${r.id}`}
        style={style}
        className={`q-card singer-first${index === 0 ? ' head' : ''}${isNew ? ' isnew' : ''}${isDragging ? ' dragging' : ''}`}
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
            onClick={() => onOpenSheet(r)}
          >
            ⋯
          </button>
        </div>
      </div>
    );
  },
  (a, b) =>
    a.r.id === b.r.id &&
    a.index === b.index &&
    a.isNew === b.isNew &&
    a.disabled === b.disabled &&
    a.frozen === b.frozen &&
    a.onOpenSheet === b.onOpenSheet &&
    a.r.guest_name === b.r.guest_name &&
    a.r.youtube_title === b.r.youtube_title &&
    a.r.youtube_channel_title === b.r.youtube_channel_title,
);

// The ONE thing that follows the finger (V5.1.2). Deliberately minimal: a grip
// glyph + singer + song, at a fixed size captured on lift. NO thumbnail, buttons,
// menu, useSortable, animation, blur, or big shadow — nothing to re-measure or
// re-paint per frame. pointer-events:none so it never intercepts the gesture.
// dnd-kit collision is disabled — the drop slot is computed from the frozen
// snapshot in onDragMove, so no per-frame rect intersection runs.
const NO_COLLISION = () => [];

function QueueDragPreview({ r, width }: { r: KaraokeRequest; width: number }) {
  const d = displaySong(r.youtube_title ?? '', r.youtube_channel_title);
  const song = d.song || requestDisplayTitle(r);
  return (
    <div className="q-drag-preview" style={width ? { width } : undefined}>
      <span className="q-handle" aria-hidden>⠿</span>
      <div className="q-main">
        <div className="q-singer">{r.guest_name}</div>
        <div className="q-song">{song}</div>
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
  /** BUILD 24 — server-stamped anchor for the live song clock (absent on an older server). */
  playback?: PlaybackAuthorityWire | null;
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
  /** Starts a NEW event after the current one ended (rotation); 'ok' on success. */
  onStartNewEvent: () => Promise<'ok' | 'error'>;
  /**
   * V9.0: the ONE operator action — "play the next song". Completes the current song
   * (if any), auto-promotes the earliest READY song, revalidates, then opens that
   * song's YouTube. `nextId`/`nextVideoId` identify the READY TO PLAY card's subject
   * (the deterministic ready-first promote target).
   */
  onPlayNext: (nextId: string, nextVideoId: string) => void | Promise<void>;
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
  onMoveNext,
  onRemove,
  onReorder,
  onAddSong,
  onRefresh,
  onDisconnect,
  onEndEvent,
  onStartNewEvent,
  onPlayNext,
}: Props) {
  const [guestQr, setGuestQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const [displayQr, setDisplayQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const [displayLinkCopied, setDisplayLinkCopied] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [sheetFor, setSheetFor] = useState<KaraokeRequest | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [startingNew, setStartingNew] = useState(false); // V7 Start New Event in flight
  const [copiedLink, setCopiedLink] = useState(false);
  const [nowMs, setNowMs] = useState(() => 0);

  // ── Queue reorder (optimistic, dnd-kit) ───────────────────────────────────
  // `override` is the order UP NEXT renders instead of the server's: it freezes
  // the list during a drag (so a 4s poll can't reshuffle mid-drag), then holds
  // the DJ's chosen order while the save is in flight. New server arrivals still
  // append at the tail, so a concurrent guest request is never hidden or lost.
  // `savingRef` serializes saves (no overlapping reorders; no stale response
  // clobbering). `activeId` is the card currently lifted into the DragOverlay.
  const [override, setOverride] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const savingRef = useRef(false);
  // V5.1.2 frozen-rect drag model: the list never moves; only a thin insertion
  // line does. Row rects are snapshotted ONCE on lift — no per-frame DOM
  // re-measure, no collision recomputation, no neighbour animation.
  const [insertionTop, setInsertionTop] = useState<number | null>(null);
  const frozenRef = useRef<{ rows: DragRowRect[]; listTop: number; width: number } | null>(null);
  const insIdxRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  // The active id in a ref, set synchronously on lift (state setters are async),
  // so the insertion-line math is correct on the very first frame.
  const activeIdRef = useRef<string | null>(null);

  const requests = data?.requests ?? [];
  const { current, queue } = selectStage(requests);
  // BUILD 24 — the live song clock. `current` is the SERVER's canonical on-stage request, so the
  // clock stops the instant the server stops reporting one (finish, skip, auto-advance refusal,
  // event end) with no per-transition special-casing.
  const playbackClock = usePlaybackClock(data?.playback, Boolean(current));
  // Stable open-sheet callback so memoized rows never re-render just because a
  // new closure was created on a poll.
  const openSheet = useCallback((r: KaraokeRequest) => setSheetFor(r), []);

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
  // Stable SortableContext items: same reference while the id order is unchanged,
  // so a 4s poll never hands the sortable subtree a fresh array mid-drag.
  const sortableIdsKey = displayQueue.map((r) => r.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sortableIds = useMemo(() => displayQueue.map((r) => r.id), [sortableIdsKey]);
  // The server's canonical waiting order for the current poll — the reconcile
  // target for a held optimistic order.
  const serverWaitingIds = useMemo(() => queue.map((r) => r.id), [queue]);

  const reordering = busy || savingRef.current;

  // Reconcile a held optimistic order against fresh polls WITHOUT flashing: while
  // dragging or a save is in flight we hold; once idle, a poll that matches the
  // optimistic order confirms it (no visual change), a structural change (song
  // added/removed/finished) adopts the server order once, and a stale pre-reorder
  // poll (same set, different order) is held until the confirming poll arrives.
  useEffect(() => {
    if (!override || activeId || savingRef.current) return;
    if (reconcileDecision(override, serverWaitingIds) !== 'hold') setOverride(null);
  }, [serverWaitingIds, override, activeId]);

  const sensors = useSensors(
    // Mouse/trackpad: a tiny move starts the drag. Touch: bound to the grip
    // (touch-action:none), a short hold starts it while a flick elsewhere scrolls.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Compute the insertion line's Y (list-relative) for an insertion index against
  // the frozen snapshot: the top of the row now occupying that slot, or the bottom
  // of the last row when dropping at the end.
  const lineTopForIndex = useCallback((idx: number): number => {
    const snap = frozenRef.current;
    if (!snap) return 0;
    const others = snap.rows.filter((row) => row.id !== activeIdRef.current);
    if (others.length === 0) return 0;
    const clamped = Math.max(0, Math.min(others.length, idx));
    if (clamped >= others.length) {
      const last = others[others.length - 1];
      return last.top + last.height - snap.listTop;
    }
    return others[clamped].top - snap.listTop;
  }, []);

  function onDragStart(e: DragStartEvent) {
    if (reordering) return;
    setReorderError(null);
    const id = String(e.active.id);
    activeIdRef.current = id; // synchronous — used by the line math this frame
    // Snapshot every waiting row's rect ONCE. From here the list is static.
    const listTop = listRef.current?.getBoundingClientRect().top ?? 0;
    const rows: DragRowRect[] = [];
    let width = 0;
    let activeTop = 0;
    for (const rq of displayQueue) {
      const el = document.getElementById(`req-${rq.id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      rows.push({ id: rq.id, top: rect.top, height: rect.height });
      if (rq.id === id) {
        width = rect.width;
        activeTop = rect.top;
      }
    }
    frozenRef.current = { rows, listTop, width };
    insIdxRef.current = resolveInsertionIndex(
      (rows.find((row) => row.id === id)?.top ?? 0) + (rows.find((row) => row.id === id)?.height ?? 0) / 2,
      rows,
      id,
    );
    setActiveId(id);
    setOverride(displayIds()); // freeze the rendered order for the drag duration
    setInsertionTop(activeTop - listTop); // the line starts where the lifted card sat
  }
  function onDragMove(e: DragMoveEvent) {
    const snap = frozenRef.current;
    const id = activeIdRef.current;
    if (!snap || !id) return;
    // Pointer proxy: the dragged card's translated centre (frozen rect + delta).
    const tr = e.active.rect.current.translated;
    const centerY = tr ? tr.top + tr.height / 2 : 0;
    const idx = resolveInsertionIndex(centerY, snap.rows, id);
    if (idx !== insIdxRef.current) {
      insIdxRef.current = idx;
      setInsertionTop(lineTopForIndex(idx)); // only state update when the slot changes
    }
  }
  function onDragEnd() {
    const id = activeIdRef.current;
    const idx = insIdxRef.current;
    activeIdRef.current = null;
    frozenRef.current = null;
    setInsertionTop(null);
    setActiveId(null);
    if (!id) return;
    const base = displayIds();
    const next = insertAt(base, id, idx); // the ONE array move, on drop
    if (orderChanged(next, base)) void applyReorder(next);
  }
  function onDragCancel() {
    activeIdRef.current = null;
    frozenRef.current = null;
    setInsertionTop(null);
    setActiveId(null); // the reconcile effect settles the order
  }

  // Save a new full waiting order optimistically and HOLD it until a fresh poll
  // confirms — never snap back to a stale order the instant the mutation resolves
  // (that was the drop "flash"). On success we keep the optimistic order and pull
  // a fresh poll; the reconcile effect drops the override once the server matches.
  // Only a rejected/failed save rolls back (with a clear inline error).
  const applyReorder = useCallback(
    async (nextIds: string[]) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setOverride(nextIds); // optimistic — shown immediately, held through the save
      setReorderError(null);
      try {
        const result = await onReorder(nextIds);
        if (result === 'ok') {
          void onRefresh(); // fetch the confirming poll; reconcile effect settles it
        } else {
          setOverride(null); // rejected → roll back to canonical, once
          setReorderError('순서를 저장하지 못했습니다. 다시 시도하세요.');
          void onRefresh();
        }
      } catch {
        setOverride(null);
        setReorderError('순서를 저장하지 못했습니다. 다시 시도하세요.');
        void onRefresh();
      } finally {
        savingRef.current = false;
      }
    },
    [onReorder, onRefresh],
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
  // Event Lifecycle V1 — a room with ZERO Events resolves to no eventStatus at all
  // (nothing auto-creates one on load any more), so first use and post-End rotation
  // share ONE explicit "Start Event" affordance.
  const noEvent = !eventStatus;
  // V7.1 PART H: an ended event exposes no Guest QR action (a retired QR must not
  // be re-shown); the Start New Event action takes its place until rotation.
  const eventEnded = !!eventStatus && eventStatus.status !== 'active';
  /** No live Event: never started, or ended and awaiting explicit rotation. */
  const noLiveEvent = noEvent || eventEnded;
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
  // V9.0 — the ONE player surface derives entirely from canonical server state.
  // `firstReady` = the earliest-position waiting song whose guest is Ready — the song
  // the "▶ 다음 곡 재생" button plays next (an un-ready song ahead never blocks it).
  // null → nobody is ready → State A (no button). The Display owns "who is singing now".
  const firstReady = displayQueue.find((r) => r.ready_at != null) ?? null;

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

  // "Connect iPad Display" — show a QR of the CANONICAL read-only Display URL so the
  // iPad camera can open it directly (no password, no manual URL). Event-agnostic:
  // the /r/<slug>/display route always resolves the current live event by room slug.
  async function showDisplayQr() {
    setLoadingQr(true);
    setDisplayLinkCopied(false);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display-qr`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setDisplayQr({ qrSvg: d.qrSvg, url: d.url });
      }
    } finally {
      setLoadingQr(false);
    }
  }

  async function copyDisplayLink() {
    if (!displayQr) return;
    try {
      await navigator.clipboard.writeText(displayQr.url);
      setDisplayLinkCopied(true);
      window.setTimeout(() => setDisplayLinkCopied(false), 2000);
    } catch {
      /* clipboard blocked — the QR + visible link still work */
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
        <span className="sb-metric" title="Admin / emergency controls">
          <span className="status-dot ok" aria-hidden /> Admin Controls
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

      {/* Event Lifecycle V1 — FIRST USE: the room has no Event at all. Nothing is
          auto-created on load, so the Admin must explicitly start the first one. */}
      {noEvent && (
        <div className="dj-ended-banner" role="status">
          <div className="dj-ended-copy">
            <b>진행 중인 이벤트가 없어요.</b>{' '}
            <span className="muted">
              이벤트를 시작하면 손님 초대 QR과 새 대기열이 만들어집니다.
            </span>
          </div>
          {isAdmin && (
            <button
              type="button"
              className="primary"
              disabled={startingNew}
              onClick={async () => {
                setStartingNew(true);
                await onStartNewEvent();
                setStartingNew(false);
              }}
            >
              {startingNew ? '시작 중…' : '🎬 이벤트 시작'}
            </button>
          )}
        </div>
      )}

      {/* V7 — Event ended: the queue is closed. The Admin explicitly rotates to a
          NEW Event (new Guest QR); the old QR can never join it. No auto-restart. */}
      {eventStatus && eventStatus.status !== 'active' && (
        <div className="dj-ended-banner" role="status">
          <div className="dj-ended-copy">
            <b>이벤트가 종료되었어요.</b>{' '}
            <span className="muted">
              {eventStatus.counts.guests}명 · {eventStatus.counts.completed}곡 완창 · 기록은 그대로
              보존됩니다.
            </span>
          </div>
          {isAdmin && (
            <button
              type="button"
              className="primary"
              disabled={startingNew}
              onClick={async () => {
                setStartingNew(true);
                await onStartNewEvent();
                setStartingNew(false);
              }}
            >
              {startingNew ? '시작 중…' : '🎬 새 이벤트 시작'}
            </button>
          )}
        </div>
      )}

      {/* This console is an EXCEPTION surface — normal operation runs on each
          guest's phone. Make that explicit so a host doesn't drive from here. */}
      <div className="dj-exception-note" role="note">
        정상 운영은 참가자가 각자의 휴대폰에서 진행합니다. 이 화면은 순서 변경이나 강제 종료가 필요할 때만
        사용하세요.
      </div>

      {/* Always-available exception actions — never hidden behind the empty
          state. Guest QR only (Add song lives in the admin menu, off the base
          screen; playback is not a DJ action anymore). */}
      <div className="dj-actions-bar" role="group" aria-label="Admin actions">
        {!noLiveEvent && (
          <button className="ghost" onClick={showGuestQr} disabled={loadingQr}>
            🔳 Guest QR
          </button>
        )}
        {/* Connect iPad Display — shows a QR the iPad camera scans to open the
            read-only Display. This is the discoverable "put it on the iPad" path. */}
        {!noLiveEvent && (
          <button className="ghost" onClick={showDisplayQr} disabled={loadingQr}>
            📺 Connect iPad Display
          </button>
        )}
        {/* Open the read-only Display on THIS device (same tab context). */}
        <a
          className="ghost"
          href={`/r/${encodeURIComponent(slug)}/display`}
          target="_blank"
          rel="noreferrer"
        >
          🖥 Open Display on this device
        </a>
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
          {/* ── V9.0 READY TO PLAY — the ONE operator action: "play the next song" ──
              The card's subject is the NEXT song to play: the earliest READY waiting
              song (firstReady). Pressing "▶ 다음 곡 재생" completes the current song (if
              any), auto-promotes this Ready singer (canonical ready-first), then opens
              their YouTube — the operator never thinks about state transitions. When no
              one is Ready yet there is NO button (State A). The Display shows who is NOW
              SINGING; this console is purely the "next" control. */}
          {firstReady ? (
            <div className="stage-hero ready" key={firstReady.id}>
              <div className="eyebrow">READY TO PLAY</div>
              {/* Operator context: who is on stage right now (informational only). */}
              {current && (
                <div className="muted now-context">
                  🎙 지금 무대 · {current.guest_name}
                  <NowSingingClock song={playbackClock.song} lease={playbackClock.lease} />
                </div>
              )}
              {firstReady.youtube_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="stage-thumb" src={firstReady.youtube_thumbnail_url} alt="" style={{ marginTop: 12 }} />
              ) : (
                <div className="stage-thumb ph" style={{ marginTop: 12 }} aria-hidden>
                  🎤
                </div>
              )}
              <div className="stage-req strong">{firstReady.guest_name}</div>
              {(() => {
                const d = displaySong(firstReady.youtube_title ?? '', firstReady.youtube_channel_title);
                return (
                  <>
                    <div className="stage-title">{d.song || requestDisplayTitle(firstReady)}</div>
                    {d.artist && <div className="stage-artist">{d.artist}</div>}
                    <VideoKindBadge title={firstReady.youtube_title ?? ''} channel={firstReady.youtube_channel_title} />
                  </>
                );
              })()}
              <p className="lead player-ready">
                {current ? '지금 곡이 끝나면 눌러주세요.' : '준비된 첫 무대예요.'}
              </p>
              <div className="stage-actions">
                {/* THE one operator action — completes the current song (if any),
                    auto-promotes this Ready singer, then opens their YouTube. */}
                <button
                  className="primary lg"
                  disabled={busy || !firstReady.youtube_video_id}
                  onClick={() => onPlayNext(firstReady.id, firstReady.youtube_video_id)}
                >
                  ▶ 다음 곡 재생
                </button>
              </div>
            </div>
          ) : current || displayQueue.length > 0 ? (
            // State A — a song may still be playing on the Display, but NObody is Ready
            // to go next. No button, no completion: the operator simply waits until a
            // guest presses "준비됐어요", at which point the button appears.
            <div className="stage-hero ready">
              <div className="eyebrow">READY TO PLAY</div>
              {current && (
                <div className="muted now-context">
                  🎙 지금 무대 · {current.guest_name}
                  <NowSingingClock song={playbackClock.song} lease={playbackClock.lease} />
                </div>
              )}
              <div className="stage-title" style={{ marginTop: 10 }}>
                다음 준비된 참가자를 기다리는 중
              </div>
              <p className="lead">
                대기자가 각자 휴대폰에서 “준비됐어요”를 누르면 다음 무대가 여기에 나타납니다.
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
          {reorderError && (
            <div className="banner error reorder-error" role="alert">
              {reorderError}
            </div>
          )}

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
              // We compute the drop slot ourselves from a frozen snapshot, so
              // dnd-kit does no collision work (one fewer coordinate path).
              collisionDetection={NO_COLLISION}
              autoScroll={false}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              {/* position:relative host for the absolute insertion line. The list
                  is STATIC during a drag — only this thin line moves. */}
              <div className="q-list" ref={listRef}>
                {insertionTop != null && (
                  <div className="q-insert-line" style={{ top: insertionTop }} aria-hidden />
                )}
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {displayQueue.map((r, i) => (
                    <SortableQueueCard
                      key={r.id}
                      r={r}
                      index={i}
                      isNew={newSet.has(r.id)}
                      disabled={reordering}
                      frozen={activeId != null}
                      onOpenSheet={openSheet}
                    />
                  ))}
                </SortableContext>
              </div>
              {/* The ONE thing that follows the finger — a minimal preview, no drop
                  animation (the optimistic list already lands the row on release). */}
              <DragOverlay dropAnimation={null}>
                {activeId
                  ? (() => {
                      const r = displayQueue.find((x) => x.id === activeId);
                      return r ? <QueueDragPreview r={r} width={frozenRef.current?.width ?? 0} /> : null;
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

      {/* ── Connect iPad Display QR ─────────────────────────────────── */}
      {displayQr && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Connect the iPad Display">
          <div>
            <div className="eyebrow">Connect iPad Display</div>
            <div className="display-sm" style={{ margin: '6px 0 4px' }}>
              iPad 카메라로 QR을 스캔하세요
            </div>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>
              화면이 바로 열립니다 · 비밀번호나 주소 입력이 필요 없어요
            </p>
            <div className="qr-surface" dangerouslySetInnerHTML={{ __html: displayQr.qrSvg }} />
            <div className="qr-caption" style={{ wordBreak: 'break-all' }}>{displayQr.url}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 12 }}>
              <button className="ghost" onClick={() => void copyDisplayLink()}>
                {displayLinkCopied ? '✓ 복사됨' : '🔗 Copy Display Link'}
              </button>
              <button className="ghost" onClick={() => setDisplayQr(null)}>
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
          onOpenAddSong={() => {
            setAdminOpen(false);
            setAddOpen(true);
          }}
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
