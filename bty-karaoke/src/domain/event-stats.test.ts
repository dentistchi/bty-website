import { describe, it, expect } from 'vitest';
import { computeEventStats, type StatRequest } from './event-stats';

const r = (guest_name: string, status: StatRequest['status']): StatRequest => ({ guest_name, status });

describe('computeEventStats', () => {
  it('counts distinct guests case- and whitespace-insensitively', () => {
    const rows = [r('Sarah', 'waiting'), r('  sarah ', 'completed'), r('Min', 'waiting')];
    expect(computeEventStats(rows).uniqueGuests).toBe(2);
  });

  it('buckets each status and totals every row', () => {
    const rows = [
      r('a', 'waiting'),
      r('b', 'waiting'),
      r('c', 'playing'),
      r('d', 'completed'),
      r('e', 'completed'),
      r('f', 'skipped'),
      r('g', 'removed'),
    ];
    const s = computeEventStats(rows);
    expect(s).toEqual({
      uniqueGuests: 7,
      totalRequests: 7,
      completed: 2,
      skipped: 1,
      waiting: 2,
      playing: 1,
    });
  });

  it('is empty-safe', () => {
    expect(computeEventStats([])).toEqual({
      uniqueGuests: 0,
      totalRequests: 0,
      completed: 0,
      skipped: 0,
      waiting: 0,
      playing: 0,
    });
  });
});
