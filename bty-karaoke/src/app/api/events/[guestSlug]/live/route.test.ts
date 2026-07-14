import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GuestLivePresence } from '@/domain/live-presence';

const state: { event: unknown; presence: GuestLivePresence } = {
  event: { id: 'evt-1', room_id: 'room-1', name: 'Friday Night', host_name: 'Dr. Chi', status: 'active' },
  presence: {
    event: { name: 'Friday Night', hostName: 'Dr. Chi', status: 'active' },
    nowPlaying: { title: 'Perfect', guestName: 'John', thumbnailUrl: null, startedAt: '2026-07-14T01:00:00.000Z' },
    upNext: { title: 'Dancing Queen', guestName: 'Sarah', thumbnailUrl: null },
    counts: { guests: 12, requests: 18, waiting: 5 },
  },
};

vi.mock('@/lib/events.server', () => ({
  getEventByGuestSlug: vi.fn(async () => state.event),
  getGuestLivePresenceByEvent: vi.fn(async () => state.presence),
}));

import { GET } from './route';

function makeReq() {
  return {} as unknown as Parameters<typeof GET>[0];
}
const ctx = (guestSlug: string) => ({ params: Promise.resolve({ guestSlug }) });

beforeEach(() => {
  state.event = { id: 'evt-1', room_id: 'room-1', name: 'Friday Night', host_name: 'Dr. Chi', status: 'active' };
});

describe('GET /api/events/[guestSlug]/live', () => {
  it('returns live presence for a valid slug (public, no auth)', async () => {
    const res = await GET(makeReq(), ctx('friday-night-7k4m2p'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as GuestLivePresence;
    expect(data.event.name).toBe('Friday Night');
    expect(data.nowPlaying?.title).toBe('Perfect');
    expect(data.upNext?.title).toBe('Dancing Queen');
    expect(data.counts).toEqual({ guests: 12, requests: 18, waiting: 5 });
  });

  it('returns 404 for an unknown slug', async () => {
    state.event = null;
    const res = await GET(makeReq(), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('exposes NO private fields (room_id / slug / secret / token / requestId)', async () => {
    const res = await GET(makeReq(), ctx('friday-night-7k4m2p'));
    const raw = JSON.stringify(await res.json()).toLowerCase();
    for (const forbidden of ['room_id', 'roomid', 'slug', 'secret', 'credential', 'token', 'requestid', 'dj_secret', 'service_role']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('sets no-store so the poll always sees fresh state', async () => {
    const res = await GET(makeReq(), ctx('friday-night-7k4m2p'));
    expect((res.headers.get('cache-control') ?? '').toLowerCase()).toContain('no-store');
  });
});
