// Room Branding V1 — logo removal route contract: clear the pointer, delete only the
// Room's own current object (never a client key), owner-only, uniform 404.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  csrfOk: true,
  room: { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', logo_object_key: 'rooms/room-chi/logo-OLD.webp' as string | null },
  hasAccess: true,
};
const clearSpy = vi.fn(async (_id: string) => {});
const deleteSpy = vi.fn(async (_k: string) => true);

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => state.hostToken }));
vi.mock('@/lib/host-csrf.server', () => ({
  verifyHostCsrf: vi.fn(async () => (state.csrfOk ? { ok: true } : { ok: false, reason: 'x' })),
  csrfFromForm: () => 'csrf-token',
}));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  clearRoomLogoPointer: (id: string) => clearSpy(id),
}));
vi.mock('@/lib/logo-storage.server', () => ({ deleteLogoObject: (k: string) => deleteSpy(k) }));

import { POST } from './route';

const makeReq = () => ({
  formData: async () => new Map([['csrf', 'csrf-token']]),
  headers: { get: () => null },
  nextUrl: { origin: 'https://norebang.btydaily.com', protocol: 'https:' },
}) as unknown as Parameters<typeof POST>[0];
const ctx = { params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }) };

beforeEach(() => {
  state.hostToken = 'host-token'; state.account = { id: 'acct-1' }; state.csrfOk = true;
  state.room = { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', logo_object_key: 'rooms/room-chi/logo-OLD.webp' };
  state.hasAccess = true; clearSpy.mockClear(); deleteSpy.mockClear();
});

describe('POST /api/host/rooms/[slug]/logo/remove', () => {
  it('owner → clears the pointer and deletes exactly the Room\'s current object, 303 logo_removed', async () => {
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/host/rooms/chi-norebang-xqjbyszq/settings?notice=logo_removed');
    expect(clearSpy).toHaveBeenCalledWith('room-chi');
    expect(deleteSpy).toHaveBeenCalledWith('rooms/room-chi/logo-OLD.webp'); // the Room's own key, never a client key
  });
  it('no existing logo → clears pointer, no delete', async () => {
    state.room.logo_object_key = null;
    await POST(makeReq(), ctx);
    expect(clearSpy).toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
  it('unauthenticated → 303 /, nothing changed', async () => {
    state.account = null;
    expect((await POST(makeReq(), ctx)).headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(clearSpy).not.toHaveBeenCalled();
  });
  it('bad CSRF → 403', async () => { state.csrfOk = false; expect((await POST(makeReq(), ctx)).status).toBe(403); expect(clearSpy).not.toHaveBeenCalled(); });
  it('non-owner → 404', async () => { state.hasAccess = false; expect((await POST(makeReq(), ctx)).status).toBe(404); expect(clearSpy).not.toHaveBeenCalled(); });
});
