import { describe, it, expect } from 'vitest';
import { planReorder, moveWithin, orderChanged, reconcileDecision, resolveVerticalOverId } from './reorder';

describe('reconcileDecision — drag optimistic-order settling (V5.1)', () => {
  it('confirms when the server order equals the optimistic order (no flash, no visual change)', () => {
    expect(reconcileDecision(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe('confirm');
  });
  it('HOLDS a stale pre-reorder poll (same songs, different order) so the drop never flashes back', () => {
    // Optimistic says [b,a,c]; a stale poll still shows the old [a,b,c] → hold.
    expect(reconcileDecision(['b', 'a', 'c'], ['a', 'b', 'c'])).toBe('hold');
  });
  it('reconciles once when the id SET changed (a song was added / removed / finished mid-drag)', () => {
    expect(reconcileDecision(['a', 'b'], ['a', 'b', 'c'])).toBe('reconcile'); // new arrival
    expect(reconcileDecision(['a', 'b', 'c'], ['a', 'b'])).toBe('reconcile'); // removed/finished
    expect(reconcileDecision(['a', 'b'], ['a', 'x'])).toBe('reconcile'); // swapped id
  });
  it('confirms an empty queue against an empty optimistic order', () => {
    expect(reconcileDecision([], [])).toBe('confirm');
  });
});

describe('planReorder', () => {
  const waiting = ['a', 'b', 'c', 'd']; // canonical order

  it('empty payload is a no-op', () => {
    expect(planReorder(waiting, [])).toEqual({ outcome: 'empty' });
  });

  it('reorders the full set exactly as requested', () => {
    expect(planReorder(waiting, ['c', 'a', 'b', 'd'])).toEqual({
      outcome: 'ok',
      finalOrder: ['c', 'a', 'b', 'd'],
    });
  });

  it('move-to-top: requested id leads, the rest keep canonical order', () => {
    // A "move d to top" from the DJ sends the whole intended order.
    expect(planReorder(waiting, ['d', 'a', 'b', 'c'])).toEqual({
      outcome: 'ok',
      finalOrder: ['d', 'a', 'b', 'c'],
    });
  });

  it('appends concurrently-arrived waiting songs at the tail (never lost)', () => {
    // DJ reordered a snapshot of [a,b,c]; meanwhile guest added 'e' → now waiting
    // is [a,b,c,e]. The DJ ordered [c,b,a]; 'e' must survive at the end.
    expect(planReorder(['a', 'b', 'c', 'e'], ['c', 'b', 'a'])).toEqual({
      outcome: 'ok',
      finalOrder: ['c', 'b', 'a', 'e'],
    });
  });

  it('keeps multiple new arrivals in canonical order at the tail', () => {
    expect(planReorder(['a', 'b', 'e', 'f'], ['b', 'a'])).toEqual({
      outcome: 'ok',
      finalOrder: ['b', 'a', 'e', 'f'],
    });
  });

  it('rejects duplicate ids in the payload', () => {
    expect(planReorder(waiting, ['a', 'a', 'b'])).toEqual({ outcome: 'invalid' });
  });

  it('reports queue_changed for an id that is no longer waiting (started/removed)', () => {
    // 'b' left the waiting set (e.g. started playing) after the DJ's snapshot.
    expect(planReorder(['a', 'c', 'd'], ['a', 'b', 'c'])).toEqual({ outcome: 'queue_changed' });
  });

  it('reports queue_changed for an unknown / cross-room id', () => {
    expect(planReorder(waiting, ['a', 'zzz'])).toEqual({ outcome: 'queue_changed' });
  });

  it('a partial payload of only current ids reorders just those, rest appended', () => {
    expect(planReorder(waiting, ['b', 'a'])).toEqual({
      outcome: 'ok',
      finalOrder: ['b', 'a', 'c', 'd'],
    });
  });
});

describe('moveWithin (drag drop semantics)', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves an item down to the drop target index', () => {
    expect(moveWithin(ids, 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up to the drop target index', () => {
    expect(moveWithin(ids, 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('move to the very top', () => {
    expect(moveWithin(ids, 'c', 'a')).toEqual(['c', 'a', 'b', 'd']);
  });

  it('a drop on itself is a no-op (returns the same order)', () => {
    expect(moveWithin(ids, 'b', 'b')).toEqual(ids);
  });

  it('unknown ids leave the order unchanged', () => {
    expect(moveWithin(ids, 'zzz', 'a')).toEqual(ids);
    expect(moveWithin(ids, 'a', 'zzz')).toEqual(ids);
  });
});

describe('orderChanged', () => {
  it('detects reorders and length changes; false when identical', () => {
    expect(orderChanged(['a', 'b'], ['a', 'b'])).toBe(false);
    expect(orderChanged(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(orderChanged(['a'], ['a', 'b'])).toBe(true);
  });
});

describe('resolveVerticalOverId — drag collision with hysteresis (V5.1.1)', () => {
  // Three rows, height ~70: centres at 50, 120, 190.
  const rows = [
    { id: 'a', center: 50 },
    { id: 'b', center: 120 },
    { id: 'c', center: 190 },
  ];

  it('picks the row whose centre is nearest the pointer (closest-centre)', () => {
    expect(resolveVerticalOverId({ pointerY: 52, candidates: rows })).toBe('a');
    expect(resolveVerticalOverId({ pointerY: 118, candidates: rows })).toBe('b');
    expect(resolveVerticalOverId({ pointerY: 188, candidates: rows })).toBe('c');
  });

  it('flips DOWNWARD stably once the pointer is clearly past the boundary', () => {
    // From 'a', pointer well into b's half (past midpoint 85 by > hysteresis).
    expect(resolveVerticalOverId({ pointerY: 100, candidates: rows, previousOverId: 'a' })).toBe('b');
  });

  it('flips UPWARD stably once the pointer is clearly past the boundary', () => {
    // From 'c', pointer well into b's half (midpoint 155).
    expect(resolveVerticalOverId({ pointerY: 140, candidates: rows, previousOverId: 'c' })).toBe('b');
  });

  it('does NOT toggle on a small wobble right at the boundary (hysteresis holds)', () => {
    // Midpoint a/b is 85. Just past it (86) the bare nearest is 'b', but the
    // hysteresis keeps the current 'a' until the pointer moves clearly further.
    expect(resolveVerticalOverId({ pointerY: 86, candidates: rows, previousOverId: 'a' })).toBe('a');
    expect(resolveVerticalOverId({ pointerY: 84, candidates: rows, previousOverId: 'a' })).toBe('a');
    // A tiny jitter around the boundary never flips back and forth.
    expect(resolveVerticalOverId({ pointerY: 88, candidates: rows, previousOverId: 'a' })).toBe('a');
  });

  it('returns null when there are no candidates', () => {
    expect(resolveVerticalOverId({ pointerY: 100, candidates: [] })).toBeNull();
  });
});
