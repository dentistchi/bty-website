// Room Settings V1 — the update endpoint's HTTP contract.
//
// Pins what an owner editing their Room relies on, and what an attacker must not get:
//   - identity FIRST (no session → 303 to root), then CSRF (403)
//   - unknown Room and unauthorized Room are the SAME 404 (no room-existence oracle)
//   - only { name, guestWelcomeMessage } are read; owner/account/workspace/slug in
//     the body are ignored — the Room is resolved from the URL slug, the write
//     targets that Room's id, and the redirect keeps the same slug (immutable)
//   - trims + bounds server-side; Korean/Unicode accepted; empty welcome → null
//   - success writes via updateRoomSettings (the sole mutation) — no Event touch
//
// Uses the REAL RoomSettingsSchema so validation is genuinely exercised.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  hostToken: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  csrfOk: true,
  room: { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', display_name: 'Chi Norebang', status: 'open', guest_welcome_message: null } as
    | null
    | { id: string; slug: string; display_name: string; status: string; guest_welcome_message: string | null },
  hasAccess: true,
};

const updateSpy = vi.fn(async (_roomId: string, s: { displayName: string; guestWelcomeMessage: string | null }) => s);
const themeSpy = vi.fn(async (_roomId: string, _theme: string) => {});

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => state.hostToken }));
vi.mock('@/lib/host-csrf.server', () => ({
  verifyHostCsrf: vi.fn(async () => (state.csrfOk ? { ok: true } : { ok: false, reason: 'bad_token' })),
  csrfFromForm: () => 'csrf-token',
}));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  updateRoomSettings: (roomId: string, s: { displayName: string; guestWelcomeMessage: string | null }) => updateSpy(roomId, s),
  updateRoomTheme: (roomId: string, theme: string) => themeSpy(roomId, theme),
}));

import { POST } from './route';

const SLUG = 'chi-norebang-xqjbyszq';
const SETTINGS = `https://norebang.btydaily.com/host/rooms/${SLUG}/settings`;

function makeReq(fields: Record<string, string> = { csrf: 'csrf-token', name: 'Chi Family Norebang' }) {
  return {
    formData: async () => new Map(Object.entries(fields)),
    headers: { get: () => null },
    nextUrl: { origin: 'https://norebang.btydaily.com', protocol: 'https:' },
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: SLUG }) };

beforeEach(() => {
  state.hostToken = 'host-token';
  state.account = { id: 'acct-1' };
  state.csrfOk = true;
  state.room = { id: 'room-chi', slug: SLUG, display_name: 'Chi Norebang', status: 'open', guest_welcome_message: null };
  state.hasAccess = true;
  updateSpy.mockClear();
  themeSpy.mockClear();
});

describe('POST /api/host/rooms/[slug]/settings', () => {
  it('saves an allowlisted theme alongside name/welcome', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: 'Chi', theme: 'neon_night' }), ctx);
    expect(themeSpy).toHaveBeenCalledWith('room-chi', 'neon_night');
  });

  it('coerces an unknown / injected theme to the default (no raw CSS/colors stored)', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: 'Chi', theme: 'red; background: url(evil)' }), ctx);
    expect(themeSpy).toHaveBeenCalledWith('room-chi', 'midnight_gold');
  });

  it('omitting the theme field never resets the theme (no theme write)', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: 'Chi' }), ctx);
    expect(themeSpy).not.toHaveBeenCalled();
  });

  it('owner updates display name → 303 back to settings?notice=saved, targeting the resolved Room id', async () => {
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=saved`);
    expect(updateSpy).toHaveBeenCalledWith('room-chi', { displayName: 'Chi Family Norebang', guestWelcomeMessage: null });
  });

  it('owner saves a Korean display name and Korean welcome message', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: '치 패밀리 노래방', guestWelcomeMessage: '오늘 함께 즐겨보세요.' }), ctx);
    expect(updateSpy).toHaveBeenCalledWith('room-chi', {
      displayName: '치 패밀리 노래방',
      guestWelcomeMessage: '오늘 함께 즐겨보세요.',
    });
  });

  it('trims leading/trailing whitespace on both fields', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: '  Chi Family Norebang  ', guestWelcomeMessage: '  환영합니다  ' }), ctx);
    expect(updateSpy).toHaveBeenCalledWith('room-chi', { displayName: 'Chi Family Norebang', guestWelcomeMessage: '환영합니다' });
  });

  it('empty/whitespace-only welcome normalizes to null (guest shows the default, no placeholder)', async () => {
    await POST(makeReq({ csrf: 'csrf-token', name: 'Chi', guestWelcomeMessage: '   ' }), ctx);
    expect(updateSpy).toHaveBeenCalledWith('room-chi', { displayName: 'Chi', guestWelcomeMessage: null });
  });

  it('empty display name → bad_name, no write', async () => {
    const res = await POST(makeReq({ csrf: 'csrf-token', name: '   ' }), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=bad_name`);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('over-length display name (>80) → bad_name, no write', async () => {
    const res = await POST(makeReq({ csrf: 'csrf-token', name: 'x'.repeat(81) }), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=bad_name`);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('over-length welcome message (>160) → bad_welcome, no write', async () => {
    const res = await POST(makeReq({ csrf: 'csrf-token', name: 'Chi', guestWelcomeMessage: '가'.repeat(161) }), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=bad_welcome`);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('ignores client-supplied owner/account/workspace/slug — writes only name+welcome to the URL Room', async () => {
    await POST(
      makeReq({ csrf: 'csrf-token', name: 'Renamed', accountId: 'attacker', ownerId: 'x', workspaceId: 'w', slug: 'other-room' }),
      ctx,
    );
    // Room id came from the URL-resolved room, not the body; only the two fields written.
    expect(updateSpy).toHaveBeenCalledWith('room-chi', { displayName: 'Renamed', guestWelcomeMessage: null });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('slug is immutable — the redirect keeps the URL slug even if the body tries to change it', async () => {
    const res = await POST(makeReq({ csrf: 'csrf-token', name: 'Renamed', slug: 'evil-slug' }), ctx);
    expect(res.headers.get('location')).toBe(`${SETTINGS}?notice=saved`);
  });

  it('unauthenticated → 303 to root login, no write', async () => {
    state.account = null;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://norebang.btydaily.com/');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('bad CSRF → 403, no write', async () => {
    state.csrfOk = false;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('unknown Room → 404, no write', async () => {
    state.room = null;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('authenticated NON-owner → the SAME 404 (no oracle), no write', async () => {
    state.hasAccess = false;
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
