// BUILD 26H — the ONE `/app/join/*` resolver now serves TWO identifier forms.
//
// The property that matters most here is ORDER: a genuine request-backed token must always be
// resolved as a handoff, never re-interpreted as room navigation. That ordering is the
// belt-and-braces half of the disjointness guarantee, and it is asserted directly.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env.server', () => ({
  optionalEnv: () => 'test-secret',
  karaokeEnv: () => ({ url: 'https://example.invalid', key: 'test-service-role-key' }),
}));
// Rate limiting is not the subject here; keep it inert and never locked out.
vi.mock('@/lib/rate-limit.server', () => ({
  makeLimiter: async () => null,
  isLockedOut: async () => false,
  recordFailure: async () => {},
}));

/** What the REAL (request-backed) resolver should answer, and how often it was called. */
let legacyResult: { resolution: string; nav?: Record<string, unknown> } = { resolution: 'invalid' };
let legacyCalls: string[] = [];
let roomNavCalls: string[] = [];
let roomNavResult: { resolution: string; nav?: Record<string, unknown> } = { resolution: 'invalid' };

vi.mock('@/lib/guest-handoff.server', () => ({
  resolveGuestAppHandoff: async (token: string) => {
    legacyCalls.push(token);
    return legacyResult;
  },
  resolveRoomNavigation: async (id: string) => {
    roomNavCalls.push(id);
    return roomNavResult;
  },
}));

import { GET } from './route';
import { roomNavIdentifier, roomNavHandoffMarker } from '@/domain/guest-handoff';

const NAV = {
  handoffId: roomNavHandoffMarker('bty-home'),
  roomSlug: 'bty-home',
  roomDisplayName: 'btyNorebang',
  eventId: 'evt-1',
  eventStatus: 'active',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

function call(token: string) {
  return GET(new Request(`https://norebang.btydaily.com/api/guest-app-handoffs/${token}`) as never, {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  legacyCalls = [];
  roomNavCalls = [];
  legacyResult = { resolution: 'invalid' };
  roomNavResult = { resolution: 'active', nav: NAV };
});

describe('H15/H24 — the request-backed token is ALWAYS resolved first', () => {
  it('a real token that resolves never reaches the room-nav path', async () => {
    const realToken = 'A'.repeat(32); // legacy token shape
    legacyResult = { resolution: 'active', nav: { ...NAV, handoffId: 'real-handoff-id' } };
    const res = await call(realToken);
    const body = await res.json();
    expect(legacyCalls).toEqual([realToken]);
    expect(roomNavCalls).toEqual([]); // never consulted
    expect(body.handoffId).toBe('real-handoff-id');
  });

  it('an expired/revoked real token is NOT rescued by room navigation', async () => {
    for (const resolution of ['expired', 'revoked', 'event_ended'] as const) {
      legacyCalls = [];
      roomNavCalls = [];
      legacyResult =
        resolution === 'event_ended' ? { resolution, nav: NAV } : { resolution };
      const res = await call('B'.repeat(32));
      const body = await res.json();
      expect(body.resolution, resolution).toBe(resolution);
      expect(roomNavCalls, resolution).toEqual([]);
    }
  });

  it('room navigation is consulted ONLY after the real resolver said invalid', async () => {
    const id = roomNavIdentifier('bty-home')!;
    const res = await call(id);
    expect(legacyCalls).toEqual([id]); // tried first, every time
    expect(roomNavCalls).toEqual([id]);
    expect(res.status).toBe(200);
  });

  it('a non-namespace identifier is never sent to room navigation', async () => {
    await call('just-some-garbage-value');
    expect(roomNavCalls).toEqual([]);
  });
});

describe('H1/H5 — a room-only identifier resolves into the Native envelope', () => {
  it('returns the exact field set Native decodes', async () => {
    const res = await call(roomNavIdentifier('bty-home')!);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ resolution: 'active', ...NAV });
    // Native's decoder requires ALL six or it treats the envelope as invalid.
    for (const k of ['handoffId', 'roomSlug', 'roomDisplayName', 'eventId', 'eventStatus', 'expiresAt']) {
      expect(body[k], k).toBeTruthy();
    }
  });

  it('never caches — every open re-validates', async () => {
    const res = await call(roomNavIdentifier('bty-home')!);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('H22/H23 — the response carries no locale of any kind', async () => {
    const res = await call(roomNavIdentifier('bty-home')!);
    const body = await res.json();
    expect(Object.keys(body).some((k) => /locale|lang/i.test(k))).toBe(false);
  });
});

describe('H6/H7/H8/H26 — safe refusal', () => {
  it('a refused room-nav identifier is a generic 404, like every other refusal', async () => {
    roomNavResult = { resolution: 'invalid' };
    const res = await call(roomNavIdentifier('bty-home')!);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ resolution: 'invalid' });
  });

  it('too-short identifiers are refused before any resolver runs', async () => {
    const res = await call('short');
    expect(res.status).toBe(404);
    expect(legacyCalls).toEqual([]);
    expect(roomNavCalls).toEqual([]);
  });
});
