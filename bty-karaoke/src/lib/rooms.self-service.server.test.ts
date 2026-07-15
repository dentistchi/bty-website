// Self-service server helpers. The full atomic guarantees (start collision →
// exactly one winner, single stage per room) live in the advisory-locked
// `start_karaoke_request` RPC + the partial unique index, and are exercised at
// the DB / device-gate level (not unit-testable without live Postgres). Here we
// pin the OUTCOME MAPPING that the app relies on around that RPC and the atomic
// finish update.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
// A tiny chainable query-builder mock whose terminal call resolves `next`.
const finishResult = { data: null as null | { id: string }, error: null as unknown };
const orderRow = { data: null as null | { status: string }, error: null as unknown };

function chain(terminal: () => unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'update', 'select', 'eq', 'in', 'order']) b[m] = () => b;
  b.maybeSingle = async () => terminal();
  b.single = async () => terminal();
  return b;
}

let mode: 'finishUpdate' | 'orderFields' = 'finishUpdate';
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc,
    from: () =>
      chain(() => (mode === 'finishUpdate' ? finishResult : orderRow)),
  }),
}));

import { startOwnRequest, finishOwnRequest } from './rooms.server';

beforeEach(() => {
  rpc.mockReset();
  finishResult.data = null;
  orderRow.data = null;
});

describe('startOwnRequest — RPC outcome mapping', () => {
  for (const outcome of ['not_found', 'not_waiting', 'not_next', 'already_playing'] as const) {
    it(`passes '${outcome}' straight through (no queue read on failure)`, async () => {
      rpc.mockResolvedValueOnce({ data: outcome, error: null });
      const res = await startOwnRequest('room-1', 'req-1');
      expect(res.outcome).toBe(outcome);
      expect(res.request).toBeUndefined();
    });
  }

  it('throws if the RPC errors (surfaced, never a silent no-op)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(startOwnRequest('room-1', 'req-1')).rejects.toThrow('boom');
  });
});

describe('finishOwnRequest — atomic, idempotent', () => {
  it('ok when the conditional playing→completed update hit a row', async () => {
    mode = 'finishUpdate';
    finishResult.data = { id: 'req-1' };
    const res = await finishOwnRequest('room-1', 'req-1');
    expect(res.outcome).toBe('ok');
  });

  it('already_done when the row is already completed (double finish)', async () => {
    // First terminal (the update) matches nothing; the follow-up status read
    // returns 'completed'. We flip `mode` after the update call resolves.
    let calls = 0;
    const orig = orderRow;
    mode = 'finishUpdate';
    finishResult.data = null;
    // getRequestOrderFields reads next → simulate by switching mode on 2nd terminal.
    const dbMod = await import('@/lib/supabase.server');
    vi.spyOn(dbMod, 'karaokeDb').mockReturnValue({
      rpc,
      from: () =>
        chain(() => {
          calls += 1;
          return calls === 1 ? { data: null, error: null } : { data: { status: 'completed' }, error: null };
        }),
    } as never);
    const res = await finishOwnRequest('room-1', 'req-1');
    expect(res.outcome).toBe('already_done');
    vi.restoreAllMocks();
    void orig;
  });

  it('not_playing when the row exists but is waiting', async () => {
    let calls = 0;
    const dbMod = await import('@/lib/supabase.server');
    vi.spyOn(dbMod, 'karaokeDb').mockReturnValue({
      rpc,
      from: () =>
        chain(() => {
          calls += 1;
          return calls === 1 ? { data: null, error: null } : { data: { status: 'waiting' }, error: null };
        }),
    } as never);
    const res = await finishOwnRequest('room-1', 'req-1');
    expect(res.outcome).toBe('not_playing');
    expect(res.from).toBe('waiting');
    vi.restoreAllMocks();
  });

  it('not_found when the row does not exist at all', async () => {
    let calls = 0;
    const dbMod = await import('@/lib/supabase.server');
    vi.spyOn(dbMod, 'karaokeDb').mockReturnValue({
      rpc,
      from: () => chain(() => { calls += 1; return { data: null, error: null }; }),
    } as never);
    const res = await finishOwnRequest('room-1', 'req-1');
    expect(res.outcome).toBe('not_found');
    expect(calls).toBe(2); // update miss, then status read miss
    vi.restoreAllMocks();
  });
});
