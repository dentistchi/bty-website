// Public display route: no-store always, 404 on unknown room, and the response
// carries ONLY the safe display projection (never session_id / dj_secret / UUID).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DisplayState } from '@/domain/display';

const state = {
  room: null as null | { id: string; slug: string; display_name: string; status: string },
  display: null as null | DisplayState,
  event: null as null | { id: string; name: string; status: string; room_id: string },
};

vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  getDisplayState: vi.fn(async () => state.display),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => state.event),
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
    event: null,
  };
  state.event = null;
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

  it('carries event: null for a legacy self-service room (backward compatible)', async () => {
    const res = await GET(makeReq(), ctx);
    const data = await res.json();
    expect(data.event).toBeNull();
  });

  it('injects the room’s ONE canonical event identity (id + name + status) when event-owned', async () => {
    state.event = { id: 'evt-9', name: 'Friday Night', status: 'active', room_id: 'room-1' };
    const res = await GET(makeReq(), ctx);
    const data = await res.json();
    expect(data.event).toEqual({ id: 'evt-9', name: 'Friday Night', status: 'active' });
    // Never leaks the internal room UUID even via the event object.
    expect(JSON.stringify(data.event)).not.toContain('room-1');
  });

  it('surfaces an ended event honestly (status flows through)', async () => {
    state.event = { id: 'evt-9', name: 'Friday Night', status: 'ended', room_id: 'room-1' };
    const res = await GET(makeReq(), ctx);
    const data = await res.json();
    expect(data.event.status).toBe('ended');
  });
});
