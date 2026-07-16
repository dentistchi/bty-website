// V8 Admin YouTube Queue Assist — pure decision vectors. These pin the auto-
// promotion rule (Ready AND Queued only), the Ready/Queued label matrix, and the
// reorder-drift detection that keeps BTY honest about the real TV queue.

import { describe, it, expect } from 'vitest';
import {
  queuePrepLabel,
  isAutoPromotable,
  noPromoteReason,
  preparedOrderDrifted,
} from './queue-assist';

const T = '2026-07-16T00:00:00Z';
const sig = (readyAt: string | null, youtubeQueuedAt: string | null, status = 'waiting') => ({
  status,
  readyAt,
  youtubeQueuedAt,
});

describe('queuePrepLabel', () => {
  it('ready_queued only when a WAITING song is both Ready and Queued', () => {
    expect(queuePrepLabel(sig(T, T))).toBe('ready_queued');
  });
  it('ready when Ready only', () => {
    expect(queuePrepLabel(sig(T, null))).toBe('ready');
  });
  it('queued when Queued only', () => {
    expect(queuePrepLabel(sig(null, T))).toBe('queued');
  });
  it('none when neither', () => {
    expect(queuePrepLabel(sig(null, null))).toBe('none');
  });
  it('none for a non-waiting song even if both signals are set', () => {
    expect(queuePrepLabel(sig(T, T, 'playing'))).toBe('none');
    expect(queuePrepLabel(sig(T, T, 'completed'))).toBe('none');
  });
});

describe('isAutoPromotable — pass-turn auto-start (Option B)', () => {
  it('true only when WAITING + Ready + Queued', () => {
    expect(isAutoPromotable(sig(T, T))).toBe(true);
  });
  it('false when Ready only (singer ready, not on the TV queue)', () => {
    expect(isAutoPromotable(sig(T, null))).toBe(false);
  });
  it('false when Queued only (on the TV queue, singer not ready)', () => {
    expect(isAutoPromotable(sig(null, T))).toBe(false);
  });
  it('false when neither, when non-waiting, and when there is no next song', () => {
    expect(isAutoPromotable(sig(null, null))).toBe(false);
    expect(isAutoPromotable(sig(T, T, 'playing'))).toBe(false);
    expect(isAutoPromotable(null)).toBe(false);
    expect(isAutoPromotable(undefined)).toBe(false);
  });
});

describe('noPromoteReason — the honest "why not" for the Admin', () => {
  it('no_next when there is no waiting next song', () => {
    expect(noPromoteReason(null)).toBe('no_next');
    expect(noPromoteReason(sig(T, T, 'playing'))).toBe('no_next');
  });
  it('needs_queued when Ready but not on the TV queue', () => {
    expect(noPromoteReason(sig(T, null))).toBe('needs_queued');
  });
  it('needs_ready when Queued but singer not ready', () => {
    expect(noPromoteReason(sig(null, T))).toBe('needs_ready');
  });
  it('needs_both when neither signal is set', () => {
    expect(noPromoteReason(sig(null, null))).toBe('needs_both');
  });
});

describe('preparedOrderDrifted — warn when queued songs are reordered', () => {
  it('true when two prepared songs swap relative order', () => {
    expect(preparedOrderDrifted(['a', 'b'], ['b', 'a', 'c'])).toBe(true);
  });
  it('false when the prepared songs keep their relative order (others move around)', () => {
    expect(preparedOrderDrifted(['a', 'b'], ['x', 'a', 'y', 'b'])).toBe(false);
  });
  it('false when a prepared song simply left the queue (played/removed) — not a reorder', () => {
    expect(preparedOrderDrifted(['a', 'b'], ['b', 'c'])).toBe(false);
  });
  it('false for an empty or single prepared set', () => {
    expect(preparedOrderDrifted([], ['a', 'b'])).toBe(false);
    expect(preparedOrderDrifted(['a'], ['x', 'a'])).toBe(false);
  });
});
