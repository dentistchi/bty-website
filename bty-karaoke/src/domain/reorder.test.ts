import { describe, it, expect } from 'vitest';
import { planReorder, moveWithin, orderChanged } from './reorder';

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
