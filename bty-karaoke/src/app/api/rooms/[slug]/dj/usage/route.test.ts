// B2 — the canonical usage PROJECTION endpoint. Auth-gated, read-only, returns the
// resolved banner projection both clients render. 401 without a valid DJ credential.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  cred: 'cred' as string | null,
  auth: { room: { id: 'room-1' } } as null | { room: { id: string } },
  entitlement: null as unknown,
};

vi.mock('@/lib/dj-auth.server', () => ({ roomCredentialFromRequest: vi.fn(() => state.cred) }));
vi.mock('@/lib/rooms.server', () => ({ authorizeDj: vi.fn(async () => state.auth) }));
vi.mock('@/lib/metering.server', () => ({ readRoomEntitlement: vi.fn(async () => state.entitlement) }));

import { GET } from './route';

const req = { headers: { get: () => 'Bearer x' } } as unknown as Parameters<typeof GET>[0];
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.cred = 'cred';
  state.auth = { room: { id: 'room-1' } };
  state.entitlement = null;
});

describe('GET /dj/usage', () => {
  it('401 when no credential', async () => {
    state.cred = null;
    expect((await GET(req, ctx)).status).toBe(401);
  });

  it('401 when DJ auth fails', async () => {
    state.auth = null;
    expect((await GET(req, ctx)).status).toBe(401);
  });

  it('projects a FREE zero snapshot to zero_idle', async () => {
    state.entitlement = {
      plan: 'FREE', unlimited: false, enforcementEnabled: true, limitSeconds: 900,
      usedSeconds: 900, remainingSeconds: 0, activePlaybackCount: 0,
      nextResetAt: '2026-07-24T11:00:00.000Z', timezone: 'America/Los_Angeles', warnLevel: 'zero',
    };
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.usage.bannerKind).toBe('zero_idle');
    expect(data.usage.startBlocked).toBe(true);
  });

  it('no unambiguous owner (null entitlement) → usage null (no banner)', async () => {
    state.entitlement = null;
    const data = await (await GET(req, ctx)).json();
    expect(data.usage).toBeNull();
  });

  it('enforcement disabled → disabled banner (no active warning)', async () => {
    state.entitlement = {
      plan: 'FREE', unlimited: false, enforcementEnabled: false, limitSeconds: 900,
      usedSeconds: 300, remainingSeconds: 600, activePlaybackCount: 0,
      nextResetAt: '2026-07-24T11:00:00.000Z', timezone: 'America/Los_Angeles', warnLevel: 'none',
    };
    const data = await (await GET(req, ctx)).json();
    expect(data.usage.bannerKind).toBe('disabled');
  });
});
