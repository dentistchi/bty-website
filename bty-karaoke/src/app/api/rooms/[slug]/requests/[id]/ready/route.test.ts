// Guest READY route (V1.1 manual-first): owner-gated. Sets ready_at ONLY — it never
// starts a song (the V8 auto-start on readiness was removed so the first song is an
// explicit operator action). `autoStarted` stays in the response (always false).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  owns: true,
  room: { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' } as
    | null
    | { id: string; slug: string; display_name: string; status: string },
  ready: { outcome: 'ok' } as { outcome: 'ok' | 'not_waiting' | 'not_found' },
  promote: { outcome: 'blocked_not_ready' } as { outcome: string; request?: { id: string } },
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
const promoteNextReady = vi.fn(async () => state.promote);
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  setRequestReady: (...a: unknown[]) => setRequestReady(...(a as [])),
  promoteNextReady: (...a: unknown[]) => promoteNextReady(...(a as [])),
  getGuestQueueStatus: vi.fn(async () => ({ state: 'up_next', position: 1 })),
}));

import { POST } from './route';

const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  state.owns = true;
  state.room = { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' };
  state.ready = { outcome: 'ok' };
  state.promote = { outcome: 'blocked_not_ready' };
  setRequestReady.mockClear();
  promoteNextReady.mockClear();
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

  it('clears the signal when ready=false ("준비 취소")', async () => {
    await POST(req({ token: 't', ready: false }), ctx);
    expect(setRequestReady).toHaveBeenCalledWith('room-1', 'req-1', false);
    expect(promoteNextReady).not.toHaveBeenCalled(); // unready never auto-starts
  });

  it('V1.1 manual-first: readying the FIRST song sets the signal ONLY — never auto-starts', async () => {
    // Even for the canonical first song with the stage open, Ready no longer starts it.
    state.promote = { outcome: 'started', request: { id: 'req-1' } }; // would have auto-started in V8
    const res = await POST(req({ token: 't' }), ctx);
    expect(res.status).toBe(200);
    expect(promoteNextReady).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ ok: true, ready: true, autoStarted: false });
  });

  it('V1.1: readying any song only stores Ready (autoStarted always false)', async () => {
    const res = await POST(req({ token: 't' }), ctx);
    expect(promoteNextReady).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ ok: true, ready: true, autoStarted: false });
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
