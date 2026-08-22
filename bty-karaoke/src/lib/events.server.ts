// Server-only data access + orchestration for btyNorebang EVENTS. An event is the
// manager-facing unit that OWNS one room; it sits ON TOP of the existing room /
// session / queue / pairing engine and reuses it wholesale. Every write goes
// through the service-role client (browser never touches Supabase). The event
// row holds NO secret — the room master credential is generated, hashed, and
// discarded here; DJ authority is a reused one-use pairing token.

import { karaokeDb } from './supabase.server';
import { sha256Hex, randomToken } from './dj-auth.server';
import { mintPairingToken } from './pairing.server';
import { listActiveRequests, type KaraokeRequest } from './rooms.server';
// BUILD 26U-R1 — the atomic Premium Room session-start RPC. Imported from the dependency-free
// RPC layer (never from premium-room-guard.server.ts, which imports THIS module back).
import { startPremiumRoomSessionOnce } from './premium-room.server';
import {
  publicCodeFromBytes,
  buildGuestSlug,
  eventRoomSlug,
} from '@/domain/event-code';
import { computeEventStats, type EventStats, type StatRequest } from '@/domain/event-stats';
import {
  classifyEvent,
  compareForView,
  matchesView,
  showDjConnected,
  type EventClass,
  type EventView,
} from '@/domain/event-console';
import { selectLivePresence, type GuestLivePresence, type LiveRow } from '@/domain/live-presence';
import { decideEventAccess } from '@/domain/event-access';

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
  /**
   * BUILD R4E-R1 — read-only operator projection. Absent on the single-event detail path, which
   * has no cross-event context to classify against.
   */
  lastActivityAt?: string | null;
  eventClass?: EventClass;
  /** Whether the list may show a DJ badge for THIS event (see `showDjConnected`). */
  djLive?: boolean;
}

export interface EventListResult {
  events: EventSummary[];
  /** Computed over the whole window BEFORE any view filter, so the summary describes production. */
  totals: {
    active: number;
    stale: number;
    recent: number;
    ended: number;
    test: number;
    deleted: number;
    all: number;
  };
  /** The service's current management window — the page never claims to be all history. */
  window: { limit: number; returned: number };
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

const LIVE_EVENT_STATUSES = ['draft', 'active'] as const;

/**
 * THE single canonical resolver of "which live Event is this room's group" (V5).
 *
 * Resolves the room's ONE **live** Event (status draft|active). The partial unique
 * index `karaoke_events_one_live_per_room` guarantees at most one such row, so this
 * is a deterministic lookup — NOT a "latest event" / "first active session" /
 * "current session" recency inference (forbidden). Ended/archived Events are
 * history and never resolve here. Every operational screen (Admin / DJ / Display /
 * Guest) resolves through THIS function so all four share exactly one `event.id`.
 * Returns null for a room with no live Event (a legacy/self-service room, or a
 * room whose Admin has not yet opened the Hub) — callers treat null as "no event
 * bound" and behave exactly as V4.
 */
export async function getCanonicalEvent(roomId: string): Promise<KaraokeEvent | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_events')
    .select(EVENT_COLS)
    .eq('room_id', roomId)
    .in('status', LIVE_EVENT_STATUSES as unknown as string[])
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeEvent) ?? null;
}

/**
 * Insert ONE fresh live Event for a room, race-safe against the one-live-per-room
 * partial unique index (V7). Shared by ensure / bootstrap / startNewEvent — each
 * of which decides *whether* to create; this is the *how*. A concurrent insert or
 * a code collision surfaces as 23505: if a live event now exists it is the winner
 * (idempotent double-tap safety), otherwise the code collided → retry.
 */
async function createLiveEvent(roomId: string, name: string): Promise<KaraokeEvent> {
  const db = karaokeDb();
  const eventName = name.trim().slice(0, 80) || 'btyNorebang';
  for (let attempt = 0; attempt < CODE_RETRY; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const publicCode = publicCodeFromBytes(bytes);
    const guestSlug = buildGuestSlug(eventName, publicCode);
    const { data, error } = await db
      .from('karaoke_events')
      .insert({
        room_id: roomId,
        name: eventName,
        public_code: publicCode,
        guest_slug: guestSlug,
        status: 'active',
        starts_at: new Date().toISOString(),
        created_by: 'admin-hub',
      })
      .select(EVENT_COLS)
      .single();
    if (!error) return data as KaraokeEvent;
    if (isUniqueViolation(error)) {
      // Either a concurrent ensure won the one-live-per-room race, or a public
      // code / guest slug collided. If a live event now exists it's the winner;
      // otherwise it was a code collision — retry with a fresh code.
      const winner = await getCanonicalEvent(roomId);
      if (winner) return winner;
      continue;
    }
    throw error;
  }
  const winner = await getCanonicalEvent(roomId);
  if (winner) return winner;
  throw new Error('Could not ensure a canonical live event');
}

/**
 * V7 Event Lifecycle — the room's canonical live Event resolver used by every
 * PUBLIC / operational read. Same deterministic 1:1 lookup as getCanonicalEvent;
 * exported under the lifecycle name so lifecycle callers read intentionally.
 */
export const getCanonicalLiveEvent = getCanonicalEvent;

/** The room's most recently ended Event (for the ended summary shown to Admin /
 *  Guest / Display). Ordered by ended_at desc so a room with a history of rounds
 *  surfaces the round that just finished. Null if the room never ended an Event. */
export async function getLatestEndedEvent(roomId: string): Promise<KaraokeEvent | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_events')
    .select(EVENT_COLS)
    .eq('room_id', roomId)
    .eq('status', 'ended')
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeEvent) ?? null;
}

/**
 * Event Lifecycle V1 — explicit Event creation is the ONLY creation path.
 *
 * There is deliberately NO get-or-create / bootstrap / ensure helper in this module:
 * a room with zero Events stays at zero until an authenticated Host POSTs Start.
 * Every read path (Admin Hub GET, manager login, device-token restore, polling, QR
 * lookup, Guest page, Display) resolves through getCanonicalEvent / getLatestEnded
 * Event, which never write. See the zero-auto-create proof in
 * src/lib/events.no-autocreate.test.ts.
 *
 * V7 PART D — explicit Event rotation. Called ONLY from the authenticated Admin
 * "Start New Event" action (never Guest / QR / Display / polling). Idempotent and
 * double-tap safe: if a live Event already exists it is returned unchanged (the
 * one-live-per-room invariant is never violated); otherwise a brand-new Event with
 * a NEW id + NEW guest_slug (a NEW Guest QR) is created. The previous ended Event
 * is preserved as history and its Guest QR can never join this new Event.
 *
 * BUILD 26U-R1 — THIS IS NOW THE PREMIUM ROOM SESSION-START AUTHORITY, and the only
 * place a Timed Access Pass can start its clock.
 *
 * The unconditional `startNewEvent` it replaces is deliberately GONE rather than kept
 * alongside: an ungated way to open a hosted session would be an ungated way to obtain
 * the paid product, and leaving one in the module would make the boundary a convention
 * instead of a fact. Both callers (`/dj/start-event`, `/admin/start-event`) go through
 * here, and their auth boundaries are unchanged.
 *
 * WHY THE CODE IS GENERATED HERE AND THE DECISION IS MADE IN THE DATABASE. Entitlement
 * resolution, pass activation and the Event INSERT must share ONE transaction — otherwise
 * a crash between them either opens a session whose clock never started or spends a pass
 * on a session that never opened. But the public code and guest slug are pure client-side
 * derivations with a retry loop that predates all of this. So the loop stays here and the
 * candidate code is passed IN; the RPC does the atomic part and reports `code_conflict`
 * for a collision, having activated nothing.
 */
export type StartHostedSessionResult =
  | { ok: true; event: KaraokeEvent; activated: boolean; expiresAt: string | null; source: string }
  | { ok: false; code: 'PREMIUM_ROOM_REQUIRED' | 'ROOM_RETIRED' | 'ROOM_NOT_FOUND' | 'OWNERSHIP_STATE_INVALID' | 'START_FAILED' };

export async function startHostedRoomSession(
  roomId: string,
  name: string,
  createdBy = 'admin-hub',
  // BUILD 26U-R2 — which release contract the SERVER decided to project for this caller
  // (`@/lib/release-contract.server`). It is threaded through to the RPC rather than acted on
  // here, so the entitlement decision and the Event write stay in ONE transaction. Defaulting
  // to 'premium' means a caller that forgets to pass it gets the GATED behaviour, never the
  // free one — the safe direction for an omission.
  contract: 'legacy' | 'premium' = 'premium',
): Promise<StartHostedSessionResult> {
  const eventName = name.trim().slice(0, 80) || 'btyNorebang';
  for (let attempt = 0; attempt < CODE_RETRY; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const publicCode = publicCodeFromBytes(bytes);
    const guestSlug = buildGuestSlug(eventName, publicCode);
    const res = await startPremiumRoomSessionOnce({
      roomId,
      name: eventName,
      publicCode,
      guestSlug,
      createdBy,
      contract,
    });
    switch (res.outcome) {
      case 'ok': {
        const event = await getEventById(res.eventId);
        if (!event) return { ok: false, code: 'START_FAILED' };
        return { ok: true, event, activated: res.activated, expiresAt: res.expiresAt, source: res.source };
      }
      case 'already_live': {
        // Idempotent double-tap: the incumbent session is returned and NOTHING was
        // activated, so a second tap can never spend a second pass.
        const event = await getEventById(res.eventId);
        if (!event) return { ok: false, code: 'START_FAILED' };
        return { ok: true, event, activated: false, expiresAt: null, source: 'ALREADY_LIVE' };
      }
      case 'code_conflict':
        continue; // fresh code, retry — no grant was touched
      case 'premium_room_required':
        return { ok: false, code: 'PREMIUM_ROOM_REQUIRED' };
      case 'room_retired':
        return { ok: false, code: 'ROOM_RETIRED' };
      case 'room_not_found':
        return { ok: false, code: 'ROOM_NOT_FOUND' };
      case 'ownership_state_invalid':
        return { ok: false, code: 'OWNERSHIP_STATE_INVALID' };
    }
  }
  // Exhausted the code retries. A live event may have appeared meanwhile.
  const winner = await getCanonicalEvent(roomId);
  if (winner) return { ok: true, event: winner, activated: false, expiresAt: null, source: 'ALREADY_LIVE' };
  return { ok: false, code: 'START_FAILED' };
}

export type EventAccess =
  | { ok: true; event: KaraokeEvent | null }
  | { ok: false; status: 403 | 409; code: string; error: string };

/**
 * Validate that an operational caller may act on `room` under an OPTIONAL asserted
 * event id (from a URL or a signed capability). The single gate every route can
 * use so Admin / DJ / Display / Guest agree on exactly one live event:
 *
 *  - resolve the room's ONE canonical event (deterministic 1:1 — no inference);
 *  - if the caller asserts an eventId, it MUST equal the room's canonical event id
 *    → otherwise 403 (mismatch, and cross-room is a mismatch by construction since
 *    the canonical event for THIS room can never be a foreign event's id);
 *  - asserting an eventId for a room that has NO event → 403;
 *  - a canonical event that is ended/archived → 409 (honest "event has ended");
 *  - a legacy room with no asserted eventId → ok with event: null (V4 backward
 *    compatibility — the current self-service flow is untouched).
 */
export async function resolveEventAccess(
  room: { id: string },
  assertedEventId?: string | null,
): Promise<EventAccess> {
  // Resolve the live Event; if none is live, fall back to the most recent ended
  // Event so an ended round refuses honestly (409 EVENT_ENDED) instead of silently
  // behaving like a legacy eventless room (V7 PART I). A room that never had an
  // Event resolves to null → legacy self-service stays untouched.
  const event = (await getCanonicalEvent(room.id)) ?? (await getLatestEndedEvent(room.id));
  const decision = decideEventAccess(event, assertedEventId);
  if (!decision.ok) return decision;
  return { ok: true, event };
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

/**
 * The CANONICAL room slug that owns an event — the actual `karaoke_rooms.slug` for
 * `event.room_id`, or `null` when no such room exists. This is the ONLY correct way
 * to build a DJ / queue / Admin-Player URL for an event: an event's room may be a
 * pre-existing room (e.g. `bty-home`) whose slug is NOT `evt-<public_code>`, so
 * deriving the slug from the public code (`eventRoomSlug`) produces a dead route
 * ("Room not found"). Returns null rather than a fabricated slug so callers can
 * disable a button / show an honest state instead of linking somewhere broken.
 */
export async function eventRoomSlugOf(event: KaraokeEvent): Promise<string | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_rooms')
    .select('slug')
    .eq('id', event.room_id)
    .maybeSingle();
  if (error) throw error;
  return (data?.slug as string | undefined) ?? null;
}

/** Stat rows (guest_name + status) for a set of rooms, in one query. */
/**
 * V7.1 — event-scoped stat rows. Every LIVE-stat / ended-summary / event-detail
 * number is computed from EXACTLY the requests tagged with that event_id, so a
 * room's history across past Events never inflates a current or ended Event's
 * counts. Keyed by event id (not room id) so two Events in the same room stay
 * separate. Pre-V7.1 rows (event_id NULL) belong to no Event and are never counted.
 */
async function statRowsForEvents(eventIds: string[]): Promise<Map<string, StatRequest[]>> {
  const byEvent = new Map<string, StatRequest[]>();
  eventIds.forEach((id) => byEvent.set(id, []));
  if (eventIds.length === 0) return byEvent;
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('event_id, guest_name, status')
    .in('event_id', eventIds);
  if (error) throw error;
  for (const r of (data ?? []) as Array<{ event_id: string } & StatRequest>) {
    byEvent.get(r.event_id)?.push({ guest_name: r.guest_name, status: r.status });
  }
  return byEvent;
}

/** Event-scoped stats for ONE event id (V7.1) — the canonical counter for the
 *  LIVE panel, the DJ header, and the ended summary. */
export async function eventStatsById(eventId: string): Promise<EventStats> {
  const rows = (await statRowsForEvents([eventId])).get(eventId) ?? [];
  return computeEventStats(rows);
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
  // V7.1: scope to this event's rows (was room-wide, which summed all history).
  return eventStatsById(event.id);
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
 * The manager events list: each event with stats + DJ status, computed in a bounded number of
 * queries (events + one requests + one devices).
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
  // V7.1: stats keyed by EVENT id so two events in one room don't share a count.
  const [stats, dj] = await Promise.all([
    statRowsForEvents(events.map((e) => e.id)),
    djConnectionForRooms(roomIds),
  ]);
  return events.map((event) => ({
    event,
    stats: computeEventStats(stats.get(event.id) ?? []),
    dj: dj.get(event.room_id) ?? { connected: false, label: null, lastUsedAt: null },
  }));
}

/** Latest request instant per event — the strongest available "meaningful activity" signal. */
async function lastActivityByEvent(eventIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!eventIds.length) return out;
  const { data, error } = await karaokeDb()
    .from('karaoke_requests')
    .select('event_id, created_at')
    .in('event_id', eventIds);
  if (error) throw error;
  for (const r of (data ?? []) as Array<{ event_id: string; created_at: string }>) {
    const cur = out.get(r.event_id);
    if (!cur || r.created_at > cur) out.set(r.event_id, r.created_at);
  }
  return out;
}

/**
 * Rooms that are RETIRED, and rooms with NO owning account.
 *
 * Both are provenance facts the audit established and neither can be read off an event row:
 *   - retired  → BUILD 26E froze this room when its owner's account was deleted, so its events are
 *                deletion history, not live or defective rows.
 *   - ownerless → the room was created through the manager console before Host accounts existed,
 *                which is the only STRUCTURAL evidence of founder/engineering provenance. A name
 *                containing "Test" or "테스트" is not evidence and is never used here.
 */
async function roomProvenance(): Promise<{ retired: Set<string>; ownerless: Set<string> }> {
  const db = karaokeDb();
  const [rooms, ownership, members] = await Promise.all([
    db.from('karaoke_rooms').select('id, status'),
    db.from('karaoke_room_ownership').select('room_id, workspace_id'),
    db.from('karaoke_workspace_members').select('workspace_id, status'),
  ]);
  if (rooms.error) throw rooms.error;
  const retired = new Set<string>();
  for (const r of (rooms.data ?? []) as Array<{ id: string; status: string }>) {
    if (r.status === 'retired') retired.add(r.id);
  }
  const ownedWorkspaces = new Set(
    ((members.data ?? []) as Array<{ workspace_id: string; status: string }>)
      .filter((m) => m.status === 'active')
      .map((m) => m.workspace_id),
  );
  const owned = new Set(
    ((ownership.data ?? []) as Array<{ room_id: string; workspace_id: string }>)
      .filter((o) => ownedWorkspaces.has(o.workspace_id))
      .map((o) => o.room_id),
  );
  const ownerless = new Set<string>();
  for (const r of (rooms.data ?? []) as Array<{ id: string }>) {
    if (!owned.has(r.id)) ownerless.add(r.id);
  }
  return { retired, ownerless };
}

/**
 * BUILD R4E-R1 — the operator list: classified, counted and ordered, still strictly read-only.
 *
 * `nowMs` is a parameter so the classification is deterministic under test; production passes the
 * real clock. Totals are computed over the whole window BEFORE the view filter, so the summary
 * always describes production rather than whatever tab is open.
 */
export async function listEventConsole(
  params: { view?: EventView; limit?: number; nowMs?: number } = {},
): Promise<EventListResult> {
  const limit = params.limit ?? 50;
  const nowMs = params.nowMs ?? Date.now();
  const base = await listEventSummaries(limit);
  const [activity, prov] = await Promise.all([
    lastActivityByEvent(base.map((s) => s.event.id)),
    roomProvenance(),
  ]);

  const rows = base.map((s) => {
    // Strongest signal first: a real request. Falling back to the event's own start/creation means
    // a never-used event is measured from when it was made, which is exactly the age an operator
    // needs to see for a month-old empty "active" event.
    const lastActivityAt =
      activity.get(s.event.id) ?? s.event.starts_at ?? s.event.created_at ?? null;
    const eventClass = classifyEvent(
      {
        status: s.event.status,
        lastActivityAt,
        endedAt: s.event.ended_at,
        roomRetired: prov.retired.has(s.event.room_id),
        provenTest: prov.ownerless.has(s.event.room_id),
      },
      nowMs,
    );
    return {
      ...s,
      lastActivityAt,
      eventClass,
      djLive: showDjConnected(eventClass, s.dj.connected, s.dj.lastUsedAt, nowMs),
    };
  });

  const count = (c: EventClass) => rows.filter((r) => r.eventClass === c).length;
  const totals = {
    active: count('ACTIVE'),
    stale: count('STALE'),
    recent: count('RECENT'),
    ended: count('ENDED'),
    test: count('TEST'),
    deleted: count('DELETED_ARCHIVED'),
    all: rows.length,
  };

  const view: EventView = params.view ?? 'active';
  const events = rows
    .filter((r) => matchesView(view, r.eventClass))
    .sort((a, b) =>
      compareForView(
        view,
        { cls: a.eventClass, lastActivityAt: a.lastActivityAt, endedAt: a.event.ended_at, createdAt: a.event.created_at },
        { cls: b.eventClass, lastActivityAt: b.lastActivityAt, endedAt: b.event.ended_at, createdAt: b.event.created_at },
      ),
    );

  return { events, totals, window: { limit, returned: rows.length } };
}

/** Full summary for one event (detail screen). */
export async function getEventSummary(eventId: string): Promise<EventSummary | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  const [stats, dj] = await Promise.all([eventStats(event), eventDjConnection(event)]);
  return { event, stats, dj };
}

/** The honest ended summary (Event Lifecycle V1). `completedCount` = songs the DJ
 *  actually finished for this event (immutable history). `unfinishedClosedCount` =
 *  rows THIS end closed without completing them (waiting→removed + playing→skipped).
 *  A repeated (idempotent) end reports completedCount for the already-ended event
 *  and unfinishedClosedCount = 0. */
export interface EndEventSummary {
  completedCount: number;
  unfinishedClosedCount: number;
}

export interface EndedEvent {
  event: KaraokeEvent;
  summary: EndEventSummary;
}

/** The single jsonb object `end_karaoke_event` returns (null when no such event).
 *  It deliberately has NO OUT parameters — see the 20260719130000 migration: OUT
 *  params named after real columns made every UPDATE in the function ambiguous. */
interface EndEventRpcRow {
  eventId: string;
  status: EventStatus;
  endedAt: string | null;
  completedCount: number | string | null;
  unfinishedClosedCount: number | string | null;
}

/**
 * End an event: mark it ended and end its active night (blocks new guest
 * requests; the queue/history is preserved). ATOMIC + idempotent via the
 * `end_karaoke_event` RPC — the whole live queue is closed as one unit so a
 * partial failure can never leave a `playing` row open under an `ended` event.
 * Canonical close policy (see the migration): WAITING→removed, PLAYING→skipped
 * (unfinished, never `completed`), ready_at/youtube_queued_at cleared, history
 * untouched. The room is NOT closed and current media is NOT stopped. Returns the
 * ended event plus the honest summary, or null when the event does not exist.
 */
export async function endEvent(eventId: string): Promise<EndedEvent | null> {
  const db = karaokeDb();
  const { data, error } = await db.rpc('end_karaoke_event', { p_event_id: eventId });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as EndEventRpcRow | null | undefined;
  if (!row) return null; // event not found

  const event = await getEventById(eventId);
  if (!event) return null;

  return {
    event,
    summary: {
      completedCount: Number(row.completedCount ?? 0) || 0,
      unfinishedClosedCount: Number(row.unfinishedClosedCount ?? 0) || 0,
    },
  };
}

/**
 * The PUBLIC guest live-presence view for an event: identity + now-singing +
 * up-next + counts. No room_id / slug / credential / private identifier — only
 * what the guest screen renders. Two indexed queries (active rows + count rows);
 * no full-history detail fetch, no YouTube call. Reuses the canonical resolver
 * and the shared event-stats helper so the numbers agree everywhere.
 */
function toLiveRow(r: KaraokeRequest): LiveRow {
  return {
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
    // R6 §E/§K — a SEPARATE axis from `status`. The lifecycle fact is untouched; this says only
    // whether the YouTube content behind the row can still be played.
    youtube_unavailable: r.youtube_metadata_unavailable_at != null,
  };
}

export async function getGuestLivePresenceByEvent(event: KaraokeEvent): Promise<GuestLivePresence> {
  // V7.1: queue + counts scoped to THIS event id (was room-wide history).
  const [active, statRows] = await Promise.all([
    listActiveRequests(event.room_id, event.id),
    statRowsForEvents([event.id]),
  ]);

  const { nowPlaying, upNext } = selectLivePresence(active.map(toLiveRow));
  const stats = computeEventStats(statRows.get(event.id) ?? []);

  return {
    event: { name: event.name, hostName: event.host_name, status: event.status },
    nowPlaying,
    upNext,
    // counts.requests uses the shared computeEventStats.totalRequests definition
    // (all rows, removed included) so guest + manager numbers always agree.
    counts: { guests: stats.uniqueGuests, requests: stats.totalRequests, waiting: stats.waiting },
  };
}

/** Compact event status for the DJ's Event Status sheet (reuses the same helpers
 *  as the guest presence + manager stats, so nothing is recomputed in the UI). */
export interface DjEventStatus {
  name: string;
  startsAt: string | null;
  endedAt: string | null;
  status: EventStatus;
  counts: { guests: number; requests: number; completed: number; waiting: number; skipped: number };
  nowPlaying: { title: string; guestName: string } | null;
  upNext: { title: string; guestName: string } | null;
}

/**
 * Event status for the room a DJ is authorized on, or null when the room is a
 * legacy non-event room (so the DJ header/sheet stay unchanged there). Two indexed
 * queries; reuses computeEventStats + selectLivePresence.
 */
export async function getEventStatusForRoom(roomId: string): Promise<DjEventStatus | null> {
  // V7 PART K: resolve the ONE live Event, or (post-End, before rotation) the most
  // recent ended Event. NEVER an all-status maybeSingle — once a room has both an
  // ended and a live Event (after Start New Event) that would match >1 row and throw.
  const event = (await getCanonicalEvent(roomId)) ?? (await getLatestEndedEvent(roomId));
  if (!event) return null;

  // V7.1: queue + counts scoped to THIS event id — the DJ/Admin header no longer
  // sums the room's whole history (that was the 8명·60곡 pollution).
  const [active, statRows] = await Promise.all([
    listActiveRequests(roomId, event.id),
    statRowsForEvents([event.id]),
  ]);
  const stats = computeEventStats(statRows.get(event.id) ?? []);
  const { nowPlaying, upNext } = selectLivePresence(active.map(toLiveRow));

  return {
    name: event.name,
    startsAt: event.starts_at,
    endedAt: event.ended_at,
    status: event.status,
    counts: {
      guests: stats.uniqueGuests,
      requests: stats.totalRequests,
      completed: stats.completed,
      waiting: stats.waiting,
      skipped: stats.skipped,
    },
    nowPlaying: nowPlaying ? { title: nowPlaying.title, guestName: nowPlaying.guestName } : null,
    upNext: upNext ? { title: upNext.title, guestName: upNext.guestName } : null,
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
