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
  // V7 PART G: display falls back to the latest ended event when none is live.
  getLatestEndedEvent: vi.fn(async () => null),
}));
const scheduleLyricsResolve = vi.fn(async (): Promise<void> => {});
vi.mock('@/lib/lyrics-resolver.server', () => ({
  scheduleLyricsResolve: (...a: unknown[]) => scheduleLyricsResolve(...(a as [])),
}));

import { GET } from './route';

const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };
function makeReq(lyrics = false) {
  return {
    nextUrl: new URL(`https://x/api/rooms/bty-home/display${lyrics ? '?lyrics=1' : ''}`),
  } as unknown as Parameters<typeof GET>[0];
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
      songTitle: 'Dancing Queen',
      songArtist: 'ABBA',
      videoId: 'abcdefghijk',
      videoKind: 'mr',
      thumbnailUrl: null,
      status: 'playing',
      ready: false,
    },
    next: null,
    waiting: [],
    waitingCount: 0,
    stats: { singers: 1, requests: 1, completed: 0, waiting: 0 },
    event: null,
  };
  state.event = null;
  scheduleLyricsResolve.mockClear();
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

  // ── V1.1 automatic lyrics (opt-in retry via ?lyrics=1, non-blocking) ───────
  it('does NOT schedule a resolve without ?lyrics=1 (guest polls stay lean)', async () => {
    await GET(makeReq(false), ctx);
    expect(scheduleLyricsResolve).not.toHaveBeenCalled();
  });

  it('schedules a background resolve for the playing song when ?lyrics=1', async () => {
    const res = await GET(makeReq(true), ctx);
    expect(res.status).toBe(200);
    expect(scheduleLyricsResolve).toHaveBeenCalledWith('room-1', 'req-1');
    // Non-blocking: the poll returns the current state; lyrics appear on a later poll.
    const data = await res.json();
    expect(data.playing.title).toBe('Dancing Queen'); // queue/NOW SINGING untouched
  });

  it('scheduling is fire-and-forget — the response never waits on it', async () => {
    let settled = false;
    scheduleLyricsResolve.mockImplementationOnce(
      () => new Promise<void>((r) => setTimeout(() => { settled = true; r(); }, 50)),
    );
    const res = await GET(makeReq(true), ctx); // returns without awaiting the schedule
    expect(res.status).toBe(200);
    expect(settled).toBe(false);
  });

  it('does not schedule when the playing song already has available lyrics', async () => {
    state.display!.playing!.lyrics = { status: 'available', text: 'already', source: 'admin' };
    await GET(makeReq(true), ctx);
    expect(scheduleLyricsResolve).not.toHaveBeenCalled();
  });

  it('does not schedule when nothing is playing', async () => {
    state.display!.playing = null;
    await GET(makeReq(true), ctx);
    expect(scheduleLyricsResolve).not.toHaveBeenCalled();
  });
});
