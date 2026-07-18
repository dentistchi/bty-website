// QUEUE TRUTH V1 — the canonical state vocabulary every client groups from.
// Pins the guest resolver (Ready vs Not-Ready vs completed history vs removed) and
// the Admin remove transition guard, so Guest + Native Admin derive the same truth.

import { describe, it, expect } from 'vitest';
import { resolveGuestStatus, isValidTransition, type QueueOrderEntry } from './queue';
import { DjActionSchema } from '@/lib/validation';

const entry = (id: string, status: 'waiting' | 'playing', position: number): QueueOrderEntry => ({
  id,
  status,
  position,
  created_at: `2026-07-18T00:0${position}:00Z`,
});

describe('resolveGuestStatus — Ready / Not-Ready / playing / history', () => {
  const queue: QueueOrderEntry[] = [entry('p', 'playing', 0), entry('a', 'waiting', 1), entry('b', 'waiting', 2)];

  it('waiting + ready_at set → carries readyAt (Ready)', () => {
    const s = resolveGuestStatus('a', queue, 'waiting', '2026-07-18T00:05:00Z');
    expect(s.state === 'waiting' || s.state === 'up_next').toBe(true);
    expect(s.readyAt).toBe('2026-07-18T00:05:00Z');
  });

  it('waiting + ready_at null → readyAt null (Not-Ready)', () => {
    const s = resolveGuestStatus('b', queue, 'waiting', null);
    expect(s.readyAt).toBeNull();
  });

  it('playing → now_playing', () => {
    expect(resolveGuestStatus('p', queue, 'playing').state).toBe('now_playing');
  });

  it('completed → done (history, never active)', () => {
    const s = resolveGuestStatus('c', queue, 'completed');
    expect(s.state).toBe('done');
  });

  it('removed / skipped → removed (neither active nor history)', () => {
    expect(resolveGuestStatus('r', queue, 'removed').state).toBe('removed');
    expect(resolveGuestStatus('k', queue, 'skipped').state).toBe('removed');
  });

  it('unknown id → not_found', () => {
    expect(resolveGuestStatus('ghost', queue, null).state).toBe('not_found');
  });
});

describe('Admin remove — canonical transition (reused, no new contract)', () => {
  it('DjActionSchema accepts the existing "remove" action', () => {
    expect(DjActionSchema.safeParse({ action: 'remove' }).success).toBe(true);
  });

  it('a still-waiting song can be removed', () => {
    expect(isValidTransition('waiting', 'remove')).toBe(true);
  });

  it('a playing song can NEVER be removed (only the stage transitions complete/skip)', () => {
    expect(isValidTransition('playing', 'remove')).toBe(false);
  });

  it('completed / removed rows are not re-removable', () => {
    expect(isValidTransition('completed', 'remove')).toBe(false);
    expect(isValidTransition('removed', 'remove')).toBe(false);
  });
});
