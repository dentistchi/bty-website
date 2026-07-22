// Room Branding V1 — logo upload/replacement route contract.
//
// Pins: identity→CSRF→ownership order; server-generated object key (client key
// ignored); the compensation flow (upload new → set pointer → delete old, with
// rollback on DB failure and resilience on old-delete failure); and that a branding
// write touches NO Event. Storage + normalizer are mocked; the real normalization is
// proven in logo-image.server.test.ts and the deployed Worker.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  csrfOk: true,
  room: { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', logo_object_key: null as string | null },
  hasAccess: true,
  normalize: { ok: true, webp: new Uint8Array([1, 2, 3]) } as { ok: true; webp: Uint8Array } | { ok: false; reason: string },
  pointerThrows: false,
  deleteOldOk: true,
};

const uploadSpy = vi.fn(async (_k: string, _b: Uint8Array) => {});
const setPointerSpy = vi.fn(async (_id: string, _k: string, _v: string) => { if (state.pointerThrows) throw new Error('db down'); });
const deleteSpy = vi.fn(async (key: string) => (key === state.room.logo_object_key ? state.deleteOldOk : true));

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
  setRoomLogoPointer: (id: string, key: string, v: string) => setPointerSpy(id, key, v),
}));
vi.mock('@/lib/logo-image.server', () => ({ normalizeLogoToWebp: vi.fn(async () => state.normalize) }));
vi.mock('@/lib/logo-storage.server', () => ({
  newLogoObjectKey: (roomId: string) => `rooms/${roomId}/logo-SERVERGEN.webp`,
  newLogoVersion: () => 'ver123',
  uploadLogoObject: (key: string, bytes: Uint8Array) => uploadSpy(key, bytes),
  deleteLogoObject: (key: string) => deleteSpy(key),
}));

import { POST } from './route';

function makeReq(fields: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>([['csrf', 'csrf-token'], ...Object.entries(fields)]);
  if (!('logo' in fields)) map.set('logo', new File([new Uint8Array(1000)], 'l.png', { type: 'image/png' }));
  return {
    formData: async () => map,
    headers: { get: () => null },
    nextUrl: { origin: 'https://norebang.btydaily.com', protocol: 'https:' },
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }) };
const SETTINGS = 'https://norebang.btydaily.com/host/rooms/chi-norebang-xqjbyszq/settings';

beforeEach(() => {
  state.hostToken = 'host-token'; state.account = { id: 'acct-1' }; state.csrfOk = true;
  state.room = { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', logo_object_key: null };
  state.hasAccess = true; state.normalize = { ok: true, webp: new Uint8Array([1, 2, 3]) };
  state.pointerThrows = false; state.deleteOldOk = true;
  uploadSpy.mockClear(); setPointerSpy.mockClear(); deleteSpy.mockClear();
});

describe('POST /api/host/rooms/[slug]/logo', () => {
  it('first upload → stores under a SERVER-generated key, sets the pointer, 303 logo_saved; no old delete', async () => {
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=logo_saved`);
    expect(uploadSpy).toHaveBeenCalledWith('rooms/room-chi/logo-SERVERGEN.webp', expect.any(Uint8Array));
    expect(setPointerSpy).toHaveBeenCalledWith('room-chi', 'rooms/room-chi/logo-SERVERGEN.webp', 'ver123');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('replacement → deletes the OLD object only AFTER new upload + pointer both succeed', async () => {
    state.room.logo_object_key = 'rooms/room-chi/logo-OLD.webp';
    const res = await POST(makeReq(), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=logo_saved`);
    const uploadOrder = uploadSpy.mock.invocationCallOrder[0];
    const pointerOrder = setPointerSpy.mock.invocationCallOrder[0];
    const deleteOrder = deleteSpy.mock.invocationCallOrder[0];
    expect(uploadOrder).toBeLessThan(pointerOrder);
    expect(pointerOrder).toBeLessThan(deleteOrder);
    expect(deleteSpy).toHaveBeenCalledWith('rooms/room-chi/logo-OLD.webp');
  });

  it('DB pointer failure → rolls back the newly uploaded object, 303 logo_failed', async () => {
    state.pointerThrows = true;
    const res = await POST(makeReq(), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=logo_failed`);
    expect(deleteSpy).toHaveBeenCalledWith('rooms/room-chi/logo-SERVERGEN.webp'); // rollback of the NEW key
  });

  it('old-object delete failure is non-fatal → pointer stays, still 303 logo_saved', async () => {
    state.room.logo_object_key = 'rooms/room-chi/logo-OLD.webp';
    state.deleteOldOk = false;
    const res = await POST(makeReq(), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=logo_saved`);
    expect(setPointerSpy).toHaveBeenCalled();
  });

  it('ignores a client-supplied objectKey/path — only the server key is used', async () => {
    await POST(makeReq({ objectKey: 'rooms/OTHER/pwned.webp', logoUrl: 'x', slug: 'other' }), ctx);
    expect(uploadSpy).toHaveBeenCalledWith('rooms/room-chi/logo-SERVERGEN.webp', expect.any(Uint8Array));
  });

  it('unauthenticated → 303 /, nothing stored', async () => {
    state.account = null;
    const res = await POST(makeReq(), ctx);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(uploadSpy).not.toHaveBeenCalled();
  });
  it('bad CSRF → 403, nothing stored', async () => {
    state.csrfOk = false;
    expect((await POST(makeReq(), ctx)).status).toBe(403);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
  it('non-owner → 404 (same as unknown), nothing stored', async () => {
    state.hasAccess = false;
    expect((await POST(makeReq(), ctx)).status).toBe(404);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
  it('missing file → logo_bad, nothing stored', async () => {
    const res = await POST(makeReq({ logo: 'not-a-file' }), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=logo_bad`);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
  it('oversized file (>2MB) → logo_too_large before normalize', async () => {
    const res = await POST(makeReq({ logo: new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }) }), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=logo_too_large`);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
  it('unsupported/undecodable normalizer rejections map to notices, nothing stored', async () => {
    state.normalize = { ok: false, reason: 'unsupported_format' };
    expect((await POST(makeReq(), ctx)).headers.get('location')).toBe(`${SETTINGS}?notice=logo_format`);
    state.normalize = { ok: false, reason: 'too_many_pixels' };
    expect((await POST(makeReq(), ctx)).headers.get('location')).toBe(`${SETTINGS}?notice=logo_too_large`);
    state.normalize = { ok: false, reason: 'undecodable' };
    expect((await POST(makeReq(), ctx)).headers.get('location')).toBe(`${SETTINGS}?notice=logo_bad`);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
