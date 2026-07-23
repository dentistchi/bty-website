// V8.1 SINGLE READY PLAYER — server behaviour. The pure decision lives in
// domain/stage-decision.test.ts; here we pin the I/O contract around it: ready-first
// promotion, the idempotent ensure-playing transaction (already-playing → success,
// another song → conflict), and the one-playing guarantee (23505 → already_playing,
// never a second stage). listActiveRequests / getRequestOrderFields are driven by a
// small in-memory table so these exercise the real branching, not just source text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = {
  id: string;
  status: 'waiting' | 'playing' | 'completed' | 'skipped' | 'removed';
  position: number;
  created_at: string;
  ready_at: string | null;
};

// The in-memory table + a flag to simulate the one-playing partial unique index.
let table: Row[] = [];
let rejectSecondPlaying = false;

function full(r: Row) {
  return { ...r, room_id: 'room-1', guest_name: 'G', youtube_video_id: 'v', youtube_title: 't' };
}

// Minimal chainable builder covering the shapes rooms.server uses:
//   listActiveRequests: from().select().eq().in().order()  → array
//   getRequestOrderFields: from().select().eq().eq().maybeSingle() → {status}
//   promoteRequestToPlaying: from().update().eq().eq().eq().select().maybeSingle()
// Models karaoke_begin_song against the in-memory table: a playing row (idempotent
// target OR race loser) → already_playing; a non-waiting target → not_waiting; else the
// waiting→playing flip (respecting the simulated one-playing index). ensurePlaying /
// promoteNextReady pre-resolve the canonical target, so begin only ever flips a valid
// open-stage request — mirroring the RPC being called under the room advisory lock.
function fakeBeginSong(reqId: string) {
  const row = table.find((r) => r.id === reqId);
  if (!row) return { outcome: 'not_found' };
  if (table.some((r) => r.status === 'playing')) return { outcome: 'already_playing' };
  if (row.status !== 'waiting') return { outcome: 'not_waiting' };
  if (rejectSecondPlaying && table.some((r) => r.status === 'playing')) return { outcome: 'already_playing' };
  row.status = 'playing';
  return { outcome: 'ok' };
}

function makeDb() {
  return {
    rpc(name: string, p: Record<string, unknown>) {
      const data = name === 'karaoke_begin_song' ? fakeBeginSong(String(p.p_request_id)) : { outcome: 'invalid_action' };
      return Promise.resolve({ data, error: null });
    },
    from() {
      const ctx: { op: 'select' | 'update'; patch?: Partial<Row>; eqs: Record<string, unknown> } = {
        op: 'select',
        eqs: {},
      };
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.in = () => b;
      b.order = () => b;
      b.update = (patch: Partial<Row>) => {
        ctx.op = 'update';
        ctx.patch = patch;
        return b;
      };
      b.eq = (col: string, val: unknown) => {
        ctx.eqs[col] = val;
        return b;
      };
      b.maybeSingle = async () => {
        if (ctx.op === 'update') return runUpdate(ctx.patch!, ctx.eqs);
        const id = ctx.eqs.id as string | undefined;
        const row = table.find((r) => r.id === id) ?? null;
        return { data: row ? { status: row.status } : null, error: null };
      };
      b.single = b.maybeSingle;
      // listActiveRequests awaits the builder directly (thenable) → array of rows.
      b.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
        const active = table.filter((r) => ['waiting', 'playing'].includes(r.status)).map(full);
        resolve({ data: active, error: null });
      };
      return b;
    },
  };
}

function runUpdate(patch: Partial<Row>, eqs: Record<string, unknown>) {
  const id = eqs.id as string;
  const row = table.find((r) => r.id === id);
  // Status-guarded update: only matches when the current status equals eqs.status.
  if (!row || (eqs.status && row.status !== eqs.status)) return { data: null, error: null };
  if (patch.status === 'playing' && rejectSecondPlaying && table.some((r) => r.status === 'playing')) {
    return { data: null, error: { code: '23505' } }; // one-playing index violation
  }
  Object.assign(row, patch);
  return { data: { id: row.id }, error: null };
}

vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => makeDb() }));

import { promoteNextReady, ensurePlaying } from './rooms.server';

const READY = '2026-01-01T00:05:00.000Z';
const base = (id: string, position: number, over: Partial<Row> = {}): Row => ({
  id,
  status: 'waiting',
  position,
  created_at: `2026-01-01T00:0${position}:00.000Z`,
  ready_at: null,
  ...over,
});

beforeEach(() => {
  table = [];
  rejectSecondPlaying = false;
});

describe('promoteNextReady — ready-first, idempotent, one-playing', () => {
  it('#1 unready, #2 ready → #2 becomes playing', async () => {
    table = [base('a', 1), base('b', 2, { ready_at: READY })];
    const r = await promoteNextReady('room-1', null);
    expect(r.outcome).toBe('started');
    expect(r.request?.id).toBe('b');
    expect(table.find((x) => x.id === 'b')?.status).toBe('playing');
    expect(table.find((x) => x.id === 'a')?.status).toBe('waiting');
  });

  it('does nothing when a song is already playing (no interrupt)', async () => {
    table = [base('p', 1, { status: 'playing' }), base('a', 2, { ready_at: READY })];
    const r = await promoteNextReady('room-1', null);
    expect(r.outcome).toBe('already_playing');
    expect(r.request?.id).toBe('p');
  });

  it('no ready song → blocked_not_ready (nothing starts)', async () => {
    table = [base('a', 1), base('b', 2)];
    const r = await promoteNextReady('room-1', null);
    expect(r.outcome).toBe('blocked_not_ready');
    expect(table.every((x) => x.status === 'waiting')).toBe(true);
  });

  it('empty queue → queue_empty', async () => {
    const r = await promoteNextReady('room-1', null);
    expect(r.outcome).toBe('queue_empty');
  });

  it('two racing promotes never create two playing rows (same first-ready target, idempotent)', async () => {
    table = [base('a', 1, { ready_at: READY }), base('b', 2, { ready_at: READY })];
    const [r1, r2] = await Promise.all([promoteNextReady('room-1', null), promoteNextReady('room-1', null)]);
    // Both resolve the SAME earliest-ready target ('a'); exactly one stage results.
    expect(table.filter((x) => x.status === 'playing').length).toBe(1);
    expect(table.find((x) => x.id === 'a')?.status).toBe('playing');
    for (const r of [r1, r2]) expect(['started', 'already_playing']).toContain(r.outcome);
  });
});

describe('ensurePlaying — the idempotent player transaction', () => {
  it('newly starts the first ready song', async () => {
    table = [base('a', 1, { ready_at: READY })];
    const r = await ensurePlaying('room-1', 'a', null);
    expect(r.outcome).toBe('started');
    expect(table.find((x) => x.id === 'a')?.status).toBe('playing');
  });

  it('already-playing target → already_active (SUCCESS, never "Could not start")', async () => {
    table = [base('a', 1, { status: 'playing', ready_at: READY })];
    const r = await ensurePlaying('room-1', 'a', null);
    expect(r.outcome).toBe('already_active');
    expect(r.request?.id).toBe('a');
  });

  it('another song playing → precise conflict (returns the active song)', async () => {
    table = [base('p', 1, { status: 'playing' }), base('a', 2, { ready_at: READY })];
    const r = await ensurePlaying('room-1', 'a', null);
    expect(r.outcome).toBe('conflict');
    expect(r.playing?.id).toBe('p');
  });

  it('target not found → not_found', async () => {
    const r = await ensurePlaying('room-1', 'ghost', null);
    expect(r.outcome).toBe('not_found');
  });

  it('target waiting but not ready → not_ready (nothing forced onto the stage)', async () => {
    table = [base('a', 1, { ready_at: null })];
    const r = await ensurePlaying('room-1', 'a', null);
    expect(r.outcome).toBe('not_ready');
    expect(table.find((x) => x.id === 'a')?.status).toBe('waiting');
  });

  it('two ensure calls for DIFFERENT ready songs → one starts, the other gets a conflict (never two playing)', async () => {
    rejectSecondPlaying = true; // simulate the one-playing partial unique index
    table = [base('a', 1, { ready_at: READY }), base('b', 2, { ready_at: READY })];
    const [ra, rb] = await Promise.all([
      ensurePlaying('room-1', 'a', null),
      ensurePlaying('room-1', 'b', null),
    ]);
    expect(table.filter((x) => x.status === 'playing').length).toBe(1);
    const outcomes = [ra.outcome, rb.outcome];
    expect(outcomes).toContain('started');
    expect(outcomes).toContain('conflict');
  });
});
