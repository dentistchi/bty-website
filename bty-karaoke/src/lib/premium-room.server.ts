// BUILD 26U-R1 — BTY Premium Room: THE server authority. One decision, many thin guards.
//
// R1-E asks for a single authoritative server decision that all clients project, rather than
// purchase checks scattered through UI components. This module is that decision. Routes call
// `assertPremiumRoomSession` (one line each) and never read a grant, a plan, or a catalog row
// themselves; the UI renders what a route returns and decides nothing.
//
// THE CHAIN, end to end, and every link is a server fact:
//
//     verified Apple purchase        karaoke_apple_purchases (VERIFIED)      — 26P / 26R-R2
//       -> fulfilled timed grant     fulfil_apple_purchase                   — 26S-R1
//       -> AVAILABLE / SELECTED      select_timed_access_pass                — BUILD 17
//       -> ACTIVE                    karaoke_start_premium_room_session      — 26U-R1  <-- here
//       -> active hosted Event       karaoke_events.status = 'active'
//       -> room capabilities         premiumRoomCapabilities(entitled)
//
// WHAT IS NOT IN THIS CHAIN, by construction: a QR code, a room code, a DJ pairing token, a
// device enrollment, a client-side StoreKit product, or anything a customer can type. QR and
// pairing DELEGATE authority over a room that is already authorized; entitlement is resolved
// from `karaoke_room_owner_account`, which no credential can influence.
//
// NO MEDIA DURATION IS READ HERE. There is no import of the duration resolver, no read of
// karaoke_video_durations, and no reference to a request's video. That absence is asserted by
// a permanent test rather than left to reviewer memory.

import { karaokeDb } from './supabase.server';
import {
  parsePremiumRoomEntitlement,
  type PremiumRoomEntitlement,
} from '@/domain/premium-room';

type Row = Record<string, unknown>;
const first = (data: unknown): unknown => (Array.isArray(data) ? data[0] : data);

/** Premium-room entitlement for a canonical account. Read-only; never sweeps, never grants. */
export async function readPremiumRoomEntitlement(accountId: string): Promise<PremiumRoomEntitlement> {
  const { data, error } = await karaokeDb().rpc('karaoke_premium_room_entitlement_at', {
    p_account_id: accountId,
    p_as_of: new Date().toISOString(),
  });
  if (error) throw error;
  return parsePremiumRoomEntitlement(first(data));
}

/** Premium-room entitlement for a ROOM, via its canonical owner account. Read-only. */
export async function readRoomPremiumEntitlement(roomId: string): Promise<PremiumRoomEntitlement> {
  const { data, error } = await karaokeDb().rpc('karaoke_room_premium_entitlement_at', {
    p_room_id: roomId,
    p_as_of: new Date().toISOString(),
  });
  if (error) throw error;
  return parsePremiumRoomEntitlement(first(data));
}

// ── The session-start authority ─────────────────────────────────────────────

export type StartPremiumRoomSessionResult =
  | { outcome: 'ok'; eventId: string; activated: boolean; expiresAt: string | null; source: string }
  | { outcome: 'already_live'; eventId: string }
  | { outcome: 'premium_room_required' }
  | { outcome: 'ownership_state_invalid' }
  | { outcome: 'room_retired' }
  | { outcome: 'room_not_found' }
  | { outcome: 'code_conflict' };

/**
 * One attempt at the atomic session-start transaction. The caller supplies the candidate
 * public code and guest slug so a collision can be retried with a FRESH code without the
 * transaction ever having activated anything — see the migration's write-order note.
 */
export async function startPremiumRoomSessionOnce(input: {
  roomId: string;
  name: string;
  publicCode: string;
  guestSlug: string;
  createdBy: string;
  /** BUILD 26U-R2 — 'legacy' skips the entitlement resolution AND the activation, inside the
   *  same transaction. Defaulted to 'premium' so an omission is gated, never free. */
  contract?: 'legacy' | 'premium';
}): Promise<StartPremiumRoomSessionResult> {
  const { data, error } = await karaokeDb().rpc('karaoke_start_premium_room_session', {
    p_room_id: input.roomId,
    p_name: input.name,
    p_public_code: input.publicCode,
    p_guest_slug: input.guestSlug,
    p_created_by: input.createdBy,
    p_contract: input.contract ?? 'premium',
  });
  if (error) throw error;
  const row = (first(data) ?? {}) as Row;
  const outcome = String(row.outcome ?? 'premium_room_required');
  switch (outcome) {
    case 'ok':
      return {
        outcome: 'ok',
        eventId: String(row.eventId),
        activated: row.activated === true,
        expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : null,
        source: String(row.source ?? 'NONE'),
      };
    case 'already_live':
      return { outcome: 'already_live', eventId: String(row.eventId) };
    case 'room_retired':
    case 'room_not_found':
    case 'ownership_state_invalid':
    case 'code_conflict':
      return { outcome } as StartPremiumRoomSessionResult;
    default:
      // Unknown future outcome must read as a refusal, never as permission.
      return { outcome: 'premium_room_required' };
  }
}
