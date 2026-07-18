// Token→room restore + self-revoke. Verifies a valid admin token resolves ONLY
// its own room + canonical event, an unknown/revoked token is 401, and DELETE
// self-revokes idempotently (even an unknown token clears cleanly).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  device: null as null | { id: string; room_id: string; role: string },
  room: null as null | { id: string; slug: string; display_name: string; status: string },
};

vi.mock('@/lib/dj-auth.server', () => ({
  bearerFromHeader: vi.fn((h: string | null) => (h ? h.replace(/^Bearer\s+/i, '') : null)),
}));
vi.mock('@/lib/devices.server', () => ({
  getActiveDeviceByToken: vi.fn(async () => state.device),
  revokeDevice: vi.fn(async () => ({ id: 'dev-1' })),
}));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomById: vi.fn(async () => state.room),
}));
vi.mock('@/lib/admin-device.server', () => ({
  buildAdminRoomContext: vi.fn(async (room: { slug: string; display_name: string; status: string }) => ({
    slug: room.slug,
    displayName: room.display_name,
    status: room.status,
    hasActiveEvent: false,
    activeEvent: null,
  })),
}));

import { GET, DELETE } from './route';
import { revokeDevice } from '@/lib/devices.server';

function makeReq(authorization?: string) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  state.device = { id: 'dev-1', room_id: 'room-1', role: 'admin' };
  state.room = { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' };
  vi.clearAllMocks();
});

describe('GET /api/admin/device/context', () => {
  it('no bearer → 401', async () => {
    expect((await GET(makeReq(undefined))).status).toBe(401);
  });

  it('unknown/revoked token → 401', async () => {
    state.device = null;
    expect((await GET(makeReq('Bearer dead'))).status).toBe(401);
  });

  it('valid token → its OWN room + role, event may be null', async () => {
    const res = await GET(makeReq('Bearer good'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe('admin');
    expect(data.selectedRoomSlug).toBe('bty-home');
    expect(data.rooms).toHaveLength(1);
    expect(data.rooms[0].activeEvent).toBeNull(); // room identity returned w/o live event
  });

  it('token whose room vanished → 401 (never another room)', async () => {
    state.room = null;
    expect((await GET(makeReq('Bearer good'))).status).toBe(401);
  });
});

describe('DELETE /api/admin/device/context (self-revoke)', () => {
  it('revokes the token’s own device', async () => {
    const res = await DELETE(makeReq('Bearer good'));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(revokeDevice).toHaveBeenCalledWith('room-1', 'dev-1');
  });

  it('idempotent: unknown token still clears (200, no revoke call)', async () => {
    state.device = null;
    const res = await DELETE(makeReq('Bearer dead'));
    expect(res.status).toBe(200);
    expect(revokeDevice).not.toHaveBeenCalled();
  });

  it('no bearer → 401', async () => {
    expect((await DELETE(makeReq(undefined))).status).toBe(401);
  });
});
