// Connect iPad Display QR — returns a QR + link to the CANONICAL read-only Display
// route (/r/<room.slug>/display), never a derived event slug, so the iPad camera
// opens the current event's Display directly (no password, no manual URL).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { room: null as null | { id: string; slug: string; display_name: string; status: string } };

vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
}));
vi.mock('@/lib/qr.server', () => ({
  qrSvg: vi.fn(async (url: string) => `<svg data-url="${url}"/>`),
}));

import { GET } from './route';

const req = { nextUrl: { origin: 'https://x.test' } } as unknown as Parameters<typeof GET>[0];
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.room = { id: 'room-1', slug: 'bty-home', display_name: 'btyNorebang', status: 'open' };
});

describe('GET /api/rooms/[slug]/display-qr', () => {
  it('returns the canonical Display URL + a QR of it', async () => {
    const res = await GET(req, ctx);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.url).toBe('https://x.test/r/bty-home/display');
    expect(data.qrSvg).toContain('https://x.test/r/bty-home/display'); // QR encodes THAT url
  });

  it('uses the room slug, NEVER a derived event slug', async () => {
    const res = await GET(req, ctx);
    const data = await res.json();
    expect(data.url).not.toContain('evt-');
    expect(data.url).toContain('/r/bty-home/display');
  });

  it('404 for an unknown room', async () => {
    state.room = null;
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });
});
