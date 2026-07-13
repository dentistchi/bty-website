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
  resolveGuestStatus,
  type DjAction,
  type GuestQueueStatus,
  type QueueOrderEntry,
  type RequestStatus,
} from '@/domain/queue';

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
  return resolveGuestStatus(requestId, toOrderEntries(active), target.status);
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
    return { outcome: 'ok', status: status ?? { requestId, state: 'removed', position: 0, aheadCount: 0, isUpNext: false, isNowPlaying: false } };
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
  if (action !== 'skip') patch[NOW_COLUMN[action]] = new Date().toISOString();

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
