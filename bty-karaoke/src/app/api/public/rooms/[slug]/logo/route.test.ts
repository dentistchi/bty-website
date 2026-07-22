// Room Branding V1 — public logo proxy contract: streams the Room's OWN normalized
// object from the private bucket (client never supplies a key), clean 404 when no
// logo, and version-aware cache headers. No Host auth required (guests must see it).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  room: { slug: 'chi-norebang-xqjbyszq', logo_object_key: 'rooms/room-chi/logo-X.webp' as string | null, logo_version: 'ver123' as string | null },
  bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]) as Uint8Array | null,
};
const downloadSpy = vi.fn(async (_k: string) => state.bytes);

vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => (state.room.logo_object_key === '__none__' ? null : state.room)) }));
vi.mock('@/lib/logo-storage.server', () => ({ downloadLogoObject: (k: string) => downloadSpy(k) }));

import { GET } from './route';

function makeReq(v?: string) {
  const url = new URL(`https://norebang.btydaily.com/api/public/rooms/chi-norebang-xqjbyszq/logo${v !== undefined ? `?v=${v}` : ''}`);
  return { nextUrl: url } as unknown as Parameters<typeof GET>[0];
}
const ctx = { params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }) };

beforeEach(() => {
  state.room = { slug: 'chi-norebang-xqjbyszq', logo_object_key: 'rooms/room-chi/logo-X.webp', logo_version: 'ver123' };
  state.bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  downloadSpy.mockClear();
});

describe('GET /api/public/rooms/[slug]/logo', () => {
  it('streams image/webp from the ROOM\'S OWN key (not from any query param)', async () => {
    const res = await GET(makeReq('ver123'), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(downloadSpy).toHaveBeenCalledWith('rooms/room-chi/logo-X.webp');
  });
  it('matching ?v= → long immutable cache; mismatch → short cache', async () => {
    expect((await GET(makeReq('ver123'), ctx)).headers.get('cache-control')).toContain('immutable');
    expect((await GET(makeReq('stale'), ctx)).headers.get('cache-control')).not.toContain('immutable');
  });
  it('no logo pointer → clean 404, no storage fetch', async () => {
    state.room.logo_object_key = null;
    const res = await GET(makeReq('x'), ctx);
    expect(res.status).toBe(404);
    expect(downloadSpy).not.toHaveBeenCalled();
  });
  it('pointer set but object missing (orphan / mid-replace) → clean 404', async () => {
    state.bytes = null;
    expect((await GET(makeReq('ver123'), ctx)).status).toBe(404);
  });
});
