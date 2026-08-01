// Self-service server helpers, B1 metering. The full atomic guarantees (flip + usage
// segment in one transaction, one-playing, canonical selection) live in the
// karaoke_begin_song / karaoke_end_song RPCs and are exercised at the DB/device-gate
// level (not unit-testable without live Postgres). Here we pin the OUTCOME MAPPING the
// app relies on around those RPCs, via the metering seam.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const beginSong = vi.fn();
const endSong = vi.fn();
vi.mock('@/lib/metering.server', () => ({
  beginSong: (...a: unknown[]) => beginSong(...a),
  endSong: (...a: unknown[]) => endSong(...a),
}));

// Queue reads used by startOwnRequest only on the 'ok' path.
const activeRows: Array<{ id: string; status: string }> = [];
function chain(rows: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit']) b[m] = () => b;
  b.maybeSingle = async () => ({ data: null, error: null });
  b.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) => Promise.resolve(resolve({ data: rows, error: null }));
  return b;
}
vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => ({ from: () => chain(activeRows) }) }));

import { startOwnRequest, finishOwnRequest, ensurePlaying } from './rooms.server';

beforeEach(() => {
  beginSong.mockReset();
  endSong.mockReset();
  activeRows.length = 0;
});

describe('startOwnRequest — begin_song(guest) outcome mapping', () => {
  for (const [begin, mapped] of [
    ['not_found', 'not_found'],
    ['not_waiting', 'not_waiting'],
    ['not_next', 'not_next'],
    ['already_playing', 'already_playing'],
    ['event_state_invalid', 'not_waiting'], // anomalies map to "did not start"
    ['ownership_state_invalid', 'not_waiting'],
  ] as const) {
    it(`maps begin '${begin}' → StartResult '${mapped}' (no queue read on failure)`, async () => {
      beginSong.mockResolvedValueOnce({ outcome: begin });
      const res = await startOwnRequest('room-1', 'req-1');
      expect(res.outcome).toBe(mapped);
      expect(res.request).toBeUndefined();
    });
  }

  it('throws if begin_song surfaces an error (never a silent no-op)', async () => {
    beginSong.mockRejectedValueOnce(new Error('boom'));
    await expect(startOwnRequest('room-1', 'req-1')).rejects.toThrow('boom');
  });
});

describe('finishOwnRequest — end_song(complete) outcome mapping', () => {
  for (const [end, mapped] of [
    ['ok', 'ok'],
    ['recovered', 'already_done'],
    ['already_done', 'already_done'],
    ['not_playing', 'not_playing'],
    ['not_found', 'not_found'],
    ['request_state_changed', 'not_playing'],
  ] as const) {
    it(`maps end '${end}' → FinishResult '${mapped}'`, async () => {
      endSong.mockResolvedValueOnce({ outcome: end });
      const res = await finishOwnRequest('room-1', 'req-1');
      expect(res.outcome).toBe(mapped);
    });
  }

  it('throws if end_song surfaces an error', async () => {
    endSong.mockRejectedValueOnce(new Error('boom'));
    await expect(finishOwnRequest('room-1', 'req-1')).rejects.toThrow('boom');
  });
});

// ---------------------------------------------------------------------------------------------
// BUILD 21 — ensurePlaying must PASS THROUGH the duration diagnosis.
//
// This layer sits between beginSong (which classifies) and /dj/start (which words the message),
// and it is exactly where the diagnosis was almost lost: `admissionDetailOf` copies a fixed list
// of numeric fields, so a new field is silently dropped unless it is threaded explicitly. These
// tests fail if that thread is ever cut again.
// ---------------------------------------------------------------------------------------------

describe('BUILD 21 — ensurePlaying threads durationFailureReason', () => {
  beforeEach(() => {
    activeRows.length = 0;
    activeRows.push({ id: 'req-1', status: 'waiting', ready_at: '2026-08-01T00:00:00.000Z' } as never);
  });

  it.each(['too_long', 'video_unavailable', 'quota_exceeded', 'lookup_failed', 'not_configured'])(
    'carries reason %s up to the route layer',
    async (reason) => {
      beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable', durationFailureReason: reason });
      const res = await ensurePlaying('room-1', 'req-1', 'evt-1');
      expect(res.outcome).toBe('duration_unavailable');
      expect(res.durationFailureReason).toBe(reason);
    },
  );

  it('omits the key entirely when the resolver classified nothing (shipped shape preserved)', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable' });
    const res = await ensurePlaying('room-1', 'req-1', 'evt-1');
    expect(res.outcome).toBe('duration_unavailable');
    expect('durationFailureReason' in res).toBe(false);
  });

  it('never attaches a reason to a NON-duration block', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'pass_insufficient', durationSeconds: 242 });
    const res = await ensurePlaying('room-1', 'req-1', 'evt-1');
    expect(res.outcome).toBe('pass_insufficient');
    expect('durationFailureReason' in res).toBe(false);
  });

  it('a blocked start still mutates nothing — exactly one begin attempt, no second call', async () => {
    beginSong.mockResolvedValueOnce({ outcome: 'duration_unavailable', durationFailureReason: 'too_long' });
    await ensurePlaying('room-1', 'req-1', 'evt-1');
    expect(beginSong).toHaveBeenCalledTimes(1);
  });
});
