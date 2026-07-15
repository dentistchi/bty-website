// Self-service START route: ownership is checked BEFORE any room/queue work, and
// the RPC outcome maps to the right HTTP status. No-store on every path.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  owns: true,
  room: null as null | { id: string },
  start: { outcome: 'ok' } as { outcome: string; request?: unknown; status?: unknown },
};

const verifyOwner = vi.fn(async () => state.owns);
vi.mock('@/lib/capability.server', () => ({
  verifyOwnerCapability: (...a: unknown[]) => verifyOwner(...(a as [])),
}));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  startOwnRequest: vi.fn(async () => state.start),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

beforeEach(() => {
  vi.clearAllMocks(); // reset call history on the shared rooms.server mocks too
  state.owns = true;
  state.room = { id: 'room-1' };
  state.start = { outcome: 'ok', request: { id: 'req-1' }, status: { state: 'now_playing' } };
});

describe('POST .../requests/[id]/start', () => {
  it('rejects a malformed body (400, no-store)', async () => {
    const res = await POST(makeReq({}), ctx);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('denies a non-owner BEFORE touching room/queue (403)', async () => {
    state.owns = false;
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('NOT_YOUR_REQUEST');
  });

  it('404s when the room is unknown', async () => {
    state.room = null;
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(404);
  });

  it('promotes the owner when they are first + stage open (200)', async () => {
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status.state).toBe('now_playing');
  });

  it('maps not_next → 409 NOT_NEXT', async () => {
    state.start = { outcome: 'not_next' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('NOT_NEXT');
  });

  it('maps already_playing → 409 ALREADY_PLAYING', async () => {
    state.start = { outcome: 'already_playing' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ALREADY_PLAYING');
  });

  it('maps not_waiting → 409 REQUEST_NOT_WAITING', async () => {
    state.start = { outcome: 'not_waiting' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('REQUEST_NOT_WAITING');
  });

  it('maps not_found → 404', async () => {
    state.start = { outcome: 'not_found' };
    const res = await POST(makeReq({ token: 't' }), ctx);
    expect(res.status).toBe(404);
  });

  it('never exposes the queue on the ownership-failure path', async () => {
    state.owns = false;
    await POST(makeReq({ token: 't' }), ctx);
    const rooms = await import('@/lib/rooms.server');
    expect(rooms.startOwnRequest).not.toHaveBeenCalled();
  });
});
