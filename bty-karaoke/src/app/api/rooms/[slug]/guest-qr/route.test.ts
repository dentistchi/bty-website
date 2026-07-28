// GET /api/rooms/[slug]/guest-qr — the guest join QR (BUILD 20B-R1 canonicalization).
// Pins: the QR encodes the CANONICAL production origin (norebang.btydaily.com), never
// req.nextUrl.origin (workers.dev on the deployed Worker); the returned `url` and the QR payload
// are byte-identical; slug + live-event scoping (?e=) is unchanged.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  room: null as null | { id: string; slug: string; display_name: string },
  event: null as null | { id: string; name: string },
};

vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/lib/events.server', () => ({ getCanonicalEvent: vi.fn(async () => state.event) }));
vi.mock('@/lib/qr.server', () => ({ qrSvg: vi.fn(async (url: string) => `<svg data-url="${url}"/>`) }));

import { GET } from './route';

// The deployed Worker sees the workers.dev origin — the QR must NOT use it.
const req = { nextUrl: { origin: 'https://bty-karaoke.ywamer2022.workers.dev' } } as unknown as Parameters<typeof GET>[0];
const ctx = { params: Promise.resolve({ slug: 'chi-norebang' }) };

beforeEach(() => {
  delete process.env.KARAOKE_PUBLIC_ORIGIN;
  state.room = { id: 'room-1', slug: 'chi-norebang', display_name: 'Chi Family Norebang' };
  state.event = null;
});

describe('GET /api/rooms/[slug]/guest-qr', () => {
  it('(1) encodes the canonical production origin, never the request/workers.dev origin', async () => {
    const data = await (await GET(req, ctx)).json();
    expect(data.url).toBe('https://norebang.btydaily.com/r/chi-norebang');
    expect(data.url).not.toMatch(/workers\.dev/);
    expect(new URL(data.url).host).toBe('norebang.btydaily.com');
  });

  it('(2) the QR payload is byte-identical to the returned url (copy/share == scan)', async () => {
    const data = await (await GET(req, ctx)).json();
    expect(data.qrSvg).toContain(`data-url="${data.url}"`);
  });

  it('carries the live event id (?e=) unchanged when the room has a canonical event', async () => {
    state.event = { id: 'evt-9', name: 'Friday Night' };
    const data = await (await GET(req, ctx)).json();
    expect(data.url).toBe('https://norebang.btydaily.com/r/chi-norebang?e=evt-9');
  });

  it('404 for an unknown room', async () => {
    state.room = null;
    expect((await GET(req, ctx)).status).toBe(404);
  });
});
