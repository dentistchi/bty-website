import { describe, it, expect } from 'vitest';
import type { GuestQueueStatus } from './queue';
import {
  resolvePerfStage,
  arrivalTrigger,
  reconcileReady,
  type PerfStage,
} from './self-service';

function status(over: Partial<GuestQueueStatus> & { state: GuestQueueStatus['state'] }): GuestQueueStatus {
  return {
    requestId: over.requestId ?? 'r',
    state: over.state,
    position: over.position ?? 0,
    aheadCount: over.aheadCount ?? 0,
    isUpNext: over.isUpNext ?? false,
    isNowPlaying: over.isNowPlaying ?? false,
  };
}

describe('resolvePerfStage', () => {
  it('becomes my_turn when the request is up_next, the stage is open, and it is canonical-next', () => {
    const stage = resolvePerfStage({
      requestIds: ['a'],
      statuses: { a: status({ state: 'up_next', position: 1, isUpNext: true }) },
      stageOpen: true,
      nextId: 'a',
    });
    expect(stage).toEqual({ kind: 'my_turn', requestId: 'a' });
  });

  it('stays waiting (NOT my_turn) when up_next but the stage is occupied', () => {
    const stage = resolvePerfStage({
      requestIds: ['a'],
      statuses: { a: status({ state: 'up_next', position: 1, aheadCount: 0, isUpNext: true }) },
      stageOpen: false,
      nextId: null,
    });
    expect(stage.kind).toBe('waiting');
  });

  it('stays waiting when someone else is canonical-next', () => {
    const stage = resolvePerfStage({
      requestIds: ['a'],
      statuses: { a: status({ state: 'up_next', position: 1, isUpNext: true }) },
      stageOpen: true,
      nextId: 'someone-else',
    });
    expect(stage.kind).toBe('waiting');
  });

  it('reports the nearest waiting position with N songs ahead', () => {
    const stage = resolvePerfStage({
      requestIds: ['a', 'b'],
      statuses: {
        a: status({ state: 'waiting', position: 4, aheadCount: 3 }),
        b: status({ state: 'waiting', position: 6, aheadCount: 5 }),
      },
      stageOpen: false,
      nextId: null,
    });
    expect(stage).toEqual({ kind: 'waiting', requestId: 'a', aheadCount: 3, position: 4 });
  });

  it('prefers playing over every other stage (Finish surface wins)', () => {
    const stage = resolvePerfStage({
      requestIds: ['a', 'b'],
      statuses: {
        a: status({ state: 'now_playing', isNowPlaying: true }),
        b: status({ state: 'up_next', isUpNext: true }),
      },
      stageOpen: false,
      nextId: 'b',
    });
    expect(stage).toEqual({ kind: 'playing', requestId: 'a' });
  });

  it('is none when this device has no active requests (non-owner has no Finish/Start)', () => {
    const stage = resolvePerfStage({
      requestIds: ['a'],
      statuses: { a: status({ state: 'done' }) },
      stageOpen: true,
      nextId: 'someone-else',
    });
    expect(stage).toEqual({ kind: 'none' });
  });
});

describe('arrivalTrigger — the arrival effect fires exactly once per turn', () => {
  const myTurn: PerfStage = { kind: 'my_turn', requestId: 'a' };

  it('fires on first arrival then never again while polling the same my_turn', () => {
    let arrived: string | null = null;
    // First poll that observes my_turn → fires.
    const first = arrivalTrigger(arrived, myTurn);
    expect(first).toBe('a');
    arrived = first;
    // Subsequent polls with the SAME my_turn request → no re-fire.
    expect(arrivalTrigger(arrived, myTurn)).toBeNull();
    expect(arrivalTrigger(arrived, myTurn)).toBeNull();
    expect(arrivalTrigger(arrived, myTurn)).toBeNull();
  });

  it('does not fire for waiting/playing/none stages', () => {
    expect(arrivalTrigger(null, { kind: 'waiting', requestId: 'a', aheadCount: 2, position: 3 })).toBeNull();
    expect(arrivalTrigger(null, { kind: 'playing', requestId: 'a' })).toBeNull();
    expect(arrivalTrigger(null, { kind: 'none' })).toBeNull();
  });

  it('re-arms for a different song reaching my_turn', () => {
    expect(arrivalTrigger('a', { kind: 'my_turn', requestId: 'b' })).toBe('b');
  });
});

describe('reconcileReady — Ready is UI-local and reconciled against server truth', () => {
  it('keeps Ready while the same request is still my_turn', () => {
    expect(reconcileReady('a', { kind: 'my_turn', requestId: 'a' })).toBe('a');
  });

  it('drops Ready when the stage is no longer this guest’s turn (e.g. NOT_NEXT / someone else started)', () => {
    expect(reconcileReady('a', { kind: 'waiting', requestId: 'a', aheadCount: 1, position: 2 })).toBeNull();
    expect(reconcileReady('a', { kind: 'none' })).toBeNull();
    expect(reconcileReady('a', { kind: 'my_turn', requestId: 'b' })).toBeNull();
  });

  it('drops Ready once the song is playing (Ready never implies playing)', () => {
    expect(reconcileReady('a', { kind: 'playing', requestId: 'a' })).toBeNull();
  });
});
