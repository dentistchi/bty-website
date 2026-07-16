// Guest READY route (V6): owner-gated shared signal. It NEVER starts a song —
// it only sets/clears ready_at on the still-waiting request for the Admin Player.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  owns: true,
  room: { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' } as
    | null
    | { id: string; slug: string; display_name: string; status: string },
  ready: { outcome: 'ok' } as { outcome: 'ok' | 'not_waiting' | 'not_found' },
};

// V7: the ready route gates through resolveEventAccess. Legacy/no-event rooms
// resolve to ok so the existing ready behavior is unchanged.
vi.mock('@/lib/events.server', () => ({
  resolveEventAccess: vi.fn(async () => ({ ok: true, event: null })),
}));
vi.mock('@/lib/capability.server', () => ({
  verifyOwnerCapability: vi.fn(async () => state.owns),
}));
const setRequestReady = vi.fn(async () => state.ready);
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  setRequestReady: (...a: unknown[]) => setRequestReady(...(a as [])),
}));

import { POST } from './route';

const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  state.owns = true;
  state.room = { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' };
  state.ready = { outcome: 'ok' };
  setRequestReady.mockClear();
});

describe('POST .../requests/[id]/ready', () => {
  it('403 for a non-owner — never touches the request', async () => {
    state.owns = false;
    const res = await POST(req({ token: 't' }), ctx);
    expect(res.status).toBe(403);
    expect(setRequestReady).not.toHaveBeenCalled();
  });

  it('sets the shared Ready signal for the owner (default ready=true)', async () => {
    const res = await POST(req({ token: 't' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(setRequestReady).toHaveBeenCalledWith('room-1', 'req-1', true);
  });

  it('clears the signal when ready=false ("준비 상태 취소")', async () => {
    await POST(req({ token: 't', ready: false }), ctx);
    expect(setRequestReady).toHaveBeenCalledWith('room-1', 'req-1', false);
  });

  it('409 when the song is no longer waiting (already started / gone)', async () => {
    state.ready = { outcome: 'not_waiting' };
    const res = await POST(req({ token: 't' }), ctx);
    expect(res.status).toBe(409);
  });

  it('never starts a song — no /start or playback here', async () => {
    const raw = (await import('node:fs')).readFileSync(
      (await import('node:url')).fileURLToPath(new URL('./route.ts', import.meta.url)),
      'utf8',
    );
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // code only
    expect(src).not.toMatch(/startOwnRequest|start_karaoke_request|location\.assign|youtube/i);
  });
});
