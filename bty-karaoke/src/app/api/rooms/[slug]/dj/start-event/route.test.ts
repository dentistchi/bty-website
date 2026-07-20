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
const startNewEventSpy = vi.fn(async (roomId: string, name: string) => {
  if (live[roomId]) return live[roomId]; // a live Event is returned unchanged
  createCount += 1;
  live[roomId] = { id: `evt-${roomId}-${createCount}`, status: 'active', name };
  return live[roomId];
});

vi.mock('@/lib/rooms.server', () => ({ authorizeDj: (s: string, b: string) => authorizeDjSpy(s, b) }));
vi.mock('@/lib/events.server', () => ({
  startNewEvent: (r: string, n: string) => startNewEventSpy(r, n),
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
  authorizeDjSpy.mockClear();
  startNewEventSpy.mockClear();
});

describe('POST /api/rooms/[slug]/dj/start-event — authorization boundary', () => {
  it('(1) a MISSING token is rejected (401) and never reaches the service', async () => {
    const res = await POST(makeReq(undefined), ctx('room-a'));
    expect(res.status).toBe(401);
    expect(startNewEventSpy).not.toHaveBeenCalled();
  });

  it('(2) an INVALID/unknown token is rejected (401), no Event created', async () => {
    const res = await POST(makeReq('Bearer not-a-real-token'), ctx('room-a'));
    expect(res.status).toBe(401);
    expect(startNewEventSpy).not.toHaveBeenCalled();
    expect(createCount).toBe(0);
  });

  it('(3) a REVOKED/expired device token is rejected (401), no Event created', async () => {
    const res = await POST(makeReq('Bearer tok-revoked'), ctx('room-a'));
    expect(res.status).toBe(401);
    expect(startNewEventSpy).not.toHaveBeenCalled();
    expect(createCount).toBe(0);
  });

  it('(4) a Room A token CANNOT start Room B (401) — cross-room is refused', async () => {
    const res = await POST(makeReq('Bearer tok-roomA'), ctx('room-b'));
    expect(res.status).toBe(401);
    expect(startNewEventSpy).not.toHaveBeenCalled();
    expect(live['room-B']).toBeUndefined();
  });

  it('(5) a valid token starts ONLY its canonical room (scoped by the route slug)', async () => {
    const res = await POST(makeReq('Bearer tok-roomA'), ctx('room-a'));
    expect(res.status).toBe(201);
    // The route hands the URL slug to the authorizer — that is what scopes authority.
    expect(authorizeDjSpy).toHaveBeenCalledWith('room-a', 'tok-roomA');
    // And creates the Event on the AUTHORIZED room's id, never a caller-supplied one.
    expect(startNewEventSpy).toHaveBeenCalledWith('room-A', expect.any(String));
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
