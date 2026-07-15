// Self-service FINISH route: only the owner of the PLAYING request may end it,
// checked before any queue work; double-finish is idempotent (already_done→200).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  owns: true,
  room: null as null | { id: string },
  finish: { outcome: 'ok' } as { outcome: string; from?: string },
};

const verifyOwner = vi.fn(async () => state.owns);
vi.mock('@/lib/capability.server', () => ({
  verifyOwnerCapability: (...a: unknown[]) => verifyOwner(...(a as [])),
}));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  finishOwnRequest: vi.fn(async () => state.finish),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

beforeEach(() => {
  state.owns = true;
  state.room = { id: 'room-1' };
  state.finish = { outcome: 'ok' };
  verifyOwner.mockClear();
});

describe('POST .../requests/[id]/finish', () => {
  it('denies a non-owner (403, no queue work)', async () => {
    state.owns = false;
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(403);
    const rooms = await import('@/lib/rooms.server');
    expect(rooms.finishOwnRequest).not.toHaveBeenCalled();
  });

  it('finishes the owner\'s playing song (200)', async () => {
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('treats a double finish as idempotent success (already_done → 200)', async () => {
    state.finish = { outcome: 'already_done', from: 'completed' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('rejects finishing a not-playing (e.g. waiting) song (409)', async () => {
    state.finish = { outcome: 'not_playing', from: 'waiting' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('REQUEST_NOT_PLAYING');
  });

  it('404s an unknown request', async () => {
    state.finish = { outcome: 'not_found' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(404);
  });
});
