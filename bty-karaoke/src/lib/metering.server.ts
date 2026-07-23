// Daily FREE Karaoke Minutes — B1 shadow metering seam.
//
// The SINGLE place the app calls the atomic song-lifecycle RPCs. Every NOW-SINGING
// start and every terminal transition flows through here so the request status flip and
// its usage segment are written together in ONE server transaction (see
// DRAFT_B1_karaoke_shadow_metering.sql). There are NO app-level writes to
// 'playing'/'completed'/'skipped' anywhere else. enforcement_enabled=false in B1: the
// RPCs record segments but never block a start and never surface a countdown.

import { karaokeDb } from './supabase.server';

/** karaoke_begin_song outcomes (superset; callers map to their own result types). */
export type BeginOutcome =
  | 'ok'
  | 'invalid_mode'
  | 'ownership_state_invalid'
  | 'not_found'
  | 'not_waiting'
  | 'event_state_invalid'
  | 'already_playing'
  | 'not_next'
  | 'not_ready'
  | 'request_state_changed'
  | 'upgrade_required'
  | 'shadow_metering_error';

/** karaoke_end_song outcomes. */
export type EndOutcome =
  | 'ok'
  | 'already_done'
  | 'recovered'
  | 'not_found'
  | 'not_playing'
  | 'request_state_changed'
  | 'ownership_state_invalid'
  | 'invalid_action';

export interface BeginResult {
  outcome: BeginOutcome;
  entitlement?: unknown;
}
export interface EndResult {
  outcome: EndOutcome;
  segmentClosed?: boolean;
  shadowAnomaly?: 'none' | 'segment_missing';
  entitlement?: unknown;
}

type Row = Record<string, unknown>;
const first = (data: unknown): Row => (Array.isArray(data) ? (data[0] as Row) : (data as Row)) ?? {};

/**
 * Atomically flip a WAITING request to NOW SINGING and open its usage segment.
 * mode 'guest' requires the canonical first-waiting song; 'promote' requires the
 * canonical first-READY waiting song (event-scoped). The whole thing is one DB
 * transaction — a segment conflict rolls the flip back (fail-closed).
 */
export async function beginSong(
  roomId: string,
  requestId: string,
  mode: 'guest' | 'promote',
): Promise<BeginResult> {
  const { data, error } = await karaokeDb().rpc('karaoke_begin_song', {
    p_room_id: roomId,
    p_request_id: requestId,
    p_mode: mode,
  });
  if (error) throw error;
  const row = first(data);
  return { outcome: String(row.outcome ?? 'shadow_metering_error') as BeginOutcome, entitlement: row.entitlement };
}

/**
 * Atomically move a PLAYING request out of NOW SINGING and close its usage segment.
 * action derives status + close_reason in the DB ('complete'→completed, 'skip'→skipped,
 * 'pass'→skipped/passed, 'replace'→skipped/replaced). Pass-turn wires to 'complete'.
 */
export async function endSong(
  roomId: string,
  requestId: string,
  action: 'complete' | 'skip' | 'pass' | 'replace',
): Promise<EndResult> {
  const { data, error } = await karaokeDb().rpc('karaoke_end_song', {
    p_room_id: roomId,
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw error;
  const row = first(data);
  return {
    outcome: String(row.outcome ?? 'request_state_changed') as EndOutcome,
    segmentClosed: row.segmentClosed as boolean | undefined,
    shadowAnomaly: row.shadowAnomaly as EndResult['shadowAnomaly'],
    entitlement: row.entitlement,
  };
}

/** Canonical entitlement snapshot for an account (real-time wrapper). B2: read by the
 *  usage projection endpoint and returned on a blocked start. Never mutates. */
export async function readEntitlement(accountId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await karaokeDb().rpc('karaoke_free_minutes_entitlement', { p_account_id: accountId });
  if (error) throw error;
  return (first(data) as Record<string, unknown>) ?? null;
}

/**
 * Resolve the single active owner account for a room (or null when ownership is
 * ambiguous/absent — exactly the same rule the atomic RPCs lock on). Read-only.
 * Used by the usage projection endpoint to scope account-level entitlement from a
 * room-scoped DJ credential.
 */
export async function roomOwnerAccountId(roomId: string): Promise<string | null> {
  const { data, error } = await karaokeDb().rpc('karaoke_room_owner_account', { p_room_id: roomId });
  if (error) throw error;
  const v = Array.isArray(data) ? data[0] : data;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Canonical usage snapshot for the OWNER of a room. Convenience wrapper the room-
 * scoped usage endpoint uses: room → owner account → entitlement. Returns null when
 * the room has no unambiguous active owner.
 */
export async function readRoomEntitlement(roomId: string): Promise<Record<string, unknown> | null> {
  const accountId = await roomOwnerAccountId(roomId);
  if (!accountId) return null;
  return readEntitlement(accountId);
}

/** One-time browser timezone capture (atomic; eligible only while source='default' + zero usage). */
export async function captureAccountTimezone(accountId: string, timezone: string): Promise<{ outcome: string }> {
  const { data, error } = await karaokeDb().rpc('capture_karaoke_account_timezone', {
    p_account_id: accountId,
    p_timezone: timezone,
  });
  if (error) throw error;
  return { outcome: String(first(data).outcome ?? 'account_not_found') };
}
