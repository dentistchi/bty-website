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

import { startOwnRequest, finishOwnRequest } from './rooms.server';

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
