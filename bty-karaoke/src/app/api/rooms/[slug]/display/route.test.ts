// Public display route: no-store always, 404 on unknown room, and the response
// carries ONLY the safe display projection (never session_id / dj_secret / UUID).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DisplayState } from '@/domain/display';

const state = {
  room: null as null | { id: string; slug: string; display_name: string; status: string },
  display: null as null | DisplayState,
};

vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  getDisplayState: vi.fn(async () => state.display),
}));

import { GET } from './route';

const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };
function makeReq() {
  return {} as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  state.room = { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' };
  state.display = {
    room: { name: 'BTY Home', slug: 'bty-home', open: true },
    playing: {
      id: 'req-1',
      guestName: 'Dr. Chi',
      title: 'Dancing Queen',
      artist: 'ABBA',
      videoId: 'abcdefghijk',
      videoKind: 'mr',
      thumbnailUrl: null,
      status: 'playing',
    },
    next: null,
    waiting: [],
    waitingCount: 0,
    stats: { singers: 1, requests: 1, completed: 0, waiting: 0 },
  };
});

describe('GET /api/rooms/[slug]/display', () => {
  it('returns the display state with a no-store header', async () => {
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const data = await res.json();
    expect(data.playing.title).toBe('Dancing Queen');
    expect(data.playing.videoKind).toBe('mr');
  });

  it('404s (no-store) when the room is unknown', async () => {
    state.room = null;
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('the serialized payload leaks no secret/session/uuid fields', async () => {
    const res = await GET(makeReq(), ctx);
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain('session_id');
    expect(raw).not.toContain('dj_secret');
    expect(raw).not.toContain('room-1'); // internal room UUID never travels
  });
});
