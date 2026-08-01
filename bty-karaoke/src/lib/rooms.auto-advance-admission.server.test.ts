// BUILD 23 — AUTO-ADVANCE ADMISSION FAILURE HONESTY V1 (server outcome contract).
//
// THE DEFECT THESE PIN: `promoteRequestToPlaying` produces the FULL admission result
// (`duration_unavailable` + `durationFailureReason`, `pass_insufficient` + `AdmissionDetail`),
// but `promoteNextReady` narrowed it through a 5-member `PromoteOutcome`. Both fail-closed
// blocks therefore fell into the catch-all → `blocked_not_ready` → `needs_ready`, i.e. the Host
// was told the next singer had not pressed Ready. They HAD — that is why the server selected
// them. BUILD 21 fixed exactly this class of lie on the empty-stage `/dj/start` path; the
// finish→next auto-advance path (every song after the first) was never covered.
//
// The mirror-image mistake is just as bad, so it is pinned just as hard: a GENUINE not-ready
// queue must still say `needs_ready`, and an empty queue must still say `no_next`.
//
// Driven through the metering seam (the same seam `rooms.self-service.server.test.ts` owns) so
// these exercise the real mapping chain — beginSong → promoteRequestToPlaying →
// promoteNextReady → passTurnAndPromote — rather than re-asserting source text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const beginSong = vi.fn();
const endSong = vi.fn();
vi.mock('@/lib/metering.server', () => ({
  beginSong: (...a: unknown[]) => beginSong(...a),
  endSong: (...a: unknown[]) => endSong(...a),
}));

type Row = { id: string; status: string; position: number; created_at: string; ready_at: string | null };

// The canonical active-queue rows `listActiveRequests` returns. `promoteNextReady` resolves its
// own target from these via the pure stage decision, so the target id is server-derived — which
// is the whole point of publishing the blocked request's id rather than letting a client guess.
let activeRows: Row[] = [];

function chain(rows: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit', 'is', 'update', 'not']) b[m] = () => b;
  b.maybeSingle = async () => ({ data: null, error: null });
  b.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve(resolve({ data: rows, error: null }));
  return b;
}
vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => ({ from: () => chain(activeRows) }) }));

import { promoteNextReady, passTurnAndPromote } from './rooms.server';

const READY = '2026-08-01T00:05:00.000Z';
const row = (id: string, position: number, over: Partial<Row> = {}): Row => ({
  id,
  status: 'waiting',
  position,
  created_at: `2026-08-01T00:0${position}:00.000Z`,
  ready_at: null,
  ...over,
});

/** The five reasons the resolver can classify. `too_long`/`video_unavailable` are PERMANENT —
 *  those are the ones that made the shipped "waiting for a Ready participant" message an
 *  unwinnable loop rather than merely a wrong sentence. */
const REASONS = ['too_long', 'video_unavailable', 'quota_exceeded', 'lookup_failed', 'not_configured'] as const;

beforeEach(() => {
  beginSong.mockReset();
  endSong.mockReset();
  activeRows = [];
});

describe('BUILD 23 — promoteNextReady preserves duration_unavailable', () => {
  beforeEach(() => {
    activeRows = [row('req-next', 1, { ready_at: READY })];
  });

  it.each(REASONS)('carries reason %s instead of collapsing to blocked_not_ready', async (reason) => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable', durationFailureReason: reason });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('duration_unavailable');
    expect(r.durationFailureReason).toBe(reason);
  });

  it('publishes the BLOCKED request so a notice can be keyed to canonical server truth', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable', durationFailureReason: 'too_long' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.nextRequest?.id).toBe('req-next');
  });

  it('omits durationFailureReason entirely when the resolver classified nothing', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('duration_unavailable');
    expect('durationFailureReason' in r).toBe(false);
  });

  it('never fabricates a default reason (mutant: default → lookup_failed)', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.durationFailureReason).toBeUndefined();
  });

  it('mutates nothing extra — exactly one begin attempt, no automatic retry', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable', durationFailureReason: 'quota_exceeded' });
    await promoteNextReady('room-1', 'evt-1');
    expect(beginSong).toHaveBeenCalledTimes(1);
  });
});

describe('BUILD 23 — promoteNextReady preserves pass_insufficient', () => {
  beforeEach(() => {
    activeRows = [row('req-next', 1, { ready_at: READY })];
  });

  it('surfaces the outcome with the authority boundary detail', async () => {
    beginSong.mockResolvedValueOnce({
      outcome: 'pass_insufficient',
      passExpiresAt: '2026-08-01T01:00:00.000Z',
      durationSeconds: 242,
    });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('pass_insufficient');
    expect(r.passExpiresAt).toBe('2026-08-01T01:00:00.000Z');
    expect(r.durationSeconds).toBe(242);
    expect(r.nextRequest?.id).toBe('req-next');
  });

  it('leaves optional admission fields undefined when the authority sent none', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'pass_insufficient' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('pass_insufficient');
    expect(r.passExpiresAt).toBeUndefined();
    expect(r.durationSeconds).toBeUndefined();
  });

  it('never attaches a duration reason to a pass block', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'pass_insufficient', passExpiresAt: '2026-08-01T01:00:00.000Z' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect('durationFailureReason' in r).toBe(false);
  });
});

describe('BUILD 23 — frozen promoteNextReady outcomes (the mirror-image mutants)', () => {
  it('a GENUINE not-ready queue is still blocked_not_ready', async () => {
    activeRows = [row('a', 1), row('b', 2)];
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('blocked_not_ready');
    expect(r.nextRequest?.id).toBe('a');
    expect(beginSong).not.toHaveBeenCalled();
  });

  it('an empty queue is still queue_empty', async () => {
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('queue_empty');
  });

  it('a song already on stage is still already_playing', async () => {
    activeRows = [row('p', 1, { status: 'playing' }), row('a', 2, { ready_at: READY })];
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('already_playing');
    expect(r.request?.id).toBe('p');
  });

  it('upgrade_required is unchanged and still carries its entitlement snapshot', async () => {
    activeRows = [row('req-next', 1, { ready_at: READY })];
    beginSong.mockResolvedValueOnce({ outcome: 'upgrade_required', entitlement: { remainingSeconds: 0 } });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('upgrade_required');
    expect(r.entitlement).toEqual({ remainingSeconds: 0 });
  });

  it('a normal start is still started', async () => {
    activeRows = [row('req-next', 1, { ready_at: READY })];
    beginSong.mockResolvedValueOnce({ outcome: 'ok' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('started');
    expect(r.request?.id).toBe('req-next');
  });

  it('a lost promote race still reports already_playing, never a new block', async () => {
    activeRows = [row('req-next', 1, { ready_at: READY })];
    beginSong.mockResolvedValueOnce({ outcome: 'already_playing' });
    const r = await promoteNextReady('room-1', 'evt-1');
    expect(r.outcome).toBe('already_playing');
  });
});

describe('BUILD 23 — passTurnAndPromote reports the block without disowning the completion', () => {
  beforeEach(() => {
    activeRows = [row('req-next', 1, { ready_at: READY })];
    endSong.mockResolvedValue({ outcome: 'ok' });
  });

  it('duration_unavailable → completed true, promoted null, distinct reason', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable', durationFailureReason: 'too_long' });
    const r = await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(r.completed).toBe(true); // the current song DID complete — never disown that
    expect(r.promoted).toBeNull();
    expect(r.reason).toBe('duration_unavailable');
    expect(r.durationFailureReason).toBe('too_long');
    expect(r.blocked?.id).toBe('req-next');
  });

  it('pass_insufficient → completed true, promoted null, boundary detail carried', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'pass_insufficient', passExpiresAt: '2026-08-01T01:00:00.000Z' });
    const r = await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(r.completed).toBe(true);
    expect(r.promoted).toBeNull();
    expect(r.reason).toBe('pass_insufficient');
    expect(r.passExpiresAt).toBe('2026-08-01T01:00:00.000Z');
    expect(r.blocked?.id).toBe('req-next');
  });

  it('a genuine not-ready next song still reports needs_ready (frozen)', async () => {
    activeRows = [row('a', 1)];
    const r = await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(r.completed).toBe(true);
    expect(r.reason).toBe('needs_ready');
  });

  it('an empty queue still reports no_next (frozen)', async () => {
    activeRows = [];
    const r = await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(r.reason).toBe('no_next');
  });

  it('upgrade_required is unchanged (frozen)', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'upgrade_required', entitlement: { remainingSeconds: 0 } });
    const r = await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(r.reason).toBe('upgrade_required');
    expect(r.entitlement).toEqual({ remainingSeconds: 0 });
  });

  it('a successful promotion is unchanged (frozen)', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'ok' });
    const r = await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(r.reason).toBe('promoted');
    expect(r.promoted?.id).toBe('req-next');
  });

  it('the terminal transition runs exactly once even when the next start is blocked', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'pass_insufficient' });
    await passTurnAndPromote('room-1', 'req-cur', 'evt-1');
    expect(endSong).toHaveBeenCalledTimes(1);
  });
});
