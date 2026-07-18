// Slug-free Admin device enrollment. Verifies the single-PIN-room fast path and
// that EVERY failure mode (no PIN room, ≥2 PIN rooms, wrong PIN, malformed,
// lockout, missing rate-limit secret) is a uniform response that discloses
// nothing — and that success mints an admin device + returns room context.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  soleRoom: null as null | { id: string; slug: string; display_name: string; status: string; admin_pin_hash: string },
  lockedOut: false,
  verifyOk: true,
  rateSecret: 'secret' as string | null,
};

vi.mock('@/lib/rooms.server', () => ({
  getSoleAdminPinRoom: vi.fn(async () => state.soleRoom),
  setRoomAdminPinHash: vi.fn(async () => undefined),
}));
vi.mock('@/lib/devices.server', () => ({
  createDeviceSession: vi.fn(async () => undefined),
}));
vi.mock('@/lib/admin-device.server', () => ({
  buildAdminRoomContext: vi.fn(async (room: { slug: string; display_name: string; status: string }) => ({
    slug: room.slug,
    displayName: room.display_name,
    status: room.status,
    hasActiveEvent: true,
    activeEvent: { id: 'evt-1', name: '오늘의 노래방', status: 'active' },
  })),
}));
vi.mock('@/lib/admin-pin.server', () => ({
  normalizePin: vi.fn((pin: string) => (pin && pin.length >= 6 ? { ok: true, pin } : { ok: false })),
  verifyPin: vi.fn(async () => ({ ok: state.verifyOk, needsRehash: false })),
  hashPin: vi.fn(async () => 'newhash'),
  dummyVerify: vi.fn(async () => undefined),
}));
vi.mock('@/lib/rate-limit.server', () => ({
  rateLimitSecret: vi.fn(() => state.rateSecret),
  makeLimiter: vi.fn(async () => ({})),
  isLockedOut: vi.fn(async () => state.lockedOut),
  recordFailure: vi.fn(async () => undefined),
  recordSuccess: vi.fn(async () => undefined),
}));
vi.mock('@/lib/dj-auth.server', () => ({ randomToken: vi.fn(() => 'DEVTOKEN-abc123') }));
vi.mock('@/domain/pairing', () => ({ defaultDeviceLabel: vi.fn(() => 'iPhone (admin)') }));

import { POST } from './route';

function makeReq(body: unknown) {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

const ROOM = { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open', admin_pin_hash: 'pbkdf2_sha256$...' };
const UNIFORM = '등록할 수 없습니다. 잠시 후 다시 시도해 주세요.';

beforeEach(() => {
  state.soleRoom = ROOM;
  state.lockedOut = false;
  state.verifyOk = true;
  state.rateSecret = 'secret';
});

describe('POST /api/admin/device/enroll', () => {
  it('correct PIN with a sole admin-PIN room → mints admin device + room context', async () => {
    const res = await POST(makeReq({ pin: '123456' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.adminToken).toBe('DEVTOKEN-abc123');
    expect(data.role).toBe('admin');
    expect(data.selectedRoomSlug).toBe('bty-home');
    expect(data.rooms[0].displayName).toBe('BTY Home');
    expect(data.rooms[0].hasActiveEvent).toBe(true);
  });

  it('wrong PIN → uniform 401', async () => {
    state.verifyOk = false;
    const res = await POST(makeReq({ pin: '000000' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(UNIFORM);
  });

  it('no unique admin-PIN room (0 or ≥2) → identical uniform 401', async () => {
    state.soleRoom = null;
    const res = await POST(makeReq({ pin: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(UNIFORM);
  });

  it('malformed PIN → identical uniform 401', async () => {
    const res = await POST(makeReq({ pin: '12' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(UNIFORM);
  });

  it('lockout → identical uniform 401', async () => {
    state.lockedOut = true;
    const res = await POST(makeReq({ pin: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(UNIFORM);
  });

  it('rate-limit secret unconfigured → 503 (feature disabled)', async () => {
    state.rateSecret = null;
    const res = await POST(makeReq({ pin: '123456' }));
    expect(res.status).toBe(503);
  });

  it('never leaks the pin hash / room id', async () => {
    const res = await POST(makeReq({ pin: '123456' }));
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain('pbkdf2');
    expect(raw).not.toContain('room-1');
    expect(raw).not.toContain('admin_pin_hash');
  });
});
