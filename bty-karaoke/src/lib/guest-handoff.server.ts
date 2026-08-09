// Server-only Guest-to-App handoff service (BUILD 19B). Mints and resolves opaque,
// navigation-only handoffs. The RAW token is returned once on first creation and never
// stored — only its SHA-256 hash is persisted (same pattern as dj-auth pairing tokens).
// A handoff grants NO Host/Manager authority and mutates no request/Event/Room/pass/usage.

import { karaokeDb } from './supabase.server';
import { getPublicRoomBySlug } from './rooms.server';
import { sha256Hex, randomToken } from './dj-auth.server';
import {
  DEFAULT_HANDOFF_TTL_MS,
  handoffExpiry,
  resolveHandoffState,
  countsAsOpen,
  parseRoomNavIdentifier,
  roomNavHandoffMarker,
  type HandoffResolution,
} from '@/domain/guest-handoff';
import { getCanonicalEvent } from './events.server';

/** ≥128-bit opaque token. 24 bytes = 192 bits, base64url-ish via randomToken. */
const TOKEN_BYTES = 24;

export interface HandoffCreation {
  handoffId: string;
  expiresAt: string;
  /** Raw token — present ONLY on first creation; absent on an idempotent replay. */
  token?: string;
  replayed: boolean;
}

export type HandoffCreateResult =
  | { ok: true; creation: HandoffCreation }
  | { ok: false; code: 'ROOM_NOT_FOUND' | 'REQUEST_NOT_FOUND' | 'REQUEST_ROOM_MISMATCH' | 'EVENT_INVALID' };

export interface HandoffNav {
  handoffId: string;
  roomSlug: string;
  roomDisplayName: string;
  eventId: string;
  eventStatus: string;
  expiresAt: string;
}

export type HandoffResolveResult =
  | { resolution: 'active'; nav: HandoffNav }
  | { resolution: 'event_ended'; nav: HandoffNav }
  | { resolution: 'expired' }
  | { resolution: 'revoked' }
  | { resolution: 'invalid' };

function is23505(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

async function audit(
  db: ReturnType<typeof karaokeDb>,
  row: {
    handoff_id?: string | null;
    room_id?: string | null;
    event_id?: string | null;
    source_request_id?: string | null;
    event_type: string;
    result?: string | null;
    platform?: string | null;
  },
): Promise<void> {
  // Best-effort, privacy-clean. NEVER carries the raw token, guest name, or identity.
  try {
    await db.from('karaoke_guest_app_handoff_audit').insert(row);
  } catch {
    /* audit is best-effort — never blocks the operation */
  }
}

/**
 * Create (or idempotently return) the canonical handoff for a SUCCESSFUL guest request.
 * The request must exist, belong to the named Room, and carry a valid Event. Repeated
 * creation for the same request returns the SAME row — but the raw token is emitted only on
 * the first mint (hash-only storage; §9 "acceptable alternative"). No plaintext token is
 * ever stored, so there is no key-management/plaintext STOP.
 */
export async function createGuestAppHandoff(args: {
  roomSlug: string;
  requestId: string;
  nowMs?: number;
  ttlMs?: number;
}): Promise<HandoffCreateResult> {
  const db = karaokeDb();
  const now = args.nowMs ?? Date.now();

  const room = await getPublicRoomBySlug(args.roomSlug);
  if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };

  // Canonical server validation of the source request — client Room/Event ids are NOT trusted.
  const { data: reqRow } = await db
    .from('karaoke_requests')
    .select('id, room_id, event_id, session_id')
    .eq('id', args.requestId)
    .maybeSingle();
  if (!reqRow) return { ok: false, code: 'REQUEST_NOT_FOUND' };
  if (reqRow.room_id !== room.id) return { ok: false, code: 'REQUEST_ROOM_MISMATCH' };
  if (!reqRow.event_id) return { ok: false, code: 'EVENT_INVALID' };

  // The scoped Event must exist and belong to this Room (it need not still be active at
  // creation-read time, but a legacy eventless request cannot mint a handoff).
  const { data: ev } = await db
    .from('karaoke_events')
    .select('id, room_id, status')
    .eq('id', reqRow.event_id)
    .maybeSingle();
  if (!ev || ev.room_id !== room.id) return { ok: false, code: 'EVENT_INVALID' };

  // Idempotent: a handoff already exists for this request → return it WITHOUT a new raw token.
  const { data: existing } = await db
    .from('karaoke_guest_app_handoffs')
    .select('id, expires_at')
    .eq('source_request_id', reqRow.id)
    .maybeSingle();
  if (existing) {
    return { ok: true, creation: { handoffId: existing.id, expiresAt: existing.expires_at, replayed: true } };
  }

  const raw = randomToken(TOKEN_BYTES);
  const token_hash = await sha256Hex(raw);
  const expiresAt = new Date(handoffExpiry(now, args.ttlMs ?? DEFAULT_HANDOFF_TTL_MS)).toISOString();

  const { data: inserted, error } = await db
    .from('karaoke_guest_app_handoffs')
    .insert({
      token_hash,
      room_id: room.id,
      event_id: ev.id,
      source_request_id: reqRow.id,
      source_guest_session_id: reqRow.session_id ?? null,
      expires_at: expiresAt,
      status: 'ACTIVE',
    })
    .select('id, expires_at')
    .single();

  if (error) {
    // Concurrent create for the same request → the unique source_request_id collides; read
    // and return the winner (idempotent, no second raw token).
    if (is23505(error)) {
      const { data: winner } = await db
        .from('karaoke_guest_app_handoffs')
        .select('id, expires_at')
        .eq('source_request_id', reqRow.id)
        .maybeSingle();
      if (winner) return { ok: true, creation: { handoffId: winner.id, expiresAt: winner.expires_at, replayed: true } };
    }
    throw error;
  }

  await audit(db, {
    handoff_id: inserted.id,
    room_id: room.id,
    event_id: ev.id,
    source_request_id: reqRow.id,
    event_type: 'CREATED',
  });

  return { ok: true, creation: { handoffId: inserted.id, expiresAt: inserted.expires_at, token: raw, replayed: false } };
}

/**
 * Resolve a raw token to Guest-safe navigation data. Never returns Host/owner/session/pass
 * data. Invalid/expired/revoked are generic (no Room existence signal). Reopenable: a valid
 * open increments open_count and stamps first/last_opened_at. Lazy-expires a past-due ACTIVE
 * row to EXPIRED (server-time truth; no cron).
 */
export async function resolveGuestAppHandoff(rawToken: string, nowMs?: number): Promise<HandoffResolveResult> {
  const db = karaokeDb();
  const now = nowMs ?? Date.now();
  const token_hash = await sha256Hex(rawToken);

  const { data: row } = await db
    .from('karaoke_guest_app_handoffs')
    .select('id, room_id, event_id, expires_at, status, open_count')
    .eq('token_hash', token_hash)
    .maybeSingle();

  if (!row) {
    await audit(db, { event_type: 'INVALID', result: 'invalid' });
    return { resolution: 'invalid' };
  }

  const { data: ev } = await db
    .from('karaoke_events')
    .select('id, status')
    .eq('id', row.event_id)
    .maybeSingle();

  const resolution: HandoffResolution = resolveHandoffState(
    {
      handoffStatus: row.status,
      expiresAtMs: row.expires_at ? Date.parse(row.expires_at) : null,
      eventStatus: ev?.status ?? null,
    },
    now,
  );

  // Lazy expiry: flip a past-due ACTIVE row so its stored state matches server truth.
  if (resolution === 'expired' && row.status === 'ACTIVE') {
    await db.from('karaoke_guest_app_handoffs').update({ status: 'EXPIRED' }).eq('id', row.id).eq('status', 'ACTIVE');
    await audit(db, { handoff_id: row.id, room_id: row.room_id, event_id: row.event_id, event_type: 'EXPIRED', result: 'expired' });
    return { resolution: 'expired' };
  }
  if (resolution === 'revoked') return { resolution: 'revoked' };
  if (resolution === 'expired') return { resolution: 'expired' };

  // A genuine open (active or event_ended): count it and stamp timestamps (reopen-safe).
  if (countsAsOpen(resolution)) {
    const first = row.open_count === 0 ? { first_opened_at: new Date(now).toISOString() } : {};
    await db
      .from('karaoke_guest_app_handoffs')
      .update({ open_count: (row.open_count ?? 0) + 1, last_opened_at: new Date(now).toISOString(), ...first })
      .eq('id', row.id);
  }

  // Room display data for the nav payload (public, Guest-safe).
  const { data: room } = await db
    .from('karaoke_rooms')
    .select('slug, display_name')
    .eq('id', row.room_id)
    .maybeSingle();
  if (!room) return { resolution: 'invalid' };

  const nav: HandoffNav = {
    handoffId: row.id,
    roomSlug: room.slug,
    roomDisplayName: room.display_name,
    eventId: row.event_id,
    eventStatus: ev?.status ?? 'unknown',
    expiresAt: row.expires_at,
  };

  await audit(db, {
    handoff_id: row.id,
    room_id: row.room_id,
    event_id: row.event_id,
    event_type: resolution === 'active' ? 'RESOLVED' : 'OPENED',
    result: resolution,
  });

  return resolution === 'active' ? { resolution: 'active', nav } : { resolution: 'event_ended', nav };
}


// MARK: - BUILD 26H — ROOM-ONLY NAVIGATION (no handoff row, no writes)
//
// The request-backed handoff above is unchanged. This is the SECOND form: a Guest who has
// scanned a room QR opens the room in the app before entering a name or choosing a song.
//
// It is NAVIGATION, not admission. Everything it touches is a READ:
//   * no handoff row is created (the table's `source_request_id` is NOT NULL by design, and
//     BUILD 26H does not relax it, does not migrate, and does not fabricate a request);
//   * no open_count / first_opened_at / last_opened_at is stamped — that telemetry belongs to
//     a real request-backed handoff and simulating it would corrupt the funnel;
//   * no audit row is written, for the same reason;
//   * no request, queue, session, or admission write of any kind.
//
// The live Event is revalidated HERE, at resolve time — never trusted from the identifier or
// from whatever was live when the CTA rendered. A Guest who waits while the Host ends the
// event gets a safe refusal, not a stale room.

/**
 * Resolve a room-only navigation identifier to the SAME envelope Native already understands.
 *
 * Returns `invalid` for an unknown/retired room and for a room with no CURRENT live event —
 * one generic outcome, so this path reveals no more about room existence than the public
 * `/r/<slug>` page already does.
 */
export async function resolveRoomNavigation(identifier: string): Promise<HandoffResolveResult> {
  const slug = parseRoomNavIdentifier(identifier);
  if (!slug) return { resolution: 'invalid' };

  const room = await getPublicRoomBySlug(slug);
  // `getPublicRoomBySlug` already excludes what a Guest may not see; a retired/absent room is
  // indistinguishable from a bad identifier here.
  if (!room) return { resolution: 'invalid' };

  // CURRENT live event only. Never the latest ended event, never a previous one, never
  // synthesized — exactly the rule the public Guest page follows.
  const event = await getCanonicalEvent(room.id);
  if (!event || event.status !== 'active') return { resolution: 'invalid' };

  return {
    resolution: 'active',
    nav: {
      // Not a UUID and not a stored id: nothing was persisted, so there is nothing to identify.
      handoffId: roomNavHandoffMarker(room.slug),
      roomSlug: room.slug,
      roomDisplayName: room.display_name,
      eventId: event.id,
      eventStatus: event.status,
      // Room navigation does not expire on its own — it is re-validated on every open, which
      // is strictly stronger than a stored TTL. The field is reported for envelope
      // compatibility; Native decodes it and never acts on it.
      expiresAt: new Date(Date.now() + DEFAULT_HANDOFF_TTL_MS).toISOString(),
    },
  };
}
