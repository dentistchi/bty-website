// BUILD 25 — the two APP-LEVEL terminal writers record the correct reason atomically.
//
// The RPC writers (end_song_v2, end_karaoke_event) are proven against real PostgreSQL in
// supabase/tests/b25. These two live in TypeScript, so they are proven here: the reason must ride
// in the SAME update payload as the status, and the waiting-guard must still be present — that
// guard IS the precedence rule that stops a later writer overwriting a truthful earlier reason.

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Captured { payload: Record<string, unknown>; filters: Array<[string, unknown]> }
const captured: Captured[] = [];
const state = { current: { status: 'waiting' } as { status: string } | null, updated: { id: 'r1' } as unknown };

function chain(payload: Record<string, unknown>) {
  const c: Captured = { payload, filters: [] };
  captured.push(c);
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.eq = (col: string, val: unknown) => { c.filters.push([col, val]); return self(); };
  api.select = () => self();
  api.maybeSingle = async () => ({ data: state.updated, error: null });
  api.single = async () => ({ data: state.updated, error: null });
  return api;
}

vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => chain(payload),
      select: () => {
        const api: Record<string, unknown> = {};
        const self = () => api;
        api.eq = () => self();
        api.in = () => self();
        api.order = () => self();
        api.maybeSingle = async () => ({ data: state.current, error: null });
        return api;
      },
    }),
  }),
}));
vi.mock('./metering.server', () => ({ beginSong: vi.fn(), endSong: vi.fn() }));

import { cancelOwnRequest, setRequestStatus } from './rooms.server';

beforeEach(() => { captured.length = 0; state.current = { status: 'waiting' }; state.updated = { id: 'r1' }; });

/** The single UPDATE the writer issued. */
const update = () => captured[0];

describe('BUILD 25 — Guest cancel', () => {
  it('records guest_cancelled in the SAME statement as the status flip', async () => {
    await cancelOwnRequest('room-1', 'r1');
    const u = update();
    expect(u.payload.status).toBe('removed');
    expect(u.payload.resolution_code).toBe('guest_cancelled');
    expect(typeof u.payload.resolved_at).toBe('string');
  });

  it('keeps the waiting guard — the precedence rule that prevents an overwrite', async () => {
    await cancelOwnRequest('room-1', 'r1');
    expect(update().filters).toContainEqual(['status', 'waiting']);
  });

  it('never claims a Host action', async () => {
    await cancelOwnRequest('room-1', 'r1');
    expect(update().payload.resolution_code).not.toBe('host_removed');
  });
});

describe('BUILD 25 — Host queue actions', () => {
  it('remove records host_removed', async () => {
    await setRequestStatus('room-1', 'r1', 'remove');
    const u = update();
    expect(u.payload.status).toBe('removed');
    expect(u.payload.resolution_code).toBe('host_removed');
    expect(u.filters).toContainEqual(['status', 'waiting']);
  });

  it('skip of a WAITING row records host_skipped', async () => {
    await setRequestStatus('room-1', 'r1', 'skip');
    const u = update();
    expect(u.payload.status).toBe('skipped');
    expect(u.payload.resolution_code).toBe('host_skipped');
  });

  it('never records the Guest as the actor for a Host action', async () => {
    await setRequestStatus('room-1', 'r1', 'remove');
    expect(update().payload.resolution_code).not.toBe('guest_cancelled');
  });

  it('status and reason are one payload — they cannot diverge', async () => {
    await setRequestStatus('room-1', 'r1', 'remove');
    expect(captured).toHaveLength(1);
    const keys = Object.keys(update().payload);
    expect(keys).toContain('status');
    expect(keys).toContain('resolution_code');
    expect(keys).toContain('resolved_at');
  });
});
