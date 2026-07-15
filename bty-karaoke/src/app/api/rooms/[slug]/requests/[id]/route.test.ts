// Guest live-status GET must never be cached (a DJ reorder has to surface on the
// guest's next poll) and returns only the compact position model.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  room: null as null | { id: string },
  status: null as null | { requestId: string; state: string; position: number },
};

vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  getGuestQueueStatus: vi.fn(async () => state.status),
  // present so the module import doesn't fail (PATCH pulls these in)
  authorizeDj: vi.fn(async () => null),
  setRequestStatus: vi.fn(),
  moveToNextWaiting: vi.fn(),
}));

import { GET } from './route';

function makeReq() {
  return {} as unknown as Parameters<typeof GET>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };

beforeEach(() => {
  state.room = { id: 'room-1' };
  state.status = { requestId: 'req-1', state: 'waiting', position: 3 };
});

describe('GET /api/rooms/[slug]/requests/[id]', () => {
  it('returns the compact status with a no-store Cache-Control header', async () => {
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const data = await res.json();
    expect(data.status.position).toBe(3);
    expect(data.status.state).toBe('waiting');
  });

  it('404s (still no-store) when the room is unknown', async () => {
    state.room = null;
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('404s (no-store) when the request is not in the room', async () => {
    state.status = null;
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});
