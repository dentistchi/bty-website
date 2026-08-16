// Server-only data access for Karaoke rooms and requests. Thin wrapper over the
// service-role client; pure queue math lives in src/domain.

import { karaokeDb } from './supabase.server';
import { beginSong, endSong, type BeginOutcome } from './metering.server';
import type { DurationFailureReason } from './youtube-duration.server';
// B2 enforcement: `upgrade_required` (FREE + enforcement on + no daily minutes left)
// is a first-class lifecycle outcome — it must reach the caller/route as itself, never
// collapse into a generic "invalid/not_ready". The `entitlement` snapshot travels with
// it so the client can render the truthful zero-time state without a second read.
import { credentialMatches } from './dj-auth.server';
import { authorizeDevice } from './devices.server';
import { accountHasRoomAccess, roomOwnerWorkspace } from './host-auth.server';
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
import type { ResolutionCode } from '@/domain/request-resolution';
import { resolveStageDecision } from '@/domain/play-flow';
import { type NoPromoteReason } from '@/domain/queue-assist';
import { requestDisplayTitle } from '@/domain/request-view';
import { displaySong } from '@/domain/song-title';
import { displayStatsFrom, type DisplayRequest, type DisplayState } from '@/domain/display';
import { lyricsViewFor, sanitizeLyrics } from '@/domain/lyrics';
import type { StatRequest } from '@/domain/event-stats';

export interface PublicRoom {
  id: string;
  slug: string;
  display_name: string;
  /** BUILD 26E adds the terminal 'retired' state (F-1): frozen by account deletion. */
  status: 'open' | 'closed' | 'retired';
  /** Room Settings V1 — optional guest-facing welcome message (null = none). */
  guest_welcome_message: string | null;
  /** Room Branding V1 — opaque key of the normalized logo in the private bucket (null = none). */
  logo_object_key: string | null;
  /** Room Branding V1 — cache-busting token for the versioned logo proxy URL. */
  logo_version: string | null;
  /** Room Branding V1 — preset visual theme (allowlisted; default 'midnight_gold'). */
  branding_theme: string;
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
  /** V7.1: the canonical Event this request belongs to (null for legacy rows). */
  event_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  /** V6: the guest signalled "I'm ready" while still waiting (Admin Player reads it). */
  ready_at: string | null;
  /** V8: the Admin added this song to the YouTube TV queue (Admin-only signal). */
  youtube_queued_at: string | null;
  /** Lyrics V1: Admin-provided plain-text lyrics for this song (null = none). */
  lyrics_text: string | null;
  /** 'admin' | 'provider' | null — V1 only ever writes 'admin'. */
  lyrics_source: string | null;
  /** Reserved for a future licensed provider; unused in V1. */
  lyrics_source_url: string | null;
  /** 'unavailable' | 'loading' | 'available' | 'failed'. */
  lyrics_status: string | null;
  lyrics_updated_at: string | null;
  /** V1.1: LRCLIB syncedLyrics (LRC), kept for a future timed view (unused in render). */
  lyrics_synced: string | null;
  /** V1.1: when the AUTO resolver last attempted this row (drives retry). */
  lyrics_resolved_at: string | null;
}

const PUBLIC_ROOM_COLS =
  'id, slug, display_name, status, guest_welcome_message, logo_object_key, logo_version, branding_theme';

export interface RoomSettings {
  displayName: string;
  guestWelcomeMessage: string | null;
}

/** Room Branding V1 — set the theme (allowlist already validated by the caller). */
export async function updateRoomTheme(roomId: string, theme: string): Promise<void> {
  const { error } = await karaokeDb()
    .from('karaoke_rooms')
    .update({ branding_theme: theme })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * Room Branding V1 — point the Room at a newly stored logo object. Writes ONLY the
 * pointer + version on the karaoke_rooms row (never the slug, an Event, or storage).
 * The caller uploads the object FIRST and deletes the previous object AFTER this
 * succeeds (compensation flow), so the pointer never references a missing object.
 */
export async function setRoomLogoPointer(roomId: string, objectKey: string, version: string): Promise<void> {
  const { error } = await karaokeDb()
    .from('karaoke_rooms')
    .update({ logo_object_key: objectKey, logo_version: version })
    .eq('id', roomId);
  if (error) throw error;
}

/** Room Branding V1 — clear the logo pointer (removal). Object deletion is the caller's. */
export async function clearRoomLogoPointer(roomId: string): Promise<void> {
  const { error } = await karaokeDb()
    .from('karaoke_rooms')
    .update({ logo_object_key: null, logo_version: null })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * Room Settings V1 — update the guest-facing identity of ONE Room: its display name
 * and optional welcome message. Ownership is verified by the caller (Host session →
 * account → accountHasRoomAccess) BEFORE this runs; this is the write boundary, not
 * the authorization boundary. Writes ONLY the karaoke_rooms row — never the slug,
 * an Event, a queue entry, a session, or ownership. Returns the persisted values.
 */
export async function updateRoomSettings(
  roomId: string,
  settings: RoomSettings,
): Promise<RoomSettings> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .update({
      display_name: settings.displayName,
      guest_welcome_message: settings.guestWelcomeMessage,
    })
    .eq('id', roomId)
    .select('display_name, guest_welcome_message')
    .single();
  if (error) throw error;
  return {
    displayName: data.display_name as string,
    guestWelcomeMessage: (data.guest_welcome_message as string | null) ?? null,
  };
}

/**
 * BUILD 26E / F-1 — THE retired predicate. A room frozen by account deletion is
 * terminal: it is never reopened, never transferred, and never operable again. Its rows
 * and slug are retained so an old QR code or invitation resolves to an explicit
 * ROOM_RETIRED answer instead of silently reaching a future room.
 */
export function isRetiredRoom(room: Pick<PublicRoom, 'status'> | null | undefined): boolean {
  return room?.status === 'retired';
}

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

/** Room lookup by id — never selects dj_secret. Used to resolve a device's room. */
export async function getPublicRoomById(roomId: string): Promise<PublicRoom | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select(PUBLIC_ROOM_COLS)
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicRoom) ?? null;
}

/**
 * The room + its encoded Admin-PIN record when EXACTLY ONE room has an Admin PIN
 * configured, else null. Powers slug-free device enrollment WITHOUT scanning many
 * PBKDF2 hashes: we count PIN-configured rooms cheaply and only ever verify a PIN
 * against a single candidate. Zero or ≥2 PIN-configured rooms → null (the caller
 * fails uniformly, never disclosing which case occurred). The pin_hash is used
 * server-side only and never returned to a client.
 */
export async function getSoleAdminPinRoom(): Promise<(PublicRoom & { admin_pin_hash: string }) | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select(`${PUBLIC_ROOM_COLS}, admin_pin_hash`)
    .not('admin_pin_hash', 'is', null)
    .limit(2); // 2 is enough to detect "more than one" without reading all rooms
  if (error) throw error;
  const rows = (data as (PublicRoom & { admin_pin_hash: string | null })[]) ?? [];
  if (rows.length !== 1) return null;
  const row = rows[0];
  if (!row.admin_pin_hash) return null;
  return row as PublicRoom & { admin_pin_hash: string };
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
 * Host Account V1 — the membership re-check every device-authorized call runs.
 *
 * A durable device token must NOT keep working once the Host who owns it loses
 * access. Because this sits inside authorizeDj/authorizeAdmin, all 22
 * credential-protected routes inherit it without each one being edited.
 *
 * Rules:
 *  - device NOT account-bound (enrolled before Host accounts): allowed. These are
 *    legacy credentials on a Room that predates claiming; the deployed web Admin
 *    still relies on them. Documented transitional allowance, not an oversight.
 *  - device account-bound + Room UNCLAIMED: allowed (no workspace exists to be a
 *    member of yet).
 *  - device account-bound + Room CLAIMED: REQUIRED to hold an active membership in
 *    the workspace that owns this Room. Revoked membership, or membership in some
 *    other workspace, fails here on the very next request.
 */
async function deviceStillAuthorized(roomId: string, accountId: string | null): Promise<boolean> {
  if (!accountId) return true;
  const owner = await roomOwnerWorkspace(roomId);
  if (!owner) return true;
  return accountHasRoomAccess(accountId, roomId);
}

/**
 * Authorize a DJ-level bearer for a room. Accepted credentials, in order:
 *   1. the room master credential (bootstrap / owner) → admin authority
 *   2. any ACTIVE paired device (dj or admin role) whose Host still has access
 * Returns null (no data) on failure. This replaces raw-credential-only DJ auth.
 */
export async function authorizeDj(slug: string, bearer: string): Promise<RoomAuth | null> {
  const row = await roomSecretRow(slug);
  if (!row) return null;
  // BUILD 26E / F-1: a retired room has ZERO usable administrative authority. Placed
  // here (and in authorizeAdmin) rather than in each route, because these two functions
  // are the chokepoint every credential-protected room route already funnels through —
  // so Start, Complete, Skip, queue mutation, pairing and administration all inherit it.
  if (isRetiredRoom(row)) return null;
  const { dj_secret, ...pub } = row;
  if (await credentialMatches(dj_secret, bearer)) {
    return { room: pub, role: 'admin', deviceId: null };
  }
  const device = await authorizeDevice(pub.id, bearer);
  if (device && (await deviceStillAuthorized(pub.id, device.accountId))) {
    return { room: pub, role: device.role, deviceId: device.id };
  }
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
  if (isRetiredRoom(row)) return null; // BUILD 26E / F-1 — see authorizeDj
  const { dj_secret, ...pub } = row;
  if (await credentialMatches(dj_secret, bearer)) {
    return { room: pub, role: 'admin', deviceId: null };
  }
  const device = await authorizeDevice(pub.id, bearer);
  if (
    device &&
    device.role === 'admin' &&
    (await deviceStillAuthorized(pub.id, device.accountId))
  ) {
    return { room: pub, role: 'admin', deviceId: device.id };
  }
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
export async function activeRequestStats(
  roomId: string,
  eventId?: string | null,
): Promise<RoomStats> {
  const active = await listActiveRequests(roomId, eventId);
  const guests = new Set(active.map((r) => r.guest_name.trim().toLowerCase())).size;
  return { requests: active.length, guests };
}

/** Active queue (waiting + playing) for a room, ordered by position. */
export async function listActiveRequests(
  roomId: string,
  eventId?: string | null,
): Promise<KaraokeRequest[]> {
  // V7.1: when the room is owned by an Event, scope the queue to THAT Event's rows
  // so a previous round's history never leaks into the current queue. Legacy
  // eventless rooms (eventId null/undefined) keep the room-wide scope unchanged.
  let q = karaokeDb()
    .from('karaoke_requests')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ACTIVE_STATUSES as unknown as string[]);
  if (eventId) q = q.eq('event_id', eventId);
  const { data, error } = await q.order('position', { ascending: true });
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
  eventId?: string | null,
): Promise<GuestQueueStatus | null> {
  const target = await getRequestOrderFields(roomId, requestId);
  if (!target) return null;
  const active = await listActiveRequests(roomId, eventId);
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
  // BUILD 25 — status and reason are written in the SAME guarded statement, so they can never
  // diverge, and the `status='waiting'` guard is the precedence rule: a row another writer already
  // resolved matches zero rows here, so this can never overwrite a truthful earlier reason.
  const { data, error } = await db
    .from('karaoke_requests')
    .update({
      status: 'removed',
      resolution_code: 'guest_cancelled' satisfies ResolutionCode,
      resolved_at: new Date().toISOString(),
    })
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
  /** The canonical Event this request belongs to (V7.1). Null for legacy eventless
   *  rooms. This is the PERMANENT event scope for every stat/queue read. */
  eventId?: string | null;
  /** BUILD 18B — client-minted key, stable across timeout/retry of ONE logical request.
   *  When present the insert is replay-safe (partial unique index on
   *  room+event+key). Null/undefined = legacy insert, no dedup. */
  idempotencyKey?: string | null;
  /** BUILD 26T-R1B-R6-R1B-R3 — the VERIFIER-returned sealed instant, or null. Callers must pass
   *  the result of `verifyYouTubeProvenance`, never a client-supplied timestamp. */
  youtubeMetadataFetchedAt?: Date | null;
}

/**
 * BUILD 18B — the outcome of a (possibly replayed) guest request insert.
 *   created  — a brand-new queue row was inserted.
 *   replayed — the same idempotency key already produced this row (SAME payload); the
 *              existing row is returned so a timeout/retry never duplicates.
 *   conflict — the same key was reused with a DIFFERENT song/guest; nothing is inserted
 *              and the caller must surface a stable idempotency_conflict (never a silent
 *              success).
 */
export type AddRequestResult =
  | { outcome: 'created'; request: KaraokeRequest; status: GuestQueueStatus; activeCount: number }
  | { outcome: 'replayed'; request: KaraokeRequest; status: GuestQueueStatus; activeCount: number }
  | { outcome: 'conflict' };

function is23505(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/**
 * Insert a request at the next position and report the guest's live queue slot.
 * Position is computed across all of the room's rows (not just active ones) so
 * completed/removed rows never cause a position collision.
 *
 * BUILD 18B: when `idempotencyKey` is set, a unique-index (23505) collision means the
 * same logical request already landed — we READ the existing row and return it as a
 * `replayed` success when the song/guest match, or `conflict` when the key was reused
 * for a different payload. No existing row is ever mutated.
 */
export async function addRequest(args: AddRequestArgs): Promise<AddRequestResult> {
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
      // Only ever the verifier's sealed instant. There is deliberately no `?? new Date()` and no
      // client-value fallback here: an unverifiable snapshot must record NULL, not "now".
      youtube_metadata_fetched_at: args.youtubeMetadataFetchedAt
        ? args.youtubeMetadataFetchedAt.toISOString()
        : null,
      position,
      status: 'waiting',
      session_id: args.sessionId ?? null,
      event_id: args.eventId ?? null,
      idempotency_key: args.idempotencyKey ?? null,
    })
    .select('*')
    .single();

  if (error) {
    // A unique-index collision is the ONLY expected error when a key is present: the
    // same logical request already landed (a retry after a lost response, or a
    // concurrent duplicate). Read the existing row and replay it; anything else throws.
    if (args.idempotencyKey && is23505(error)) {
      const existing = await findRequestByKey(db, args.roomId, args.eventId ?? null, args.idempotencyKey);
      if (!existing) throw error; // vanished under us — surface the real error
      // The key must map to the SAME song + guest, else it was reused for a different
      // request: never a silent success.
      if (existing.youtube_video_id !== args.youtubeVideoId || existing.guest_name !== args.guestName) {
        return { outcome: 'conflict' };
      }
      const active = await listActiveRequests(args.roomId, args.eventId ?? null);
      const status = resolveGuestStatus(existing.id, toOrderEntries(active), existing.status);
      return { outcome: 'replayed', request: existing, status, activeCount: active.length };
    }
    throw error;
  }

  const request = data as KaraokeRequest;
  const active = await listActiveRequests(args.roomId, args.eventId ?? null);
  const status = resolveGuestStatus(request.id, toOrderEntries(active), request.status);
  return { outcome: 'created', request, status, activeCount: active.length };
}

/**
 * BUILD 22 — does this room+event+key bucket ALREADY hold a request?
 *
 * Used by the submit route to answer one question before spending an external duration lookup:
 * is this a genuinely NEW logical request, or an 18B retry of one that already landed? A replay
 * must never be re-adjudicated — the song was admitted when it was created, and re-checking it
 * would let a later YouTube outage retroactively reject an accepted request.
 *
 * This is a READ-ONLY pre-check and is deliberately NOT the idempotency decision: `addRequest`
 * remains the sole authority on created / replayed / conflict, exactly as BUILD 18B shipped it.
 */
export async function hasExistingRequestForKey(
  roomId: string,
  eventId: string | null,
  key: string,
): Promise<boolean> {
  return (await findRequestByKey(karaokeDb(), roomId, eventId, key)) !== null;
}

/** Read the single row matching a room+event+key tuple (the unique-index bucket). */
async function findRequestByKey(
  db: ReturnType<typeof karaokeDb>,
  roomId: string,
  eventId: string | null,
  key: string,
): Promise<KaraokeRequest | null> {
  let q = db
    .from('karaoke_requests')
    .select('*')
    .eq('room_id', roomId)
    .eq('idempotency_key', key);
  q = eventId === null ? q.is('event_id', null) : q.eq('event_id', eventId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as KaraokeRequest | null) ?? null;
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

/**
 * BUILD 25 — the Host disposition recorded by the APP-LEVEL branch of `setRequestStatus`, which
 * only ever runs for a still-`waiting` row.
 *
 * `play` and `complete` are present for exhaustiveness but unreachable here: both are handled
 * earlier by the metering RPCs and return before this map is read. Neither may ever carry a
 * reason — `play` is not terminal, and `complete` is normal completion, which the database CHECK
 * refuses to pair with an abnormal resolution.
 */
const HOST_RESOLUTION: Record<DjAction, ResolutionCode | null> = {
  play: null,
  complete: null,
  skip: 'host_skipped',
  remove: 'host_removed',
};

export type DjTransition =
  | { outcome: 'ok'; request: KaraokeRequest; from: RequestStatus }
  | { outcome: 'not_found' }
  | { outcome: 'invalid'; from: RequestStatus }
  // B2: a manual Admin play blocked by the FREE daily limit. NOTHING mutated (the
  // begin RPC rolled back) — the request stays exactly where it was.
  | { outcome: 'upgrade_required'; from: RequestStatus; entitlement?: unknown };

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

  // The full row after a transition (terminal rows are not in listActiveRequests).
  const fetchRow = async (): Promise<KaraokeRequest | null> => {
    const { data } = await db
      .from('karaoke_requests')
      .select('*')
      .eq('id', requestId)
      .eq('room_id', roomId)
      .maybeSingle();
    return (data as KaraokeRequest) ?? null;
  };

  // Metering hot-path transitions go through atomic RPCs (status flip + usage segment
  // in one transaction). No app-level 'playing'/'completed'/'skipped(playing)' write.
  if (action === 'play') {
    const r = await beginSong(roomId, requestId, 'promote'); // Admin manual Start = promote
    if (r.outcome === 'upgrade_required') {
      // FREE minutes exhausted: no status/segment/queue change — surface the block.
      return { outcome: 'upgrade_required', from, entitlement: r.entitlement };
    }
    if (r.outcome !== 'ok') return { outcome: 'invalid', from };
    const row = await fetchRow();
    return row ? { outcome: 'ok', request: row, from } : { outcome: 'not_found' };
  }
  if (action === 'complete') {
    const r = await endSong(roomId, requestId, 'complete');
    if (r.outcome !== 'ok' && r.outcome !== 'recovered') return { outcome: 'invalid', from };
    const row = await fetchRow();
    return row ? { outcome: 'ok', request: row, from } : { outcome: 'not_found' };
  }
  if (action === 'skip' && from === 'playing') {
    const r = await endSong(roomId, requestId, 'skip');
    if (r.outcome !== 'ok' && r.outcome !== 'recovered') return { outcome: 'invalid', from };
    const row = await fetchRow();
    return row ? { outcome: 'ok', request: row, from } : { outcome: 'not_found' };
  }

  // Non-metering queue ops stay app-level, HARD-GUARDED to a waiting source so they can
  // never touch a playing song: skip-of-waiting (→skipped) and remove (→removed).
  //
  // BUILD 25 — the Host's own action is the reason, and the SERVER knows which action it is
  // running; the actor is never inferred from the client after the write, and no client can
  // submit a code. Same statement as the status flip, same waiting-guard precedence rule as
  // `cancelOwnRequest`.
  const resolution = HOST_RESOLUTION[action];
  const { data, error } = await db
    .from('karaoke_requests')
    .update({
      status: NEXT_STATUS[action],
      // Only ever non-null for skip/remove — the two actions that can reach this branch. The
      // null-guarded spread means a hypothetical future action without a code writes no reason
      // rather than an invented one, and the DB CHECK still enforces the pair-nullability rule.
      ...(resolution ? { resolution_code: resolution, resolved_at: new Date().toISOString() } : {}),
    })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'waiting')
    .select('*')
    .single();
  if (error) throw error;
  return { outcome: 'ok', request: data as KaraokeRequest, from };
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
  return { outcome: 'ok', request: data as KaraokeRequest, from: 'waiting' };
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
  | 'already_playing'
  | 'upgrade_required'
  // BUILD 20M (v2 lease path): duration unresolved (fail closed, retryable) / a timed pass
  // cannot cover the whole video. Nothing was started in either case.
  | 'duration_unavailable'
  | 'pass_insufficient';

export interface StartResult {
  outcome: StartOutcome;
  request?: KaraokeRequest;
  status?: GuestQueueStatus;
  /** Present when outcome === 'upgrade_required' — the truthful usage snapshot. */
  entitlement?: unknown;
}

/**
 * Promote a guest's OWN waiting request to `playing` — but ONLY when it is the
 * canonical first waiting song AND the stage is open. Delegates the whole check
 * to the advisory-locked karaoke_begin_song ('guest' mode) RPC so two simultaneous
 * "Start My Song" taps resolve to exactly one winner (the one-playing partial unique
 * index is the final backstop), and the usage segment opens atomically with the flip.
 * Ownership is verified by the route before calling.
 */
export async function startOwnRequest(
  roomId: string,
  requestId: string,
): Promise<StartResult> {
  // B1 metering: guest self-start via the atomic karaoke_begin_song ('guest' mode) —
  // enforces canonical first-waiting + stage-open inside the RPC and opens the segment.
  const r = await beginSong(roomId, requestId, 'guest');
  const outcome = beginToStartOutcome(r.outcome, { roomId, requestId });
  if (outcome !== 'ok') return { outcome, entitlement: outcome === 'upgrade_required' ? r.entitlement : undefined };

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
  // B1 metering: playing→completed + close its usage segment in ONE atomic RPC
  // (karaoke_end_song, 'complete'). No app-level 'completed' write remains here.
  const r = await endSong(roomId, requestId, 'complete');
  switch (r.outcome) {
    case 'ok':
      return { outcome: 'ok', from: 'playing' };
    case 'recovered': // already terminal; a stray open segment was closed (idempotent success)
    case 'already_done':
      return { outcome: 'already_done', from: 'completed' };
    case 'not_found':
      return { outcome: 'not_found' };
    default:
      // not_playing / request_state_changed / ownership_state_invalid / invalid_action
      return { outcome: 'not_playing' };
  }
}

export interface PassTurnResult extends AdmissionDetail {
  /** The current song was completed (or was already terminal — idempotent). */
  completed: boolean;
  /** The next song auto-started in BTY (Ready + Queued), else null. */
  promoted: KaraokeRequest | null;
  /**
   * 'promoted' on success; 'upgrade_required' when the current song was completed but
   * the next start is blocked by the FREE daily limit; else why the next song did not
   * auto-start.
   *
   * BUILD 23 — `duration_unavailable` and `pass_insufficient` are now first-class reasons here.
   * They were previously indistinguishable from `needs_ready`, which told the Host to wait for a
   * Ready signal the next singer had ALREADY given. Adding them narrows `needs_ready` back to
   * what it actually means and never widens it.
   */
  reason: 'promoted' | 'upgrade_required' | 'duration_unavailable' | 'pass_insufficient' | NoPromoteReason;
  /** Present when reason === 'upgrade_required' — the truthful usage snapshot. */
  entitlement?: unknown;
  /**
   * BUILD 23 — the canonical request whose start was REFUSED (duration_unavailable /
   * pass_insufficient). Both clients bind their durable notice to this id, so identity is
   * server truth rather than a client's guess at "which song was next".
   */
  blocked?: KaraokeRequest | null;
  /** BUILD 23 — why the duration was untrusted. Present ONLY on `duration_unavailable`, and only
   *  when the resolver actually classified one. Never derived at this layer. */
  durationFailureReason?: DurationFailureReason;
}

export type PromoteOutcome =
  | 'started'
  | 'blocked_not_ready'
  | 'already_playing'
  | 'queue_empty'
  | 'upgrade_required'
  // BUILD 23 — the two fail-closed admission blocks the v2 begin transaction can return on an
  // AUTO-ADVANCE. `promoteRequestToPlaying` has always produced them; this type used to be too
  // narrow to represent them, so they fell into the caller's catch-all and were reported as
  // "the next singer isn't ready". Nothing was started in either case.
  | 'duration_unavailable'
  | 'pass_insufficient';

export interface PromoteResult extends AdmissionDetail {
  outcome: PromoteOutcome;
  /** The song now on stage (started / already_playing). */
  request?: KaraokeRequest;
  /**
   * The waiting song that did NOT start: the earliest waiting song when none is Ready
   * (blocked_not_ready), or — BUILD 23 — the Ready song whose start the authority refused
   * (duration_unavailable / pass_insufficient). It stays `waiting` + Ready either way.
   */
  nextRequest?: KaraokeRequest;
  /** Present when outcome === 'upgrade_required' — the truthful usage snapshot. */
  entitlement?: unknown;
  /** BUILD 23 — pure passthrough of the resolver's classification (duration_unavailable only). */
  durationFailureReason?: DurationFailureReason;
}

/**
 * V8.1 — the concurrency-safe primitive that flips a single WAITING request to
 * `playing`. The one-playing invariant is enforced by the DB partial unique index
 * `karaoke_requests_one_playing_idx` (at most one `playing` row per room): if a
 * second song races onto the stage the UPDATE fails with SQLSTATE 23505, which we
 * map to `already_playing` (the other caller won). Idempotent: if the target is
 * ALREADY the playing row, that is success (no error) — so an ensure/start of the
 * song currently on stage never reports a false failure.
 */
/** Map a begin_song outcome onto the StartOutcome the callers reason about. */
function beginToStartOutcome(o: BeginOutcome, ctx: { roomId: string; requestId: string }): StartOutcome {
  switch (o) {
    case 'ok':
      return 'ok';
    case 'already_playing':
      return 'already_playing';
    case 'not_next':
      return 'not_next';
    case 'not_found':
      return 'not_found';
    case 'not_waiting':
      return 'not_waiting';
    case 'upgrade_required':
      // B2: FREE daily minutes exhausted + enforcement on. NOT an anomaly and NOT a
      // generic failure — the caller must surface the zero-time / upgrade state.
      return 'upgrade_required';
    case 'duration_unavailable':
      // BUILD 20M v2: the playback duration could not be resolved → fail closed, retryable.
      return 'duration_unavailable';
    case 'pass_insufficient':
      // BUILD 20M v2: the timed pass cannot cover the whole video → blocked, not started.
      return 'pass_insufficient';
    default:
      // not_ready (promote race) / event_state_invalid / ownership_state_invalid /
      // request_state_changed / shadow_metering_error → "did not start"; callers treat
      // like not-ready and reconcile on the next read. Anomalies are logged.
      if (o !== 'not_ready') {
        console.warn('[metering] begin_song anomaly', { ...ctx, outcome: o });
      }
      return 'not_waiting';
  }
}

/** promoteRequestToPlaying result — carries the entitlement snapshot on a blocked start. */
interface PromoteFlip extends AdmissionDetail {
  outcome: StartOutcome;
  entitlement?: unknown;
  // BUILD 21 — the resolver's duration diagnosis, threaded up unchanged (duration_unavailable only).
  durationFailureReason?: DurationFailureReason;
}

/**
 * BUILD 20M-GLOBAL-CUTOVER-R1 — the authoritative admission detail the v2 transaction already
 * computed, threaded up unchanged so the route can explain a decision concretely. Every field is
 * optional: the v1 path supplies none, and an absent field means "the authority did not give us
 * this" — callers must fall back to generic copy, never to a fabricated value.
 */
export interface AdmissionDetail {
  /** Success: the non-shrinkable lease end written for this start (ISO-8601). */
  leaseEndsAt?: string | null;
  /** Trusted video duration in seconds (the v_dur the gate compared). */
  durationSeconds?: number | null;
  /** upgrade_required: the union charge actually compared with remainingSeconds (≤ duration). */
  requiredChargeSeconds?: number | null;
  /** Blocked: finite remaining seconds at the decision instant. */
  remainingSeconds?: number | null;
  /** pass_insufficient: the pass expiry the whole video had to finish inside. */
  passExpiresAt?: string | null;
  /**
   * BUILD 26M — pass_insufficient only: how many passes the Host could switch to. Chooses which
   * sentence the block shows; grants nothing. Absent means the authority did not count.
   */
  switchCandidateCount?: number | null;
  // BUILD 20M-R4 — FREE Final Song Grace (success path only).
  finalSongGraceApplied?: boolean;
  finalSongGraceSeconds?: number | null;
  finalSongChargedSeconds?: number | null;
  remainingBeforeSeconds?: number | null;
}

/** Copy the admission detail off a BeginResult without inventing anything. */
function admissionDetailOf(r: AdmissionDetail): AdmissionDetail {
  return {
    leaseEndsAt: r.leaseEndsAt,
    durationSeconds: r.durationSeconds,
    requiredChargeSeconds: r.requiredChargeSeconds,
    remainingSeconds: r.remainingSeconds,
    passExpiresAt: r.passExpiresAt,
    switchCandidateCount: r.switchCandidateCount,
    finalSongGraceApplied: r.finalSongGraceApplied,
    finalSongGraceSeconds: r.finalSongGraceSeconds,
    finalSongChargedSeconds: r.finalSongChargedSeconds,
    remainingBeforeSeconds: r.remainingBeforeSeconds,
  };
}

/**
 * R1 §B — the lease already in force for a request that is ALREADY playing. Pure READ of the
 * canonical open usage segment: it creates no lease, extends nothing, opens no segment, and
 * activates no pass. Returns {} when no authoritative lease exists (v1 rows, or no open
 * segment) so `already_active` reports nil rather than a guessed end.
 */
async function activeLeaseForRequest(requestId: string): Promise<AdmissionDetail> {
  // Best-effort by design: this only enriches an ALREADY-decided success. A lookup failure must
  // degrade to "no lease detail" and never turn a canonical already_active into an error.
  try {
    const { data, error } = await karaokeDb()
      .from('karaoke_event_usage_segments')
      .select('lease_ends_at, duration_seconds')
      .eq('request_id', requestId)
      .is('ended_at', null)
      .maybeSingle();
    if (error || !data) return {};
    const lease = data.lease_ends_at as string | null;
    const dur = data.duration_seconds as number | null;
    return {
      leaseEndsAt: typeof lease === 'string' && lease.length > 0 ? lease : undefined,
      durationSeconds: typeof dur === 'number' && Number.isFinite(dur) ? dur : undefined,
      // R4 — recover the grace metadata for this already-admitted request, so a response-loss
      // retry reports the SAME grace facts instead of silently losing them.
      ...(await graceForRequest(requestId)),
    };
  } catch {
    return {};
  }
}

/**
 * BUILD 20M-R4 — the durable grace record for an already-admitted request. Pure READ of the
 * once-per-window ledger; it grants nothing and consumes nothing. Returns {} when this request
 * was not admitted by grace, so ordinary starts are entirely unaffected.
 */
async function graceForRequest(requestId: string): Promise<AdmissionDetail> {
  try {
    const { data, error } = await karaokeDb()
      .from('karaoke_free_final_song_grace')
      .select('grace_seconds, charged_seconds, remaining_before_seconds')
      .eq('request_id', requestId)
      .maybeSingle();
    if (error || !data) return {};
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    return {
      finalSongGraceApplied: true,
      finalSongGraceSeconds: n(data.grace_seconds),
      finalSongChargedSeconds: n(data.charged_seconds),
      remainingBeforeSeconds: n(data.remaining_before_seconds),
    };
  } catch {
    return {};
  }
}

// B1 metering: the waiting→playing flip + its usage segment are opened in ONE atomic
// RPC (karaoke_begin_song, promote mode). No app-level 'playing' write remains here;
// the one-playing index + canonical first-ready check live inside the RPC. B2: the
// begin RPC also decides enforcement — a FREE account with no minutes gets
// `upgrade_required` + its entitlement, which we thread up unchanged.
async function promoteRequestToPlaying(roomId: string, requestId: string): Promise<PromoteFlip> {
  const r = await beginSong(roomId, requestId, 'promote');
  return {
    outcome: beginToStartOutcome(r.outcome, { roomId, requestId }),
    entitlement: r.entitlement,
    ...admissionDetailOf(r),   // R1 — thread the transaction's own values up unchanged
    // BUILD 21 — same rule for the duration diagnosis: passthrough only, never derived here.
    ...(r.durationFailureReason ? { durationFailureReason: r.durationFailureReason } : {}),
  };
}

export type EnsurePlayingOutcome =
  | 'started'
  | 'already_active'
  | 'conflict'
  | 'not_ready'
  | 'not_found'
  | 'upgrade_required'
  // BUILD 20M (v2 lease path): fail-closed duration / timed-pass-cannot-cover. Not started.
  | 'duration_unavailable'
  | 'pass_insufficient';

export interface EnsurePlayingResult extends AdmissionDetail {
  outcome: EnsurePlayingOutcome;
  /** The canonical playing request (started / already_active). */
  request?: KaraokeRequest;
  /** The OTHER song that already holds the stage (conflict). */
  playing?: KaraokeRequest;
  /** Present when outcome === 'upgrade_required' — the truthful usage snapshot. */
  entitlement?: unknown;
  // BUILD 21 — present ONLY on 'duration_unavailable': why the duration could not be trusted.
  // Pure passthrough from the resolver; this layer never classifies and never defaults it.
  durationFailureReason?: DurationFailureReason;
}

/**
 * V8.1 — the ONE idempotent "make this request the stage" action the Admin's single
 * READY TO PLAY player uses before opening YouTube. Success when the target was
 * newly started, is already the playing row, or auto-promotion already put it on
 * stage. A precise conflict when ANOTHER song is playing. Never creates a second
 * playing row (see promoteRequestToPlaying). Event-scoped like every read/mutation.
 */
export async function ensurePlaying(
  roomId: string,
  requestId: string,
  eventId?: string | null,
): Promise<EnsurePlayingResult> {
  const active = await listActiveRequests(roomId, eventId);
  const target = active.find((r) => r.id === requestId);
  if (!target) return { outcome: 'not_found' };

  const playing = active.find((r) => r.status === 'playing');
  if (playing) {
    if (playing.id === requestId) {
      // R1 §B — this song is ALREADY the stage (a retry, or response-loss recovery). Report the
      // lease already in force so recovery never loses lease visibility. Read-only: no new lease,
      // no segment, no pass activation, no second playing mutation.
      return { outcome: 'already_active', request: playing, ...(await activeLeaseForRequest(playing.id)) };
    }
    return { outcome: 'conflict', playing };
  }
  if (target.status !== 'waiting' || target.ready_at == null) {
    // The target isn't a ready waiting song (e.g. someone cleared Ready). Nothing
    // to start — the card will reconcile to canonical state on the next read.
    return { outcome: 'not_ready' };
  }

  const flip = await promoteRequestToPlaying(roomId, requestId);
  if (flip.outcome === 'ok') {
    const now = (await listActiveRequests(roomId, eventId)).find((r) => r.id === requestId);
    // R1 §A — leaseEndsAt/durationSeconds come from the RPC that WROTE the lease, so they can
    // never disagree with the persisted segment.
    return { outcome: 'started', request: now ?? target, ...admissionDetailOf(flip) };
  }
  if (flip.outcome === 'upgrade_required') {
    // FREE minutes exhausted (enforcement on): NOTHING mutated (the RPC rolled back).
    // Surface the block truthfully — no song was started.
    // R1 §D — plus duration + the union charge actually compared, so the client never
    // presents raw song length as the required time.
    return { outcome: 'upgrade_required', entitlement: flip.entitlement, ...admissionDetailOf(flip) };
  }
  if (flip.outcome === 'duration_unavailable' || flip.outcome === 'pass_insufficient') {
    // BUILD 20M v2: fail closed — nothing mutated, nothing started. Surfaced distinctly so the
    // client can retry (duration) or explain the pass shortfall.
    // R1 §C/§E — pass_insufficient carries its boundary detail; duration_unavailable stays bare
    // (admissionDetailOf yields all-undefined there, so no fabricated zero can leak out).
    // BUILD 21 — carry the duration diagnosis when the resolver classified one. Spread
    // conditionally so an unclassified failure keeps the key ABSENT rather than undefined,
    // preserving the exact pre-BUILD-21 shape.
    return {
      outcome: flip.outcome,
      ...admissionDetailOf(flip),
      ...(flip.durationFailureReason ? { durationFailureReason: flip.durationFailureReason } : {}),
    };
  }
  if (flip.outcome === 'already_playing') {
    const p = (await listActiveRequests(roomId, eventId)).find((r) => r.status === 'playing');
    if (p?.id === requestId) return { outcome: 'already_active', request: p, ...(await activeLeaseForRequest(p.id)) };
    return { outcome: 'conflict', playing: p };
  }
  // not_waiting / not_found → the queue changed under us; report "not ready now".
  return { outcome: 'not_ready' };
}

/**
 * V8.1 AUTOPILOT — the ONE authoritative "start the next stage if it's Ready" service.
 * Ready is the guest's INTENT; starting is the SYSTEM's responsibility.
 *
 * Canonical next-ready resolver: the EARLIEST-position waiting song whose guest has
 * signalled Ready (event-scoped). An un-ready song NEVER blocks a Ready one behind it —
 * so with `#1 unready, #2 ready` the system starts #2. If #1 later becomes Ready while
 * #2 is playing, #2 is not interrupted; when #2 finishes, #1 (earlier position) is the
 * next promoted — original queue position stays authoritative.
 *
 * Concurrency-safe: the `waiting → playing` flip goes through promoteRequestToPlaying,
 * whose one-playing partial-unique-index guarantees two simultaneous callers resolve to
 * exactly one winner (the loser gets `already_playing`, never a second stage).
 */
export async function promoteNextReady(
  roomId: string,
  eventId?: string | null,
): Promise<PromoteResult> {
  const active = await listActiveRequests(roomId, eventId);
  const decision = resolveStageDecision(active);
  switch (decision.kind) {
    case 'busy':
      return { outcome: 'already_playing', request: decision.playing };
    case 'empty':
      return { outcome: 'queue_empty' };
    case 'none_ready':
      return { outcome: 'blocked_not_ready', nextRequest: decision.firstWaiting };
    case 'promote': {
      const first = decision.request;
      const flip = await promoteRequestToPlaying(roomId, first.id);
      if (flip.outcome === 'ok') {
        const started = (await listActiveRequests(roomId, eventId)).find((r) => r.id === first.id);
        return { outcome: 'started', request: started ?? first };
      }
      if (flip.outcome === 'upgrade_required') {
        // AUTO-NEXT boundary (§8): the current song has ALREADY been closed by the
        // terminal transition upstream; the NEXT start is blocked and NOTHING was
        // opened (the RPC rolled back). The next request stays waiting/ready.
        return { outcome: 'upgrade_required', nextRequest: first, entitlement: flip.entitlement };
      }
      if (flip.outcome === 'duration_unavailable' || flip.outcome === 'pass_insufficient') {
        // BUILD 23 — the SAME auto-next boundary, for the two fail-closed admission blocks.
        // Identical guarantees to `upgrade_required`: the current song already completed, the
        // RPC rolled back, nothing was started, no lease was written, no handoff occurred, and
        // `first` stays `waiting` + Ready exactly where the server left it.
        //
        // These used to fall through to the catch-all below and be reported as "not ready", which
        // was the one thing they definitively were not — `first` was SELECTED because it is Ready.
        // Everything here is passthrough: this layer classifies nothing and defaults nothing, and
        // the conditional spread keeps an unclassified failure's key ABSENT rather than undefined.
        return {
          outcome: flip.outcome,
          nextRequest: first,
          ...admissionDetailOf(flip),
          ...(flip.durationFailureReason ? { durationFailureReason: flip.durationFailureReason } : {}),
        };
      }
      if (flip.outcome === 'already_playing') {
        const p = (await listActiveRequests(roomId, eventId)).find((r) => r.status === 'playing');
        return { outcome: 'already_playing', request: p };
      }
      // not_waiting / not_found → the queue changed under us (a concurrent promote/
      // reorder). Report "not ready to start"; a later lifecycle action re-drives it.
      return { outcome: 'blocked_not_ready', nextRequest: first };
    }
  }
}

export interface AdvanceResult {
  /** How the current song's terminal transition resolved. */
  terminal: FinishOutcome | 'skipped' | 'skip_failed';
  /** Whether the next Ready song auto-started (and which), or why not. */
  next: PromoteResult;
}

/**
 * V8 — the ONE seam every terminal transition uses (Finish, Skip). Complete or skip
 * the current playing song, then auto-start the next canonical song IF its guest is
 * Ready. Finish and Skip share this exact promotion path so they can never diverge.
 */
export async function advanceAfterTerminal(
  roomId: string,
  currentRequestId: string,
  terminal: 'completed' | 'skipped',
  eventId?: string | null,
): Promise<AdvanceResult> {
  let terminalOutcome: AdvanceResult['terminal'];
  if (terminal === 'completed') {
    terminalOutcome = (await finishOwnRequest(roomId, currentRequestId)).outcome;
  } else {
    const r = await setRequestStatus(roomId, currentRequestId, 'skip');
    terminalOutcome = r.outcome === 'ok' ? 'skipped' : 'skip_failed';
  }
  const next = await promoteNextReady(roomId, eventId);
  return { terminal: terminalOutcome, next };
}

/**
 * V8 pass-turn / "노래 끝". Admin-initiated: complete the current playing song and
 * auto-start the next canonical song when its guest is READY (V8 drops the earlier
 * "must also be TV-queued" requirement — Ready alone is the go signal). Delegates to
 * the shared advance + promote seam so Finish, Skip, and Ready-auto-start agree.
 */
export async function passTurnAndPromote(
  roomId: string,
  currentRequestId: string,
  eventId?: string | null,
): Promise<PassTurnResult> {
  const adv = await advanceAfterTerminal(roomId, currentRequestId, 'completed', eventId);
  const completed = adv.terminal === 'ok' || adv.terminal === 'already_done';
  if (adv.next.outcome === 'started') {
    return { completed, promoted: adv.next.request ?? null, reason: 'promoted' };
  }
  if (adv.next.outcome === 'upgrade_required') {
    // §8: current song closed exactly once; NEXT start blocked by the FREE limit. The
    // next request stays waiting/ready — no segment opened, no YouTube handoff.
    return { completed, promoted: null, reason: 'upgrade_required', entitlement: adv.next.entitlement };
  }
  if (adv.next.outcome === 'duration_unavailable' || adv.next.outcome === 'pass_insufficient') {
    // BUILD 23 — the same §8 boundary. `completed` stays TRUE: the current song genuinely
    // reached `completed`, and disowning that would invite a client to re-fire a terminal
    // mutation that already succeeded. Only the NEXT start was refused.
    return {
      completed,
      promoted: null,
      reason: adv.next.outcome,
      blocked: adv.next.nextRequest ?? null,
      ...admissionDetailOf(adv.next),
      ...(adv.next.durationFailureReason ? { durationFailureReason: adv.next.durationFailureReason } : {}),
    };
  }
  // Ready-only reasons: no next song, or the next guest hasn't Readied yet. BUILD 23 narrowed
  // what can reach here — an admission block is no longer disguised as a missing Ready signal —
  // but the meaning of these two reasons is otherwise unchanged.
  const reason: NoPromoteReason =
    adv.next.outcome === 'queue_empty' || adv.next.outcome === 'already_playing' ? 'no_next' : 'needs_ready';
  return { completed, promoted: null, reason };
}

/** Minimal ordering projection for canonicalRank. */
function order(r: KaraokeRequest): QueueOrderEntry {
  return { id: r.id, status: r.status, position: r.position, created_at: r.created_at };
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

/**
 * V8 — set / clear the Admin's "added to the YouTube TV queue" signal on a still-
 * `waiting` request. Admin-only (the route authorizes DJ/Admin, never a guest).
 * Mirrors setRequestReady: atomic + status-guarded so it never touches a playing
 * or finished row and never occupies the stage — the song stays `waiting`.
 */
export async function setRequestQueued(
  roomId: string,
  requestId: string,
  queued: boolean,
): Promise<{ outcome: ReadyOutcome }> {
  const db = karaokeDb();
  const { data, error } = await db
    .from('karaoke_requests')
    .update({ youtube_queued_at: queued ? new Date().toISOString() : null })
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

/**
 * Lyrics V1 — set / clear Admin-provided lyrics on a request. Room-scoped (the row
 * MUST belong to this room) but NOT status-guarded: the Admin adds lyrics to the
 * song already playing OR to any waiting song. The text is sanitized to bounded
 * plain text here (defense-in-depth beside the route's Zod bound); empty input
 * clears the lyrics back to 'unavailable'. `lyrics_source` is always 'admin' in
 * V1. Returns 'ok' or 'not_found' (a row in another room reads as not_found).
 */
export async function setRequestLyrics(
  roomId: string,
  requestId: string,
  rawLyrics: string | null | undefined,
): Promise<{ outcome: 'ok' | 'not_found' }> {
  const { text, status } = sanitizeLyrics(rawLyrics);
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .update({
      lyrics_text: text,
      lyrics_status: status,
      lyrics_source: text ? 'admin' : null,
      lyrics_source_url: null,
      lyrics_updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return { outcome: data ? 'ok' : 'not_found' };
}

// ── Public GUEST queue read model (BUILD 20M-SERVER-R3.1A) ─────────────────
// The ONE projection the public, unauthenticated guest request API returns.
//
// SECURITY. This endpoint previously returned the raw `karaoke_requests` row
// (`select('*')` handed straight to NextResponse.json), which shipped
// `idempotency_key`, `session_id` and `room_id` to any reader who knew the room
// slug. That made the BUILD 18B replay path an ownership oracle: harvest a
// victim's {idempotency_key, youtube_video_id, guest_name} from this response,
// POST that triple, get `replayed`, and the route signs a cancel capability for
// the victim's request — which the cancel and ready routes then accept.
//
// The fix is an ALLOWLIST BY CONSTRUCTION: every field is named explicitly
// below, so a column added to the table can never reach a guest without a
// deliberate edit here. The internal `KaraokeRequest` row stays private and is
// never returned directly — DJ/admin/display paths keep their own contracts.
// Fields are the measured union of what the native Guest app and the web guest
// actually read; nothing is carried over merely because it used to be present.

/** The public, Guest-safe shape of one queued request. NOT a database row. */
export interface GuestPublicRequest {
  id: string;
  guest_name: string;
  search_query: string | null;
  youtube_video_id: string;
  youtube_title: string | null;
  youtube_channel_title: string | null;
  position: number;
  status: RequestStatus;
  /** V6 ready-to-sing signal (null = not readied). */
  ready_at: string | null;
  /** The Event this request belongs to — the client scopes its own state by it. */
  event_id: string | null;
}

/**
 * Project an internal request row to the public Guest shape. Explicit field list
 * = the security boundary; never spread the row, never delete keys from it.
 *
 * Deliberately ABSENT (and must stay absent): idempotency_key (capability-recovery
 * material), session_id, room_id, and every lyrics_* / *_at lifecycle column no
 * guest client reads.
 */
export function toGuestPublicRequest(r: KaraokeRequest): GuestPublicRequest {
  return {
    id: r.id,
    guest_name: r.guest_name,
    search_query: r.search_query,
    youtube_video_id: r.youtube_video_id,
    youtube_title: r.youtube_title,
    youtube_channel_title: r.youtube_channel_title,
    position: r.position,
    status: r.status,
    ready_at: r.ready_at,
    event_id: r.event_id,
  };
}

// ── Public display / full-queue read model ─────────────────────────────────
// The single safe projection the iPad Display and the guest full-queue board
// both render. NEVER exposes session_id, dj_secret, the room UUID, or any
// credential — only what is already visible in the room (name, singer names,
// public YouTube ids, queue order).

function toDisplayRequest(r: KaraokeRequest, opts?: { withLyrics?: boolean }): DisplayRequest {
  // V1.3: normalize the song/artist for the human-first Display (strip karaoke / MR /
  // official-video noise). Falls back to the plain label when nothing usable survives.
  const norm = displaySong(r.youtube_title ?? r.search_query ?? '', r.youtube_channel_title);
  const base: DisplayRequest = {
    id: r.id,
    guestName: r.guest_name,
    title: requestDisplayTitle(r),
    artist: r.youtube_channel_title,
    songTitle: norm.song || requestDisplayTitle(r),
    songArtist: norm.artist,
    videoId: r.youtube_video_id,
    videoKind: classifyVideo(r.youtube_title ?? r.search_query ?? '', r.youtube_channel_title ?? ''),
    thumbnailUrl: r.youtube_thumbnail_url,
    status: r.status === 'playing' ? 'playing' : 'waiting',
    ready: r.ready_at != null,
  };
  // Lyrics ride only with the song on stage — the Display renders lyrics for the
  // playing request only, so waiting rows stay lean.
  if (opts?.withLyrics) base.lyrics = lyricsViewFor(r);
  return base;
}

/**
 * Build the public display state for a room from its canonical active queue.
 * `playing` is the song on stage (null when open); `waiting` is the ordered
 * line; `next` is the first waiting song. Order matches the canonical resolver.
 */
export async function getDisplayState(
  room: PublicRoom,
  eventId?: string | null,
): Promise<DisplayState> {
  const active = await listActiveRequests(room.id, eventId);
  const playingRow = active.find((r) => r.status === 'playing') ?? null;
  const waitingRows = active
    .filter((r) => r.status === 'waiting')
    .sort((a, b) =>
      canonicalRank(
        { id: a.id, status: a.status, position: a.position, created_at: a.created_at },
        { id: b.id, status: b.status, position: b.position, created_at: b.created_at },
      ),
    );
  const waiting = waitingRows.map((r) => toDisplayRequest(r));
  return {
    room: { name: room.display_name, slug: room.slug, open: room.status === 'open' },
    playing: playingRow ? toDisplayRequest(playingRow, { withLyrics: true }) : null,
    next: waiting[0] ?? null,
    waiting,
    waitingCount: waiting.length,
    stats: displayStatsFrom(await displayStatRows(room.id, eventId)),
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
async function displayStatRows(roomId: string, eventId?: string | null): Promise<StatRequest[]> {
  // V7.1: scope the LIVE stat panel to THIS Event's rows (never the room's whole
  // history). Legacy eventless rooms fall back to the room-wide scope unchanged.
  let q = karaokeDb().from('karaoke_requests').select('guest_name, status');
  q = eventId ? q.eq('event_id', eventId) : q.eq('room_id', roomId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StatRequest[];
}
