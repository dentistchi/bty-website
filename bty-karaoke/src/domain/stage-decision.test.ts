// V8.1 — the pure stage-promotion decision. This is the rule that fixes the V8
// device-gate failure ("an un-ready singer blocks everyone behind them"): among the
// waiting songs, the promote target is the EARLIEST-position *Ready* one; an un-ready
// song never blocks a Ready song behind it. No I/O — exhaustive vectors here.

import { describe, it, expect } from 'vitest';
import { resolveStageDecision, type ReadyStageEntry } from './play-flow';

const req = (over: Partial<ReadyStageEntry> & { id: string }): ReadyStageEntry => ({
  status: 'waiting',
  position: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  ready_at: null,
  ...over,
});

const READY = '2026-01-01T00:05:00.000Z';

describe('resolveStageDecision — ready-first promotion', () => {
  it('#1 unready, #2 ready → promotes #2 (unready never blocks a ready song)', () => {
    const d = resolveStageDecision([
      req({ id: 'a', position: 1, ready_at: null }),
      req({ id: 'b', position: 2, ready_at: READY }),
    ]);
    expect(d.kind).toBe('promote');
    expect(d.kind === 'promote' && d.request.id).toBe('b');
  });

  it('#1 ready, #2 ready → promotes the EARLIER position (#1)', () => {
    const d = resolveStageDecision([
      req({ id: 'b', position: 2, ready_at: READY }),
      req({ id: 'a', position: 1, ready_at: READY }),
    ]);
    expect(d.kind === 'promote' && d.request.id).toBe('a');
  });

  it('a song already playing → busy (never interrupt it), even if a waiting song is ready', () => {
    const d = resolveStageDecision([
      req({ id: 'p', status: 'playing', position: 1 }),
      req({ id: 'a', position: 2, ready_at: READY }),
    ]);
    expect(d.kind).toBe('busy');
    expect(d.kind === 'busy' && d.playing.id).toBe('p');
  });

  it('after the playing song leaves, the earliest-position ready song is next (position stays authoritative)', () => {
    // #1 became ready while #2 was playing; #2 now gone. #1 (earlier position) is next.
    const d = resolveStageDecision([
      req({ id: 'a', position: 1, ready_at: READY }),
      req({ id: 'c', position: 3, ready_at: READY }),
    ]);
    expect(d.kind === 'promote' && d.request.id).toBe('a');
  });

  it('waiting songs exist but NONE ready → none_ready (nothing auto-starts)', () => {
    const d = resolveStageDecision([
      req({ id: 'a', position: 1, ready_at: null }),
      req({ id: 'b', position: 2, ready_at: null }),
    ]);
    expect(d.kind).toBe('none_ready');
    expect(d.kind === 'none_ready' && d.firstWaiting.id).toBe('a');
  });

  it('no waiting songs at all → empty', () => {
    expect(resolveStageDecision([]).kind).toBe('empty');
    expect(resolveStageDecision([req({ id: 'x', status: 'completed' })]).kind).toBe('empty');
  });

  it('completed/skipped/removed rows are ignored when choosing the next ready', () => {
    const d = resolveStageDecision([
      req({ id: 'done', status: 'completed', position: 1, ready_at: READY }),
      req({ id: 'skip', status: 'skipped', position: 2, ready_at: READY }),
      req({ id: 'live', position: 3, ready_at: READY }),
    ]);
    expect(d.kind === 'promote' && d.request.id).toBe('live');
  });
});
