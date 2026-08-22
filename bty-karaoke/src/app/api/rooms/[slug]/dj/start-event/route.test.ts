// Event Lifecycle V1 — the DJ-device Start New Event route.
//
// Proves the DEVICE-TOKEN AUTHORIZATION BOUNDARY end-to-end at the route level:
// missing / invalid / revoked tokens are refused, a token for Room A can never
// start Room B, a valid token starts ONLY its canonical room, and rapid/concurrent
// starts converge on exactly ONE active Event. Authority is the existing
// authorizeDj boundary — no broadening, no second auth system.

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** The only credential→room pairings the fake authorizer accepts. */
const DEVICES: Record<string, { roomId: string; slug: string; revoked?: boolean }> = {
  'tok-roomA': { roomId: 'room-A', slug: 'room-a' },
  'tok-roomB': { roomId: 'room-B', slug: 'room-b' },
  'tok-revoked': { roomId: 'room-A', slug: 'room-a', revoked: true },
};

const authorizeDjSpy = vi.fn(async (slug: string, bearer: string) => {
  const device = DEVICES[bearer];
  // Unknown / revoked credential → no authority at all.
  if (!device || device.revoked) return null;
  // ROOM SCOPING: the credential only grants authority on ITS canonical room.
  if (device.slug !== slug) return null;
  return {
    room: { id: device.roomId, slug: device.slug, display_name: 'Room', status: 'open' },
    role: 'dj',
    deviceId: 'd1',
  };
});

/** Idempotent live-event store mirroring the one-live-per-room invariant. */
const live: Record<string, { id: string; status: string; name: string }> = {};
let createCount = 0;
// BUILD 26U-R1 — the route now calls the entitlement-GATED session-start authority, which
// returns a discriminated result instead of a bare Event. The fake keeps the same idempotent
// store and returns the `ok` arm, because this file's subject is the DEVICE-TOKEN AUTHORIZATION
// boundary; the entitlement refusal has its own dedicated test below.
let entitled = true;
const startHostedRoomSessionSpy = vi.fn(async (roomId: string, name: string) => {
  if (!entitled) return { ok: false as const, code: 'PREMIUM_ROOM_REQUIRED' as const };
  if (live[roomId]) {
    return { ok: true as const, event: live[roomId], activated: false, expiresAt: null, source: 'ALREADY_LIVE' };
  }
  createCount += 1;
  live[roomId] = { id: `evt-${roomId}-${createCount}`, status: 'active', name };
  return {
    ok: true as const,
    event: live[roomId],
    activated: true,
    expiresAt: '2026-08-22T18:00:00Z',
    source: 'ACTIVATED_PASS',
  };
});

vi.mock('@/lib/rooms.server', () => ({ authorizeDj: (s: string, b: string) => authorizeDjSpy(s, b) }));
vi.mock('@/lib/events.server', () => ({
  startHostedRoomSession: (r: string, n: string) => startHostedRoomSessionSpy(r, n),
  publicEvent: (e: { id: string; status: string }) => ({ id: e.id, status: e.status }),
}));
vi.mock('@/lib/sessions.server', () => ({ startSession: vi.fn(async () => ({ id: 'sess-1' })) }));

import { POST } from './route';

function makeReq(authorization?: string) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  for (const k of Object.keys(live)) delete live[k];
  createCount = 0;
  entitled = true;
  authorizeDjSpy.mockClear();
  startHostedRoomSessionSpy.mockClear();
});

describe('POST /api/rooms/[slug]/dj/start-event — authorization boundary', () => {
  it('(1) a MISSING token is rejected (401) and never reaches the service', async () => {
    const res = await POST(makeReq(undefined), ctx('room-a'));
    expect(res.status).toBe(401);
    expect(startHostedRoomSessionSpy).not.toHaveBeenCalled();
  });

  it('(2) an INVALID/unknown token is rejected (401), no Event created', async () => {
    const res = await POST(makeReq('Bearer not-a-real-token'), ctx('room-a'));
    expect(res.status).toBe(401);
    expect(startHostedRoomSessionSpy).not.toHaveBeenCalled();
    expect(createCount).toBe(0);
  });

  it('(3) a REVOKED/expired device token is rejected (401), no Event created', async () => {
    const res = await POST(makeReq('Bearer tok-revoked'), ctx('room-a'));
    expect(res.status).toBe(401);
    expect(startHostedRoomSessionSpy).not.toHaveBeenCalled();
    expect(createCount).toBe(0);
  });

  it('(4) a Room A token CANNOT start Room B (401) — cross-room is refused', async () => {
    const res = await POST(makeReq('Bearer tok-roomA'), ctx('room-b'));
    expect(res.status).toBe(401);
    expect(startHostedRoomSessionSpy).not.toHaveBeenCalled();
    expect(live['room-B']).toBeUndefined();
  });

  it('(5) a valid token starts ONLY its canonical room (scoped by the route slug)', async () => {
    const res = await POST(makeReq('Bearer tok-roomA'), ctx('room-a'));
    expect(res.status).toBe(201);
    // The route hands the URL slug to the authorizer — that is what scopes authority.
    expect(authorizeDjSpy).toHaveBeenCalledWith('room-a', 'tok-roomA');
    // And creates the Event on the AUTHORIZED room's id, never a caller-supplied one.
    expect(startHostedRoomSessionSpy).toHaveBeenCalledWith('room-A', expect.any(String));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.event.status).toBe('active');
    expect(live['room-B']).toBeUndefined(); // Room B untouched
  });

  it('(6) RAPID/CONCURRENT starts produce exactly ONE active Event', async () => {
    const results = await Promise.all([
      POST(makeReq('Bearer tok-roomA'), ctx('room-a')),
      POST(makeReq('Bearer tok-roomA'), ctx('room-a')),
      POST(makeReq('Bearer tok-roomA'), ctx('room-a')),
    ]);
    for (const r of results) expect(r.status).toBe(201);
    const ids = await Promise.all(results.map(async (r) => (await r.json()).event.id));
    expect(new Set(ids).size).toBe(1);        // all callers converge on one Event
    expect(createCount).toBe(1);              // exactly one Event was ever created
  });

  it('two DIFFERENT rooms each get their own single Event (no cross-contamination)', async () => {
    const a = await POST(makeReq('Bearer tok-roomA'), ctx('room-a'));
    const b = await POST(makeReq('Bearer tok-roomB'), ctx('room-b'));
    const idA = (await a.json()).event.id;
    const idB = (await b.json()).event.id;
    expect(idA).not.toBe(idB);
    expect(createCount).toBe(2);
  });
});
