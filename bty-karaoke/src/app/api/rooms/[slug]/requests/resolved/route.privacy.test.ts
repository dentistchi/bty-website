// BUILD 25 — the privacy proof for owner-only resolution retrieval.
//
// The measured hazard: the sibling `GET /requests/[id]` is PUBLIC, so anyone holding a request id
// can read a coarse state from it. If a resolution reason were reachable without proving
// ownership, one Guest could read another Guest's outcome. Every test here is written against
// that specific failure.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RESOLVED_VIEW_KEYS } from '@/domain/request-resolution';

const state = {
  room: { id: 'room-1' } as null | { id: string },
  event: { id: 'evt-1' } as null | { id: string },
  // requestId -> the ONE token that legitimately signs it (populated in beforeEach).
  tokens: {} as Record<string, string>,
  rows: [] as Array<Record<string, unknown>>,
  throwOnRead: false,
};

const REQ_A = '11111111-1111-4111-8111-111111111111';
const REQ_B = '22222222-2222-4222-8222-222222222222';

vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => state.event),
}));
// The real capability module is stateless HMAC; here it is reduced to "this token signs exactly
// this id", which is the only property the route depends on.
vi.mock('@/lib/capability.server', () => ({
  verifyOwnerCapability: vi.fn(async (token: string, id: string) => state.tokens[id] === token),
}));
vi.mock('@/lib/supabase.server', () => ({ karaokeDb: vi.fn(() => ({})) }));

vi.mock('@/lib/request-resolution.server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/request-resolution.server')>(
    '@/lib/request-resolution.server',
  );
  return {
    // The REAL verifier runs, so ownership logic is under test rather than stubbed away.
    verifyOwnedClaims: actual.verifyOwnedClaims,
    listOwnedResolvedRequests: vi.fn(async (_room: string, eventId: string | null, ids: string[]) => {
      if (state.throwOnRead) throw new Error('column "secret_internal" does not exist');
      return state.rows
        .filter((r) => ids.includes(r.requestId as string) && r.eventId === eventId)
        .slice(0, 50);
    }),
  };
});

import { POST } from './route';

const call = (body: unknown) =>
  POST({ json: async () => body } as never, { params: Promise.resolve({ slug: 'bty-home' }) });

// This fixture stands in for the PROJECTION's output, so it must carry every field the real
// projection emits — R6 §D added `youtubeUnavailable`. Omitting it here would make the allowlist
// assertion below pass against a shape the server never actually returns.
const resolvedRow = (requestId: string, over: Record<string, unknown> = {}) => ({
  requestId, videoId: 'v1', title: 'T', channelTitle: null, thumbnailUrl: null,
  status: 'removed', resolutionCode: 'host_removed', resolvedAt: '2026-08-08T10:00:00.000Z',
  eventId: 'evt-1', youtubeUnavailable: false, ...over,
});

beforeEach(() => {
  state.room = { id: 'room-1' };
  state.event = { id: 'evt-1' };
  state.tokens = { [REQ_A]: 'tok-A', [REQ_B]: 'tok-B' };
  state.rows = [resolvedRow(REQ_A), resolvedRow(REQ_B, { resolutionCode: 'guest_cancelled' })];
  state.throwOnRead = false;
});

describe('BUILD 25 — owner-only retrieval', () => {
  it('returns the resolution to the proven owner', async () => {
    const res = await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resolved).toHaveLength(1);
    expect(body.resolved[0].requestId).toBe(REQ_A);
    expect(body.resolved[0].resolutionCode).toBe('host_removed');
  });

  it('an UNRELATED Guest cannot read it — a valid token for B does not vouch for A', async () => {
    const res = await call({ items: [{ requestId: REQ_A, token: 'tok-B' }] });
    const body = await res.json();
    expect(body.resolved).toEqual([]);
  });

  it('a forged/garbage token yields nothing', async () => {
    const body = await (await call({ items: [{ requestId: REQ_A, token: 'nope' }] })).json();
    expect(body.resolved).toEqual([]);
  });

  it('mixing one valid claim with forged ones returns ONLY the proven row', async () => {
    const body = await (
      await call({
        items: [
          { requestId: REQ_A, token: 'tok-A' },
          { requestId: REQ_B, token: 'wrong' },
        ],
      })
    ).json();
    expect(body.resolved.map((r: { requestId: string }) => r.requestId)).toEqual([REQ_A]);
  });

  it('an unproven id NEVER reaches the database read', async () => {
    const mod = await import('@/lib/request-resolution.server');
    const spy = vi.mocked(mod.listOwnedResolvedRequests);
    spy.mockClear();
    await call({ items: [{ requestId: REQ_A, token: 'bad' }] });
    expect(spy).not.toHaveBeenCalled();
  });

  it('failure to prove ownership is indistinguishable from "no results"', async () => {
    // A 403 here would confirm the id EXISTS. Both cases must return the same shape.
    const forged = await call({ items: [{ requestId: REQ_A, token: 'bad' }] });
    state.rows = [];
    const empty = await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] });
    expect(forged.status).toBe(empty.status);
    expect(await forged.json()).toEqual({ resolved: [] });
  });
});

describe('BUILD 25 — Event isolation', () => {
  it('a resolution from ANOTHER Event is not returned', async () => {
    state.rows = [resolvedRow(REQ_A, { eventId: 'evt-OLD' })];
    const body = await (await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] })).json();
    expect(body.resolved).toEqual([]);
  });

  it('Event scope comes from the SERVER — a client cannot name another Event', async () => {
    state.rows = [resolvedRow(REQ_A, { eventId: 'evt-OLD' })];
    // The client tries to smuggle an event id; the schema rejects unknown keys' influence and the
    // route never reads one.
    const body = await (
      await call({ items: [{ requestId: REQ_A, token: 'tok-A' }], eventId: 'evt-OLD' })
    ).json();
    expect(body.resolved).toEqual([]);
    expect(body.eventId).toBe('evt-1'); // the canonical event, not the caller's
  });

  it('reports the canonical event id so the client can scope its own storage', async () => {
    const body = await (await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] })).json();
    expect(body.eventId).toBe('evt-1');
  });
});

describe('BUILD 25 — response shape and error hygiene', () => {
  it('returns EXACTLY the allowlisted keys — no private field', async () => {
    const body = await (await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] })).json();
    expect(Object.keys(body.resolved[0]).sort()).toEqual([...RESOLVED_VIEW_KEYS].sort());
  });

  it('never leaks database error text', async () => {
    state.throwOnRead = true;
    const res = await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('secret_internal');
    expect(JSON.stringify(body)).not.toContain('column');
    expect(body.error).toBe('Could not load request results.');
  });

  it('rejects a malformed body without echoing it', async () => {
    for (const bad of [{}, { items: [] }, { items: [{ requestId: 'not-a-uuid', token: 't' }] }]) {
      const res = await call(bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Validation failed');
    }
  });

  it('rejects invalid JSON', async () => {
    const res = await POST(
      { json: async () => { throw new Error('bad'); } } as never,
      { params: Promise.resolve({ slug: 'bty-home' }) },
    );
    expect(res.status).toBe(400);
  });

  it('is never cached — resolution state changes the moment a Host acts', async () => {
    const res = await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] });
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('404s an unknown room', async () => {
    state.room = null;
    expect((await call({ items: [{ requestId: REQ_A, token: 'tok-A' }] })).status).toBe(404);
  });
});

describe('BUILD 25 — the PUBLIC status route stays reason-free', () => {
  it('the public GET /requests/[id] source publishes no resolution field', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/app/api/rooms/[slug]/requests/[id]/route.ts', 'utf8');
    // That route has no capability check, so a reason there would be world-readable.
    expect(src).not.toContain('resolutionCode');
    expect(src).not.toContain('resolution_code');
  });
});
