// Server-only data access + orchestration for btyNorebang EVENTS. An event is the
// manager-facing unit that OWNS one room; it sits ON TOP of the existing room /
// session / queue / pairing engine and reuses it wholesale. Every write goes
// through the service-role client (browser never touches Supabase). The event
// row holds NO secret — the room master credential is generated, hashed, and
// discarded here; DJ authority is a reused one-use pairing token.

import { karaokeDb } from './supabase.server';
import { sha256Hex, randomToken } from './dj-auth.server';
import { mintPairingToken } from './pairing.server';
import { listActiveRequests } from './rooms.server';
import {
  publicCodeFromBytes,
  buildGuestSlug,
  eventRoomSlug,
} from '@/domain/event-code';
import { computeEventStats, type EventStats, type StatRequest } from '@/domain/event-stats';
import { selectLivePresence, type GuestLivePresence, type LiveRow } from '@/domain/live-presence';

export type EventStatus = 'draft' | 'active' | 'ended' | 'archived';

// Public event view — safe to return to the (authorized) manager UI. Mirrors the
// table minus nothing sensitive (the table has no secret columns by design).
export interface KaraokeEvent {
  id: string;
  room_id: string;
  name: string;
  host_name: string | null;
  public_code: string;
  guest_slug: string;
  status: EventStatus;
  starts_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const EVENT_COLS =
  'id, room_id, name, host_name, public_code, guest_slug, status, starts_at, ended_at, created_by, created_at, updated_at';

/** Manager-safe event projection (camelCase; drops room_id and never a secret). */
export function publicEvent(e: KaraokeEvent) {
  return {
    id: e.id,
    name: e.name,
    hostName: e.host_name,
    status: e.status,
    publicCode: e.public_code,
    guestSlug: e.guest_slug,
    startsAt: e.starts_at,
    endedAt: e.ended_at,
    createdAt: e.created_at,
  };
}

/** DJ connection summary for an event (from reused karaoke_dj_devices). */
export interface DjConnection {
  connected: boolean;
  label: string | null;
  lastUsedAt: string | null;
}

export interface EventSummary {
  event: KaraokeEvent;
  stats: EventStats;
  dj: DjConnection;
}

const CODE_RETRY = 6;

export interface CreateEventArgs {
  name: string;
  hostName?: string | null;
  createdBy?: string | null;
  startNow: boolean;
}

export interface CreatedEvent {
  event: KaraokeEvent;
  /** Internal room slug (never shown to guests; used for DJ/queue routes). */
  roomSlug: string;
}

/** Postgres unique-violation SQLSTATE — signals a code/slug collision to retry. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/**
 * Create an event and its owned room atomically (create_karaoke_event RPC), then
 * mint the room's DJ-enrollment pairing token. Retries with a fresh public code
 * on the rare code/slug collision. The raw room master credential is generated,
 * hashed for storage, and immediately discarded — no one keeps it.
 */
export async function createEvent(args: CreateEventArgs): Promise<CreatedEvent> {
  const db = karaokeDb();
  const name = args.name.trim();

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < CODE_RETRY; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const publicCode = publicCodeFromBytes(bytes);
    const roomSlug = eventRoomSlug(publicCode);
    const guestSlug = buildGuestSlug(name, publicCode);
    const djSecretHash = await sha256Hex(randomToken(24)); // raw master discarded

    const { data, error } = await db.rpc('create_karaoke_event', {
      p_room_slug: roomSlug,
      p_display_name: name,
      p_dj_secret_hash: djSecretHash,
      p_name: name,
      p_host_name: args.hostName?.trim() || null,
      p_public_code: publicCode,
      p_guest_slug: guestSlug,
      p_created_by: args.createdBy?.trim() || null,
      p_start_session: args.startNow,
    });

    if (error) {
      lastErr = error;
      if (isUniqueViolation(error)) continue; // collision — new code and retry
      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as { event_id: string; room_id: string };
    const event = await getEventById(row.event_id);
    if (!event) throw new Error('Event vanished immediately after creation');
    return { event, roomSlug };
  }
  throw lastErr ?? new Error('Could not allocate a unique event code');
}

/** Fetch one event by id (public view). */
export async function getEventById(eventId: string): Promise<KaraokeEvent | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_events')
    .select(EVENT_COLS)
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeEvent) ?? null;
}

/** The event that owns a room, if any (rooms created outside events return null). */
export async function getEventByRoomId(roomId: string): Promise<KaraokeEvent | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_events')
    .select(EVENT_COLS)
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeEvent) ?? null;
}

/** Resolve the guest-facing slug to its event (for the /j/[guestSlug] page). */
export async function getEventByGuestSlug(guestSlug: string): Promise<KaraokeEvent | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_events')
    .select(EVENT_COLS)
    .eq('guest_slug', guestSlug)
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeEvent) ?? null;
}

/** The room slug that owns an event (for building DJ/queue URLs). */
export async function eventRoomSlugOf(event: KaraokeEvent): Promise<string> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select('slug')
    .eq('id', event.room_id)
    .maybeSingle();
  if (error) throw error;
  return (data?.slug as string) ?? eventRoomSlug(event.public_code);
}

/** Stat rows (guest_name + status) for a set of rooms, in one query. */
async function statRowsForRooms(roomIds: string[]): Promise<Map<string, StatRequest[]>> {
  const byRoom = new Map<string, StatRequest[]>();
  roomIds.forEach((id) => byRoom.set(id, []));
  if (roomIds.length === 0) return byRoom;
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('room_id, guest_name, status')
    .in('room_id', roomIds);
  if (error) throw error;
  for (const r of (data ?? []) as Array<{ room_id: string } & StatRequest>) {
    byRoom.get(r.room_id)?.push({ guest_name: r.guest_name, status: r.status });
  }
  return byRoom;
}

/** DJ connection per room (active dj-role device = the enrolled iPad). */
async function djConnectionForRooms(roomIds: string[]): Promise<Map<string, DjConnection>> {
  const byRoom = new Map<string, DjConnection>();
  roomIds.forEach((id) => byRoom.set(id, { connected: false, label: null, lastUsedAt: null }));
  if (roomIds.length === 0) return byRoom;
  const { data, error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .select('room_id, label, last_used_at, status, role, created_at')
    .in('room_id', roomIds)
    .eq('role', 'dj')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  for (const d of (data ?? []) as Array<{
    room_id: string;
    label: string;
    last_used_at: string | null;
  }>) {
    const cur = byRoom.get(d.room_id);
    if (cur && !cur.connected) {
      byRoom.set(d.room_id, { connected: true, label: d.label, lastUsedAt: d.last_used_at });
    }
  }
  return byRoom;
}

/** Stats for a single event (event detail / DJ header). */
export async function eventStats(event: KaraokeEvent): Promise<EventStats> {
  const rows = (await statRowsForRooms([event.room_id])).get(event.room_id) ?? [];
  return computeEventStats(rows);
}

/** DJ connection for a single event. */
export async function eventDjConnection(event: KaraokeEvent): Promise<DjConnection> {
  return (
    (await djConnectionForRooms([event.room_id])).get(event.room_id) ?? {
      connected: false,
      label: null,
      lastUsedAt: null,
    }
  );
}

/**
 * The manager "tonight's events" list: newest first, each with stats + DJ status,
 * computed in a bounded number of queries (events + one requests + one devices).
 */
export async function listEventSummaries(limit = 50): Promise<EventSummary[]> {
  const { data, error } = await karaokeDb()
    .from('karaoke_events')
    .select(EVENT_COLS)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const events = (data as KaraokeEvent[]) ?? [];
  const roomIds = events.map((e) => e.room_id);
  const [stats, dj] = await Promise.all([
    statRowsForRooms(roomIds),
    djConnectionForRooms(roomIds),
  ]);
  return events.map((event) => ({
    event,
    stats: computeEventStats(stats.get(event.room_id) ?? []),
    dj: dj.get(event.room_id) ?? { connected: false, label: null, lastUsedAt: null },
  }));
}

/** Full summary for one event (detail screen). */
export async function getEventSummary(eventId: string): Promise<EventSummary | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  const [stats, dj] = await Promise.all([eventStats(event), eventDjConnection(event)]);
  return { event, stats, dj };
}

/**
 * End an event: mark it ended and end its active night (blocks new guest
 * requests; the queue/history is preserved). Idempotent. The room is NOT closed
 * and the current song is NOT stopped — only new requests are refused.
 */
export async function endEvent(eventId: string): Promise<KaraokeEvent | null> {
  const db = karaokeDb();
  const event = await getEventById(eventId);
  if (!event) return null;

  // End the active session for this room (mirrors sessions.server.endSession,
  // scoped by room so we don't need to import a second module boundary here).
  await db
    .from('karaoke_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('room_id', event.room_id)
    .eq('status', 'active');

  if (event.status === 'ended' || event.status === 'archived') return event;

  const { data, error } = await db
    .from('karaoke_events')
    // updated_at is stamped by the karaoke_events_touch_updated_at trigger.
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', eventId)
    .select(EVENT_COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeEvent) ?? event;
}

/**
 * The PUBLIC guest live-presence view for an event: identity + now-singing +
 * up-next + counts. No room_id / slug / credential / private identifier — only
 * what the guest screen renders. Two indexed queries (active rows + count rows);
 * no full-history detail fetch, no YouTube call. Reuses the canonical resolver
 * and the shared event-stats helper so the numbers agree everywhere.
 */
export async function getGuestLivePresenceByEvent(event: KaraokeEvent): Promise<GuestLivePresence> {
  const [active, statRows] = await Promise.all([
    listActiveRequests(event.room_id),
    statRowsForRooms([event.room_id]),
  ]);

  const liveRows: LiveRow[] = active.map((r) => ({
    id: r.id,
    status: r.status,
    position: r.position,
    created_at: r.created_at,
    started_at: r.started_at,
    guest_name: r.guest_name,
    youtube_title: r.youtube_title,
    search_query: r.search_query,
    youtube_video_id: r.youtube_video_id,
    youtube_thumbnail_url: r.youtube_thumbnail_url,
  }));

  const { nowPlaying, upNext } = selectLivePresence(liveRows);
  const stats = computeEventStats(statRows.get(event.room_id) ?? []);

  return {
    event: { name: event.name, hostName: event.host_name, status: event.status },
    nowPlaying,
    upNext,
    // counts.requests uses the shared computeEventStats.totalRequests definition
    // (all rows, removed included) so guest + manager numbers always agree.
    counts: { guests: stats.uniqueGuests, requests: stats.totalRequests, waiting: stats.waiting },
  };
}

export interface DjEnrollment {
  token: string;
  expiresAt: string;
}

/** Mint a fresh one-use DJ-enrollment token for the event's room (reused pairing). */
export async function mintDjEnrollment(event: KaraokeEvent): Promise<DjEnrollment> {
  const minted = await mintPairingToken({ roomId: event.room_id, role: 'dj', label: 'DJ iPad' });
  return { token: minted.token, expiresAt: minted.expiresAt };
}
