// BUILD 26U-R1 — the Premium Room route guard.
//
// SPLIT FROM `premium-room.server.ts` FOR ONE REASON: `events.server.ts` must call the
// session-start RPC, and this guard must call `endEvent`. Keeping both in one module would
// make those two files import each other. The RPC layer therefore has no dependencies, and
// everything that needs both lives here.

import { getCanonicalEvent, endEvent } from './events.server';
import { readRoomPremiumEntitlement } from './premium-room.server';
import type { PremiumRoomEntitlement } from '@/domain/premium-room';

/**
 * What the guard reports on the legacy contract. `entitled: false` is deliberate and load-
 * bearing: the legacy client is NOT entitled, it is merely not being asked. Anything that later
 * reads this value must not be able to mistake a compatibility window for a purchase.
 */
const LEGACY_FREE_ENTITLEMENT: PremiumRoomEntitlement = {
  entitled: false,
  source: 'NONE',
  basePlan: 'FREE',
  passGrantId: null,
  expiresAt: null,
  remainingSeconds: null,
  armable: false,
  effectiveWindowSeconds: null,
};

export type PremiumRoomGuard =
  | { ok: true; entitlement: PremiumRoomEntitlement }
  | { ok: false; code: 'PREMIUM_ROOM_EXPIRED' | 'PREMIUM_ROOM_REQUIRED'; endedEventId: string | null };

/**
 * THE guard every premium host operation calls, and the only place a session is ended for
 * running out of time.
 *
 * BEHAVIOUR WHEN TIME RUNS OUT (R1-F). The live Event is ended through the already-proven
 * `end_karaoke_event`, whose canonical close policy is exactly what is wanted: WAITING ->
 * removed, PLAYING -> skipped, event -> ended, the room is NOT closed, and **current media is
 * NOT stopped**. So BTY's coordination stops and the YouTube video the singer is watching
 * keeps playing, which is the entire point of the boundary.
 *
 * IT NEVER TOUCHES YOUTUBE. It opens nothing, closes nothing, and cannot convert a playback
 * action into a purchase gate, because no playback path calls it — asserted permanently by
 * the YT-3 invariant test.
 *
 * Ending is lazy and idempotent: `end_karaoke_event` is guarded on the event still being
 * live, so two concurrent guards end it once.
 */
export async function assertPremiumRoomSession(
  room: { id: string },
  // BUILD 26U-R2 — the release contract the server resolved for this caller. On 'legacy' the
  // guard asks NOTHING and ends NOTHING: a client that cannot be updated keeps the pre-R1
  // behaviour it was approved with. Defaulted to 'premium' so an un-migrated call site is
  // gated rather than silently free.
  contract: 'legacy' | 'premium' = 'premium',
): Promise<PremiumRoomGuard> {
  if (contract === 'legacy') {
    // The legacy contract is an ABSENCE of a question, not an entitlement. Nothing is read,
    // nothing is written, nothing is granted, and no session is ended for running out of a
    // time that this client was never told it was spending.
    return { ok: true, entitlement: LEGACY_FREE_ENTITLEMENT };
  }
  const entitlement = await readRoomPremiumEntitlement(room.id);
  if (entitlement.entitled) return { ok: true, entitlement };

  // Not entitled. If a session is still open, this is the moment it ends.
  const live = await getCanonicalEvent(room.id);
  if (!live) return { ok: false, code: 'PREMIUM_ROOM_REQUIRED', endedEventId: null };
  await endEvent(live.id);
  return { ok: false, code: 'PREMIUM_ROOM_EXPIRED', endedEventId: live.id };
}
