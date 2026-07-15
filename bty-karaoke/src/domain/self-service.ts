// Pure self-service performance-stage model for the guest phone (V3). Derives
// ONE canonical "where am I in the performance flow" from the server-resolved
// per-request statuses + the room's stage state. No I/O, no side effects, no
// timers. The UI renders copy/buttons from this; it never recomputes ordering
// and never auto-advances the flow (Finish is always an explicit human action).

import type { GuestQueueStatus } from './queue';

export type PerfStage =
  // Nothing this guest can act on right now.
  | { kind: 'none' }
  // In line, but not their turn yet — show position ("N songs ahead").
  | { kind: 'waiting'; requestId: string; aheadCount: number; position: number }
  // First in the waiting line AND the stage is open → they may start.
  | { kind: 'my_turn'; requestId: string }
  // Their song is on stage right now → they may finish (never automatic).
  | { kind: 'playing'; requestId: string };

export interface PerfInput {
  /** The guest's own request ids (this device), newest-last is fine. */
  requestIds: readonly string[];
  /** Server-resolved status per request id. */
  statuses: Readonly<Record<string, GuestQueueStatus | undefined>>;
  /** From one /display read: is the stage open (no one singing)? null = unknown. */
  stageOpen: boolean | null;
  /** The canonical first-waiting request id from /display, or null. */
  nextId: string | null;
}

/**
 * Resolve the guest's performance stage. Priority:
 *   1. playing  — any own request on stage (Finish surface)
 *   2. my_turn  — own request is up_next AND stage is open AND it is canonical-next
 *   3. waiting  — nearest own waiting song (fewest ahead)
 *   4. none
 *
 * `my_turn` deliberately requires BOTH the per-request resolver (`up_next`) and
 * the room stage (`stageOpen` + `nextId`) to agree, so the Start affordance only
 * appears when the server would actually accept a Start. The server still
 * re-checks atomically — this just avoids offering a doomed button.
 */
export function resolvePerfStage(input: PerfInput): PerfStage {
  const { requestIds, statuses, stageOpen, nextId } = input;

  for (const id of requestIds) {
    if (statuses[id]?.state === 'now_playing') return { kind: 'playing', requestId: id };
  }

  for (const id of requestIds) {
    const s = statuses[id];
    if (s?.state === 'up_next' && stageOpen === true && (nextId == null || nextId === id)) {
      return { kind: 'my_turn', requestId: id };
    }
  }

  let best: { id: string; ahead: number; pos: number } | null = null;
  for (const id of requestIds) {
    const s = statuses[id];
    if (s && (s.state === 'waiting' || s.state === 'up_next')) {
      if (!best || s.aheadCount < best.ahead) best = { id, ahead: s.aheadCount, pos: s.position };
    }
  }
  if (best) {
    return { kind: 'waiting', requestId: best.id, aheadCount: best.ahead, position: best.pos };
  }

  return { kind: 'none' };
}

/**
 * The request id that should trigger the ONE-TIME "It's your turn" arrival effect
 * (a single haptic + a single flash), or null. Fires once per my_turn request:
 * repeated polling with the same my_turn request returns null. The caller records
 * the returned id and clears it whenever the stage leaves `my_turn`, so a later
 * turn (a second song, or after finishing) can arrive again.
 */
export function arrivalTrigger(prevArrivedId: string | null, stage: PerfStage): string | null {
  if (stage.kind !== 'my_turn') return null;
  if (stage.requestId === prevArrivedId) return null;
  return stage.requestId;
}

/**
 * Keep a UI-local "Ready" selection ONLY while the exact same request is still
 * this guest's turn. If the stage changed (someone else started, the song is now
 * playing, the guest is no longer next), the Ready step is dropped and the guest
 * falls back to the live stage. Ready is never server state — this reconciles the
 * local intent against fresh server truth on every poll.
 */
export function reconcileReady(readyId: string | null, stage: PerfStage): string | null {
  if (!readyId) return null;
  if (stage.kind === 'my_turn' && stage.requestId === readyId) return readyId;
  return null;
}
