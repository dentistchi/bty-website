import { describe, expect, it } from 'vitest';
import {
  isValidTransition,
  nextPosition,
  positionInQueue,
  selectDjView,
  selectStage,
  newArrivals,
  canGuestCancel,
  resolveGuestStatus,
  type QueueOrderEntry,
} from './queue';

describe('nextPosition', () => {
  it('starts at 1 for an empty room', () => {
    expect(nextPosition([])).toBe(1);
  });

  it('appends after the highest existing position (not the count)', () => {
    expect(nextPosition([1, 2, 5])).toBe(6);
  });

  it('is stable against gaps from completed/removed rows', () => {
    expect(nextPosition([3])).toBe(4);
  });
});

describe('positionInQueue', () => {
  it('returns the 1-based slot within the sorted active queue', () => {
    expect(positionInQueue([2, 4, 7], 4)).toBe(2);
    expect(positionInQueue([2, 4, 7], 2)).toBe(1);
    expect(positionInQueue([2, 4, 7], 7)).toBe(3);
  });

  it('returns 0 when the request is not active', () => {
    expect(positionInQueue([2, 4, 7], 5)).toBe(0);
  });
});

describe('isValidTransition', () => {
  it('allows play only from waiting', () => {
    expect(isValidTransition('waiting', 'play')).toBe(true);
    expect(isValidTransition('playing', 'play')).toBe(false);
    expect(isValidTransition('completed', 'play')).toBe(false);
  });
  it('allows complete only from playing', () => {
    expect(isValidTransition('playing', 'complete')).toBe(true);
    expect(isValidTransition('waiting', 'complete')).toBe(false);
  });
  it('allows skip from waiting or playing but not terminal states', () => {
    expect(isValidTransition('waiting', 'skip')).toBe(true);
    expect(isValidTransition('playing', 'skip')).toBe(true);
    expect(isValidTransition('completed', 'skip')).toBe(false);
  });
});

describe('selectDjView', () => {
  it('picks the playing item as primary and the next waiting as up-next', () => {
    const view = selectDjView([
      { id: 'a', status: 'playing' },
      { id: 'b', status: 'waiting' },
      { id: 'c', status: 'waiting' },
    ]);
    expect(view.primary?.id).toBe('a');
    expect(view.upNext?.id).toBe('b');
    expect(view.rest.map((r) => r.id)).toEqual(['c']);
  });

  it('advances the displayed cards after a Complete removes the playing item', () => {
    // After 'a' completes it leaves the active set; 'b' is promoted to primary.
    const view = selectDjView([
      { id: 'b', status: 'waiting' },
      { id: 'c', status: 'waiting' },
    ]);
    expect(view.primary?.id).toBe('b');
    expect(view.upNext?.id).toBe('c');
  });

  it('uses the head of the waiting list as primary when nothing is playing', () => {
    const view = selectDjView([{ id: 'x', status: 'waiting' }]);
    expect(view.primary?.id).toBe('x');
    expect(view.upNext).toBeNull();
  });
});

describe('selectStage', () => {
  it('shows the playing song as current and the rest as the queue', () => {
    const s = selectStage([
      { id: 'a', status: 'playing' },
      { id: 'b', status: 'waiting' },
      { id: 'c', status: 'waiting' },
    ]);
    expect(s.current?.id).toBe('a');
    expect(s.queue.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('leaves the stage open (current null) when nothing is playing', () => {
    const s = selectStage([
      { id: 'b', status: 'waiting' },
      { id: 'c', status: 'waiting' },
    ]);
    expect(s.current).toBeNull();
    expect(s.queue.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('never auto-promotes a waiting song into the current slot', () => {
    const s = selectStage([{ id: 'x', status: 'waiting' }]);
    expect(s.current).toBeNull();
    expect(s.queue.map((r) => r.id)).toEqual(['x']);
  });
});

describe('newArrivals', () => {
  it('returns ids present now but not before', () => {
    expect(newArrivals(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
  });

  it('returns nothing when the snapshot is unchanged', () => {
    expect(newArrivals(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('ignores items that left the queue', () => {
    expect(newArrivals(['a', 'b', 'c'], ['b', 'c'])).toEqual([]);
  });

  it('treats every id as new against an empty previous snapshot', () => {
    expect(newArrivals([], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('resolveGuestStatus', () => {
  const entry = (
    id: string,
    status: QueueOrderEntry['status'],
    position: number,
    created_at = '2026-07-13T00:00:00.000Z',
  ): QueueOrderEntry => ({ id, status, position, created_at });

  it('reports the right position and aheadCount with multiple waiting songs', () => {
    const active = [entry('a', 'waiting', 1), entry('b', 'waiting', 2), entry('c', 'waiting', 3)];
    const s = resolveGuestStatus('c', active, 'waiting');
    expect(s.state).toBe('waiting');
    expect(s.aheadCount).toBe(2);
    expect(s.position).toBe(3);
    expect(s.isUpNext).toBe(false);
  });

  it('does NOT count the currently playing song as ahead in line', () => {
    // 'p' is on stage; the guest 'c' has only ONE waiting song ('b') ahead.
    const active = [entry('p', 'playing', 1), entry('b', 'waiting', 2), entry('c', 'waiting', 3)];
    const s = resolveGuestStatus('c', active, 'waiting');
    expect(s.aheadCount).toBe(1);
    expect(s.position).toBe(2);
    expect(s.isNowPlaying).toBe(false);
  });

  it('marks the request as up_next when it is first in the waiting line', () => {
    const active = [entry('p', 'playing', 1), entry('b', 'waiting', 2), entry('c', 'waiting', 3)];
    const s = resolveGuestStatus('b', active, 'waiting');
    expect(s.state).toBe('up_next');
    expect(s.isUpNext).toBe(true);
    expect(s.aheadCount).toBe(0);
    expect(s.position).toBe(1);
  });

  it('reports now_playing for the request on stage (not counted / no number)', () => {
    const active = [entry('p', 'playing', 1), entry('b', 'waiting', 2)];
    const s = resolveGuestStatus('p', active, 'playing');
    expect(s.state).toBe('now_playing');
    expect(s.isNowPlaying).toBe(true);
    expect(s.position).toBe(0);
    expect(s.aheadCount).toBe(0);
  });

  it('reports honest terminal states for completed / skipped / removed', () => {
    expect(resolveGuestStatus('x', [], 'completed').state).toBe('done');
    expect(resolveGuestStatus('x', [], 'skipped').state).toBe('removed');
    expect(resolveGuestStatus('x', [], 'removed').state).toBe('removed');
  });

  it('reports not_found for a request that no longer belongs to the room', () => {
    expect(resolveGuestStatus('x', [], null).state).toBe('not_found');
  });

  it('reflects a reorder: the same request moves position when the queue changes', () => {
    const before = [entry('a', 'waiting', 1), entry('b', 'waiting', 2)];
    expect(resolveGuestStatus('b', before, 'waiting').position).toBe(2);
    // DJ reorders so b's canonical position now precedes a.
    const after = [entry('a', 'waiting', 3), entry('b', 'waiting', 2)];
    expect(resolveGuestStatus('b', after, 'waiting').position).toBe(1);
  });

  it('breaks ties deterministically by created_at when positions collide', () => {
    const active = [
      entry('a', 'waiting', 1, '2026-07-13T00:00:02.000Z'),
      entry('b', 'waiting', 1, '2026-07-13T00:00:01.000Z'),
    ];
    // b was created first → ahead of a; a has exactly one waiting song ahead.
    expect(resolveGuestStatus('b', active, 'waiting').aheadCount).toBe(0);
    expect(resolveGuestStatus('a', active, 'waiting').aheadCount).toBe(1);
  });
});

describe('canGuestCancel', () => {
  it('allows cancel while waiting or up_next', () => {
    expect(canGuestCancel('waiting')).toBe(true);
    expect(canGuestCancel('up_next')).toBe(true);
  });
  it('forbids cancel once playing or terminal', () => {
    expect(canGuestCancel('now_playing')).toBe(false);
    expect(canGuestCancel('done')).toBe(false);
    expect(canGuestCancel('removed')).toBe(false);
    expect(canGuestCancel('not_found')).toBe(false);
  });
});
