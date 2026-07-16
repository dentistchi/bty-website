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
import { primaryPlayTarget } from '@/domain/play-flow';
import { queuePrepLabel, isAutoPromotable, preparedOrderDrifted } from '@/domain/queue-assist';
import { requestDisplayTitle } from '@/domain/request-view';
import { displaySong } from '@/domain/song-title';
import { formatEventDuration } from '@/domain/live-presence';
import { badgeForVideo } from '@/domain/video-kind';
import DjActionSheet from './DjActionSheet';
import LyricsSheet from './LyricsSheet';
import DjAdminMenu from './DjAdminMenu';
import DjEventStatusSheet from './DjEventStatusSheet';
import DjAddSongSheet from './DjAddSongSheet';

/** V8 — the TV-queue-prep badge text for a Ready/Queued combination. */
function prepBadgeText(label: 'ready_queued' | 'ready' | 'queued' | 'none'): string {
  switch (label) {
    case 'ready_queued':
      return 'READY + QUEUED';
    case 'ready':
      return 'READY';
    case 'queued':
      return 'QUEUED';
    default:
      return 'WAITING';
  }
}

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
  /** V6 Admin Player: start the song then open YouTube on this device (→ TV). */
  onPlayOnTv?: (id: string, videoId: string) => void | Promise<void>;
  /** V6 Admin Player: re-open the playing video on the TV (no state change). */
  onReopen?: (videoId: string) => void;
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
  /** Starts a NEW event after the current one ended (rotation); 'ok' on success. */
  onStartNewEvent: () => Promise<'ok' | 'error'>;
  /** V8: mark/unmark a waiting song as added to the YouTube TV queue (Admin signal). */
  onSetQueued: (id: string, queued: boolean) => Promise<boolean>;
  /** Lyrics V1: save/clear the words the Display shows for a song (empty clears). */
  onSetLyrics: (id: string, lyrics: string) => Promise<boolean>;
  /** V8: atomic Start of the FIRST song, then open YouTube on this device. */
  onStartFirst: (id: string, videoId: string) => void | Promise<void>;
  /** V8 pass-turn: complete current + auto-start next if Ready+Queued. Returns why. */
  onPassTurn: (
    currentId: string,
  ) => Promise<'promoted' | 'no_next' | 'needs_ready' | 'needs_queued' | 'needs_both' | 'error'>;
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
  onPlayOnTv,
  onReopen,
  onFinish,
  onMoveNext,
  onRemove,
  onReorder,
  onAddSong,
  onRefresh,
  onDisconnect,
  onEndEvent,
  onStartNewEvent,
  onSetQueued,
  onSetLyrics,
  onStartFirst,
  onPassTurn,
}: Props) {
  const [guestQr, setGuestQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [sheetFor, setSheetFor] = useState<KaraokeRequest | null>(null);
  const [lyricsFor, setLyricsFor] = useState<KaraokeRequest | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [playerFinishConfirm, setPlayerFinishConfirm] = useState(false); // 2-step "차례 넘기기"
  const [startingNew, setStartingNew] = useState(false); // V7 Start New Event in flight
  const [passNote, setPassNote] = useState<string | null>(null); // V8 pass-turn: why next didn't auto-start
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

  // Clear a stale "pass the turn" confirmation whenever the playing song changes.
  useEffect(() => {
    setPlayerFinishConfirm(false);
  }, [current?.id]);

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
  // V7.1 PART H: an ended event exposes no Guest QR action (a retired QR must not
  // be re-shown); the Start New Event action takes its place until rotation.
  const eventEnded = !!eventStatus && eventStatus.status !== 'active';
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
  // Informational "up next" for the exception console: the first waiting song
  // while the stage is open (null once a song is playing). This console no longer
  // starts playback — the singer starts their own song from their phone; we only
  // surface who is up so an admin can reorder/remove if needed.
  const playTarget = primaryPlayTarget(current, displayQueue);

  // ── V8 YouTube Queue Prep ─────────────────────────────────────────────────
  // The next 3–5 waiting songs the Admin prepares in the TV queue, in canonical
  // order. Counts + the auto-progression readiness of the very next song feed the
  // Admin summary; the NOW hero uses them for the pass-turn preview.
  const prepList = displayQueue.slice(0, 5);
  const queuedCount = displayQueue.filter((r) => r.youtube_queued_at != null).length;
  const readyCount = displayQueue.filter((r) => r.ready_at != null).length;
  const nextSignals = playTarget
    ? { status: playTarget.status, readyAt: playTarget.ready_at, youtubeQueuedAt: playTarget.youtube_queued_at }
    : null;
  const nextAutoReady = isAutoPromotable(nextSignals);

  // Reorder drift: if the Admin reorders songs already added to the TV queue, BTY
  // cannot reorder the real YouTube queue — warn (never auto-clear, never claim the
  // TV queue changed). We compare the queued songs' order across renders.
  const queuedOrderKey = displayQueue
    .filter((r) => r.youtube_queued_at != null)
    .map((r) => r.id)
    .join(',');
  const prevQueuedOrder = useRef<string[]>([]);
  const [queueDrift, setQueueDrift] = useState(false);
  useEffect(() => {
    const nowOrder = queuedOrderKey ? queuedOrderKey.split(',') : [];
    if (prevQueuedOrder.current.length && preparedOrderDrifted(prevQueuedOrder.current, nowOrder)) {
      setQueueDrift(true);
    }
    prevQueuedOrder.current = nowOrder;
  }, [queuedOrderKey]);

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
        {!eventEnded && (
          <button className="ghost" onClick={showGuestQr} disabled={loadingQr}>
            🔳 Guest QR
          </button>
        )}
        {/* Open the room's read-only Display (same canonical event) in a new tab. */}
        <a
          className="ghost"
          href={`/r/${encodeURIComponent(slug)}/display`}
          target="_blank"
          rel="noreferrer"
        >
          🖥 Open Display
        </a>
      </div>

      {reconnecting && (
        <div className="reconnecting" role="status">
          <span className="status-dot warn" aria-hidden />
          Reconnecting… your queue is safe.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      {/* ── V8 TV QUEUE PREP — prepare the next 3–5 songs in the YouTube TV queue ── */}
      {!eventEnded && prepList.length > 0 && (
        <section className="tv-queue-prep" aria-label="TV 대기열 준비">
          <div className="tvq-head">
            <span className="tvq-title">TV QUEUE PREP</span>
            <span className="tvq-summary">
              {queuedCount}곡 준비됨 · {readyCount}명 Ready
              {nextAutoReady ? ' · 다음 자동 진행 가능' : ''}
            </span>
          </div>
          {queueDrift && (
            <div className="tvq-drift" role="status">
              ⚠ 순서가 변경되었습니다. YouTube TV 대기열 순서도 확인해 주세요.
              <button type="button" className="ghost sm" onClick={() => setQueueDrift(false)}>
                확인
              </button>
            </div>
          )}
          <ol className="tvq-list">
            {prepList.map((r, i) => {
              const label = queuePrepLabel({
                status: r.status,
                readyAt: r.ready_at,
                youtubeQueuedAt: r.youtube_queued_at,
              });
              const song =
                displaySong(r.youtube_title ?? '', r.youtube_channel_title).song ||
                requestDisplayTitle(r);
              return (
                <li key={r.id} className="tvq-row">
                  <span className="tvq-idx">{i + 1}</span>
                  <div className="tvq-info">
                    <div className="tvq-singer">{r.guest_name}</div>
                    <div className="tvq-song">{song}</div>
                    <span className={`tvq-badge b-${label}`}>{prepBadgeText(label)}</span>
                  </div>
                  <div className="tvq-actions">
                    {onReopen && (
                      <button
                        type="button"
                        className="ghost sm"
                        disabled={!r.youtube_video_id}
                        onClick={() => onReopen(r.youtube_video_id)}
                      >
                        ▶ YouTube 열기
                      </button>
                    )}
                    {r.youtube_queued_at ? (
                      <button
                        type="button"
                        className="ghost sm"
                        onClick={() => void onSetQueued(r.id, false)}
                      >
                        대기열 준비 해제
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ok sm"
                        onClick={() => void onSetQueued(r.id, true)}
                      >
                        ✓ 대기열에 추가했어요
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

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
              {/* V8: the next song's TV-queue readiness — pass-turn auto-starts it. */}
              {playTarget ? (
                <p className={`muted playback-help next-preview${nextAutoReady ? ' auto' : ''}`}>
                  다음 곡: {playTarget.guest_name} — {displaySong(playTarget.youtube_title ?? '', playTarget.youtube_channel_title).song || requestDisplayTitle(playTarget)}
                  <br />
                  {nextAutoReady
                    ? '✅ READY + TV 대기열 준비됨 · 차례를 넘기면 자동 진행'
                    : '⏳ 아직 자동 진행 준비 전 (Ready + TV 대기열 필요)'}
                </p>
              ) : (
                <p className="muted playback-help">다음 대기 곡이 없습니다.</p>
              )}
              <div className="stage-actions">
                {onReopen && (
                  <button
                    className="ghost lg"
                    disabled={!current.youtube_video_id}
                    onClick={() => onReopen(current.youtube_video_id)}
                  >
                    ▶ YouTube 다시 열기
                  </button>
                )}
                {/* Lyrics V1: add/edit the words shown on the iPad Display for the
                    song on stage. Reflects immediately on the Display's next poll. */}
                <button className="ghost lg" onClick={() => setLyricsFor(current)}>
                  {current.lyrics_text?.trim() ? '📝 가사 편집' : '📝 가사 추가'}
                </button>
                {playerFinishConfirm ? (
                  <div className="player-confirm">
                    {/* V8 copy: the operating question is whether the TV moved to the
                        next queued video, not whether the Admin stopped it. */}
                    <span className="player-confirm-q">TV에서 다음 곡이 시작됐나요?</span>
                    <div className="player-confirm-row">
                      <button className="ghost" onClick={() => setPlayerFinishConfirm(false)}>
                        아직이요
                      </button>
                      <button
                        className="ok"
                        disabled={busy}
                        onClick={async () => {
                          setPlayerFinishConfirm(false);
                          const reason = await onPassTurn(current.id);
                          if (reason && reason !== 'promoted' && reason !== 'error') {
                            setPassNote(
                              reason === 'no_next'
                                ? '다음 대기 곡이 없습니다.'
                                : reason === 'needs_queued'
                                  ? '다음 곡이 아직 TV 대기열에 준비되지 않았습니다.'
                                  : reason === 'needs_ready'
                                    ? '다음 가수가 아직 준비되지 않았습니다.'
                                    : '다음 곡이 아직 준비되지 않았습니다 (Ready + TV 대기열 필요).',
                            );
                          } else {
                            setPassNote(null);
                          }
                        }}
                      >
                        네, 다음 차례로
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="ok lg" disabled={busy} onClick={() => setPlayerFinishConfirm(true)}>
                    ✓ 차례 넘기기
                  </button>
                )}
              </div>
              {passNote && <p className="muted player-passnote">{passNote}</p>}
            </div>
          ) : playTarget ? (
            <div className="stage-hero ready" key={playTarget.id}>
              <div className="eyebrow">{playTarget.ready_at ? 'READY TO PLAY' : 'UP NEXT'}</div>
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
              {/* V8: the first song has no previous song to pass — the Admin starts
                  it once. When it's Ready + Queued it's an atomic first-song start. */}
              {nextAutoReady ? (
                <p className="lead player-ready">✅ READY + TV 대기열 준비됨</p>
              ) : playTarget.ready_at ? (
                <p className="muted playback-help">가수는 준비됨 · TV 대기열 준비가 필요합니다.</p>
              ) : (
                <p className="muted playback-help">아직 준비 신호를 기다리고 있습니다.</p>
              )}
              <div className="stage-actions">
                <button
                  className="primary lg"
                  disabled={busy || !playTarget.youtube_video_id}
                  onClick={() => onStartFirst(playTarget.id, playTarget.youtube_video_id)}
                >
                  ▶ 첫 곡 시작
                </button>
              </div>
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
              onEditLyrics={() => {
                setLyricsFor(sheetFor);
                setSheetFor(null);
              }}
              onClose={() => setSheetFor(null)}
            />
          );
        })()}

      {/* ── Lyrics editor (Admin adds / edits / clears the Display's words) ── */}
      {lyricsFor && (
        <LyricsSheet
          request={lyricsFor}
          onSave={onSetLyrics}
          onClose={() => setLyricsFor(null)}
        />
      )}
    </main>
  );
}
