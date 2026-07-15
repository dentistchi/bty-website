// Server-only data access for Karaoke rooms and requests. Thin wrapper over the
// service-role client; pure queue math lives in src/domain.

import { karaokeDb } from './supabase.server';
import { credentialMatches } from './dj-auth.server';
import { authorizeDevice } from './devices.server';
import type { DeviceRole } from '@/domain/pairing';
import {
  ACTIVE_STATUSES,
  isValidTransition,
  nextPosition,
  frontPosition,
  resolveGuestStatus,
  canonicalRank,
  type DjAction,
  type GuestQueueStatus,
  type QueueOrderEntry,
  type RequestStatus,
} from '@/domain/queue';
import { classifyVideo } from '@/domain/video-kind';
import { requestDisplayTitle } from '@/domain/request-view';
import { displayStatsFrom, type DisplayRequest, type DisplayState } from '@/domain/display';
import type { StatRequest } from '@/domain/event-stats';

export interface PublicRoom {
  id: string;
  slug: string;
  display_name: string;
  status: 'open' | 'closed';
}

export interface KaraokeRequest {
  id: string;
  room_id: string;
  guest_name: string;
  search_query: string | null;
  youtube_video_id: string;
  youtube_title: string | null;
  youtube_channel_title: string | null;
  youtube_thumbnail_url: string | null;
  position: number;
  status: RequestStatus;
  session_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  /** V6: the guest signalled "I'm ready" while still waiting (Admin Player reads it). */
  ready_at: string | null;
}

const PUBLIC_ROOM_COLS = 'id, slug, display_name, status';

/** Room lookup for guests — never selects dj_secret. */
export async function getPublicRoomBySlug(slug: string): Promise<PublicRoom | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select(PUBLIC_ROOM_COLS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicRoom) ?? null;
}

/**
 * Verify a DJ credential (raw) against the room's stored hash. Returns the
 * public room on success, else null. The raw credential never leaves this call
 * and the stored hash is never returned.
 */
export async function authorizeDjCredential(
  slug: string,
  rawCredential: string,
): Promise<PublicRoom | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select(`${PUBLIC_ROOM_COLS}, dj_secret`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as PublicRoom & { dj_secret: string | null };
  if (!(await credentialMatches(row.dj_secret, rawCredential))) return null;
  const { dj_secret: _omit, ...pub } = row;
  return pub;
}

/** Internal: room row including the master credential hash (never returned raw). */
async function roomSecretRow(
  slug: string,
): Promise<(PublicRoom & { dj_secret: string | null }) | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select(`${PUBLIC_ROOM_COLS}, dj_secret`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicRoom & { dj_secret: string | null }) ?? null;
}

export interface RoomAuth {
  room: PublicRoom;
  role: DeviceRole;
  /** The paired device that authorized, or null when the master credential was used. */
  deviceId: string | null;
}

/**
 * Authorize a DJ-level bearer for a room. Accepted credentials, in order:
 *   1. the room master credential (bootstrap / owner) → admin authority
 *   2. any ACTIVE paired device (dj or admin role)
 * Returns null (no data) on failure. This replaces raw-credential-only DJ auth.
 */
export async function authorizeDj(slug: string, bearer: string): Promise<RoomAuth | null> {
  const row = await roomSecretRow(slug);
  if (!row) return null;
  const { dj_secret, ...pub } = row;
  if (await credentialMatches(dj_secret, bearer)) {
    return { room: pub, role: 'admin', deviceId: null };
  }
  const device = await authorizeDevice(pub.id, bearer);
  if (device) return { room: pub, role: device.role, deviceId: device.id };
  return null;
}

/**
 * Authorize an ADMIN-level bearer for a room. Accepted credentials:
 *   1. the room master credential
 *   2. an ACTIVE paired device whose role is 'admin'
 * DJ-role devices are rejected — they cannot pair devices, rotate, or manage
 * sessions. Returns null (no data) on failure.
 */
export async function authorizeAdmin(slug: string, bearer: string): Promise<RoomAuth | null> {
  const row = await roomSecretRow(slug);
  if (!row) return null;
  const { dj_secret, ...pub } = row;
  if (await credentialMatches(dj_secret, bearer)) {
    return { room: pub, role: 'admin', deviceId: null };
  }
  const device = await authorizeDevice(pub.id, bearer);
  if (device && device.role === 'admin') return { room: pub, role: 'admin', deviceId: device.id };
  return null;
}

/** The room's encoded Admin-PIN record (or null when no PIN is configured). */
export async function getRoomAdminPinHash(roomId: string): Promise<string | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select('admin_pin_hash')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data?.admin_pin_hash as string | null) ?? null;
}

/** Set/rotate the room's Admin-PIN hash. Does NOT touch any device tokens. */
export async function setRoomAdminPinHash(roomId: string, pinHash: string): Promise<void> {
  const { error } = await karaokeDb()
    .from('karaoke_rooms')
    .update({ admin_pin_hash: pinHash, admin_pin_updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

export interface RoomStats {
  requests: number;
  guests: number;
}

/** Live counts for the room header: active requests and distinct singers. */
export async function activeRequestStats(roomId: string): Promise<RoomStats> {
  const active = await listActiveRequests(roomId);
  const guests = new Set(active.map((r) => r.guest_name.trim().toLowerCase())).size;
  return { requests: active.length, guests };
}

/** Active queue (waiting + playing) for a room, ordered by position. */
export async function listActiveRequests(roomId: string): Promise<KaraokeRequest[]> {
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ACTIVE_STATUSES as unknown as string[])
    .order('position', { ascending: true });
  if (error) throw error;
  return (data as KaraokeRequest[]) ?? [];
}

/** Project the active queue down to the minimal ordering fields for the resolver. */
function toOrderEntries(rows: readonly KaraokeRequest[]): QueueOrderEntry[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    position: r.position,
    created_at: r.created_at,
  }));
}

/** One request's ordering fields, scoped to the room. Null when it isn't there. */
async function getRequestOrderFields(
  roomId: string,
  requestId: string,
): Promise<{ status: RequestStatus } | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('status')
    .eq('id', requestId)
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data as { status: RequestStatus }) ?? null;
}

/**
 * Guest-facing live status for a single request, computed from the canonical
 * active queue. Returns the compact status model ONLY — never the full queue or
 * any DJ internals. `null` when the request does not belong to this room.
 */
export async function getGuestQueueStatus(
  roomId: string,
  requestId: string,
): Promise<GuestQueueStatus | null> {
  const target = await getRequestOrderFields(roomId, requestId);
  if (!target) return null;
  const active = await listActiveRequests(roomId);
  const readyAt = active.find((r) => r.id === requestId)?.ready_at ?? null;
  return resolveGuestStatus(requestId, toOrderEntries(active), target.status, readyAt);
}

export type GuestCancelOutcome =
  | { outcome: 'ok'; status: GuestQueueStatus }
  | { outcome: 'not_found' }
  | { outcome: 'not_cancellable'; from: RequestStatus };

/**
 * Cancel a guest's own request (capability already verified by the caller).
 * Atomic + status-guarded: ONLY a still-`waiting` row flips to `removed`, so a
 * song that reached the stage (`playing`) or a terminal state can't be pulled.
 * Removal drops it from the active queue; every other guest's position then
 * recomputes from the canonical resolver on their next poll.
 */
export async function cancelOwnRequest(
  roomId: string,
  requestId: string,
): Promise<GuestCancelOutcome> {
  const db = karaokeDb();
  const { data, error } = await db
    .from('karaoke_requests')
    .update({ status: 'removed' })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'waiting')
    .select('id')
    .maybeSingle();
  if (error) throw error;

  if (data) {
    const status = await getGuestQueueStatus(roomId, requestId);
    // status is non-null here (row exists); fall back defensively.
    return { outcome: 'ok', status: status ?? { requestId, state: 'removed', position: 0, aheadCount: 0, isUpNext: false, isNowPlaying: false, readyAt: null } };
  }

  const cur = await getRequestOrderFields(roomId, requestId);
  if (!cur) return { outcome: 'not_found' };
  return { outcome: 'not_cancellable', from: cur.status };
}

export interface AddRequestArgs {
  roomId: string;
  guestName: string;
  youtubeVideoId: string;
  searchQuery?: string;
  youtubeTitle?: string;
  youtubeChannelTitle?: string;
  youtubeThumbnailUrl?: string;
  /** The active night this request belongs to (null for legacy no-session rooms). */
  sessionId?: string | null;
}

/**
 * Insert a request at the next position and report the guest's live queue slot.
 * Position is computed across all of the room's rows (not just active ones) so
 * completed/removed rows never cause a position collision.
 */
export async function addRequest(
  args: AddRequestArgs,
): Promise<{ request: KaraokeRequest; status: GuestQueueStatus; activeCount: number }> {
  const db = karaokeDb();

  const { data: allRows, error: posErr } = await db
    .from('karaoke_requests')
    .select('position')
    .eq('room_id', args.roomId);
  if (posErr) throw posErr;
  const position = nextPosition((allRows ?? []).map((r) => r.position as number));

  const { data, error } = await db
    .from('karaoke_requests')
    .insert({
      room_id: args.roomId,
      guest_name: args.guestName,
      search_query: args.searchQuery ?? null,
      youtube_video_id: args.youtubeVideoId,
      youtube_title: args.youtubeTitle ?? null,
      youtube_channel_title: args.youtubeChannelTitle ?? null,
      youtube_thumbnail_url: args.youtubeThumbnailUrl ?? null,
      position,
      status: 'waiting',
      session_id: args.sessionId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  const request = data as KaraokeRequest;

  const active = await listActiveRequests(args.roomId);
  const status = resolveGuestStatus(request.id, toOrderEntries(active), request.status);
  return { request, status, activeCount: active.length };
}

const NOW_COLUMN: Record<'play' | 'complete', 'started_at' | 'completed_at'> = {
  play: 'started_at',
  complete: 'completed_at',
};

const NEXT_STATUS: Record<DjAction, RequestStatus> = {
  play: 'playing',
  complete: 'completed',
  skip: 'skipped',
  remove: 'removed',
};

export type DjTransition =
  | { outcome: 'ok'; request: KaraokeRequest }
  | { outcome: 'not_found' }
  | { outcome: 'invalid'; from: RequestStatus };

/** DJ transition for a single request, scoped to the room and state-guarded. */
export async function setRequestStatus(
  roomId: string,
  requestId: string,
  action: DjAction,
): Promise<DjTransition> {
  const db = karaokeDb();

  const { data: current, error: readErr } = await db
    .from('karaoke_requests')
    .select('status')
    .eq('id', requestId)
    .eq('room_id', roomId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!current) return { outcome: 'not_found' };

  const from = current.status as RequestStatus;
  if (!isValidTransition(from, action)) return { outcome: 'invalid', from };

  const patch: Record<string, unknown> = { status: NEXT_STATUS[action] };
  if (action === 'play' || action === 'complete') {
    patch[NOW_COLUMN[action]] = new Date().toISOString();
  }

  const { data, error } = await db
    .from('karaoke_requests')
    .update(patch)
    .eq('id', requestId)
    .eq('room_id', roomId)
    .select('*')
    .single();
  if (error) throw error;
  return { outcome: 'ok', request: data as KaraokeRequest };
}

/**
 * "먼저 부르기" — move a still-waiting request to the FRONT of the waiting line
 * by giving it a position one before the smallest active position. A narrow,
 * single-row update: the playing song is untouched, no full renumber, and the
 * canonical resolver orders this request ahead of every other waiting song.
 * Status-guarded (only from `waiting`) so a playing/terminal request can't move.
 */
export async function moveToNextWaiting(
  roomId: string,
  requestId: string,
): Promise<DjTransition> {
  const db = karaokeDb();

  const active = await listActiveRequests(roomId);
  const target = active.find((r) => r.id === requestId);
  if (!target) {
    // Not active — distinguish not-found vs wrong-state for a truthful result.
    const { data: cur } = await db
      .from('karaoke_requests')
      .select('status')
      .eq('id', requestId)
      .eq('room_id', roomId)
      .maybeSingle();
    if (!cur) return { outcome: 'not_found' };
    return { outcome: 'invalid', from: cur.status as RequestStatus };
  }
  if (target.status !== 'waiting') return { outcome: 'invalid', from: target.status };

  const newPosition = frontPosition(active.map((r) => r.position));

  const { data, error } = await db
    .from('karaoke_requests')
    .update({ position: newPosition })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'waiting')
    .select('*')
    .single();
  if (error) throw error;
  return { outcome: 'ok', request: data as KaraokeRequest };
}

export type ReorderResult =
  | { outcome: 'ok'; requests: KaraokeRequest[] }
  | { outcome: 'queue_changed' } //  a listed id is no longer waiting → client refetches
  | { outcome: 'invalid' } //        duplicate ids in the payload
  | { outcome: 'empty' }; //         nothing to reorder

/**
 * Reorder the room's WAITING queue to the DJ's chosen order. Delegates the whole
 * operation to the atomic `reorder_karaoke_requests` RPC (advisory-locked, one
 * transaction) so concurrent reorders / guest adds / play transitions can never
 * corrupt positions or partially apply. The playing song is untouched; new
 * arrivals are preserved at the tail. On success returns the fresh active queue.
 */
export async function reorderWaitingRequests(
  roomId: string,
  orderedRequestIds: string[],
): Promise<ReorderResult> {
  const { data, error } = await karaokeDb().rpc('reorder_karaoke_requests', {
    p_room_id: roomId,
    p_ordered_ids: orderedRequestIds,
  });
  if (error) throw error;

  const outcome = data as 'ok' | 'queue_changed' | 'invalid' | 'empty';
  if (outcome === 'ok') {
    const requests = await listActiveRequests(roomId);
    return { outcome: 'ok', requests };
  }
  return { outcome };
}

// ── Self-service (V2): guests start / finish their OWN song ─────────────────
// Ownership is proven by the caller (a signed capability over the request id);
// these helpers enforce the QUEUE rules (first-in-line, single stage) atomically.

export type StartOutcome =
  | 'ok'
  | 'not_found'
  | 'not_waiting'
  | 'not_next'
  | 'already_playing';

export interface StartResult {
  outcome: StartOutcome;
  request?: KaraokeRequest;
  status?: GuestQueueStatus;
}

/**
 * Promote a guest's OWN waiting request to `playing` — but ONLY when it is the
 * canonical first waiting song AND the stage is open. Delegates the whole check
 * to the advisory-locked `start_karaoke_request` RPC so two simultaneous
 * "Start My Song" taps resolve to exactly one winner (the partial unique index
 * is the final backstop). Ownership is verified by the route before calling.
 */
export async function startOwnRequest(
  roomId: string,
  requestId: string,
): Promise<StartResult> {
  const { data, error } = await karaokeDb().rpc('start_karaoke_request', {
    p_room_id: roomId,
    p_request_id: requestId,
  });
  if (error) throw error;
  const outcome = data as StartOutcome;
  if (outcome !== 'ok') return { outcome };

  const active = await listActiveRequests(roomId);
  const request = active.find((r) => r.id === requestId);
  const status = await getGuestQueueStatus(roomId, requestId);
  return { outcome: 'ok', request: request ?? undefined, status: status ?? undefined };
}

export type FinishOutcome = 'ok' | 'already_done' | 'not_playing' | 'not_found';

export interface FinishResult {
  outcome: FinishOutcome;
  from?: RequestStatus;
}

/**
 * Finish a guest's OWN playing request: `playing → completed`. Atomic + status-
 * guarded (only a row still `playing` flips), so a double-tap or two racing
 * finishes settle idempotently — the first wins, the rest see `already_done`.
 * Ownership is verified by the route before calling.
 */
export async function finishOwnRequest(
  roomId: string,
  requestId: string,
): Promise<FinishResult> {
  const db = karaokeDb();
  const { data, error } = await db
    .from('karaoke_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'playing')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (data) return { outcome: 'ok' };

  const cur = await getRequestOrderFields(roomId, requestId);
  if (!cur) return { outcome: 'not_found' };
  // Already completed (this guest or a fallback finished it) → idempotent success.
  if (cur.status === 'completed') return { outcome: 'already_done', from: cur.status };
  return { outcome: 'not_playing', from: cur.status };
}

export type ReadyOutcome = 'ok' | 'not_waiting' | 'not_found';

/**
 * Set / clear the guest's Ready signal (V6). Only a request that is still
 * `waiting` can be readied — Ready never touches a playing/finished row and never
 * occupies the stage. Atomic + status-guarded; ownership is verified by the route.
 */
export async function setRequestReady(
  roomId: string,
  requestId: string,
  ready: boolean,
): Promise<{ outcome: ReadyOutcome }> {
  const db = karaokeDb();
  const { data, error } = await db
    .from('karaoke_requests')
    .update({ ready_at: ready ? new Date().toISOString() : null })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'waiting')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (data) return { outcome: 'ok' };
  const cur = await getRequestOrderFields(roomId, requestId);
  if (!cur) return { outcome: 'not_found' };
  return { outcome: 'not_waiting' };
}

// ── Public display / full-queue read model ─────────────────────────────────
// The single safe projection the iPad Display and the guest full-queue board
// both render. NEVER exposes session_id, dj_secret, the room UUID, or any
// credential — only what is already visible in the room (name, singer names,
// public YouTube ids, queue order).

function toDisplayRequest(r: KaraokeRequest): DisplayRequest {
  return {
    id: r.id,
    guestName: r.guest_name,
    title: requestDisplayTitle(r),
    artist: r.youtube_channel_title,
    videoId: r.youtube_video_id,
    videoKind: classifyVideo(r.youtube_title ?? r.search_query ?? '', r.youtube_channel_title ?? ''),
    thumbnailUrl: r.youtube_thumbnail_url,
    status: r.status === 'playing' ? 'playing' : 'waiting',
    ready: r.ready_at != null,
  };
}

/**
 * Build the public display state for a room from its canonical active queue.
 * `playing` is the song on stage (null when open); `waiting` is the ordered
 * line; `next` is the first waiting song. Order matches the canonical resolver.
 */
export async function getDisplayState(room: PublicRoom): Promise<DisplayState> {
  const active = await listActiveRequests(room.id);
  const playingRow = active.find((r) => r.status === 'playing') ?? null;
  const waitingRows = active
    .filter((r) => r.status === 'waiting')
    .sort((a, b) =>
      canonicalRank(
        { id: a.id, status: a.status, position: a.position, created_at: a.created_at },
        { id: b.id, status: b.status, position: b.position, created_at: b.created_at },
      ),
    );
  const waiting = waitingRows.map(toDisplayRequest);
  return {
    room: { name: room.display_name, slug: room.slug, open: room.status === 'open' },
    playing: playingRow ? toDisplayRequest(playingRow) : null,
    next: waiting[0] ?? null,
    waiting,
    waitingCount: waiting.length,
    stats: displayStatsFrom(await displayStatRows(room.id)),
    // The room layer does not know events (that would be an import cycle). The
    // canonical event is injected at the service/route boundary; default null.
    event: null,
  };
}

/**
 * Minimal rows for the LIVE panel counts (guest_name + status, any status) — the
 * same shape `computeEventStats` consumes. Safe/public: names + statuses only,
 * never a secret. One lightweight read alongside the active-queue read.
 */
async function displayStatRows(roomId: string): Promise<StatRequest[]> {
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('guest_name, status')
    .eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []) as StatRequest[];
}
