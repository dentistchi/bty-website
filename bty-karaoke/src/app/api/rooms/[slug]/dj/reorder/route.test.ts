// Section-14 server coverage for the DJ reorder route: auth boundary, payload
// validation, and the outcome→HTTP mapping (ok / queue_changed / invalid).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: null as null | { room: { id: string } },
  access: { ok: true, event: null } as
    | { ok: true; event: unknown }
    | { ok: false; status: 403 | 409; code: string; error: string },
  reorder: { outcome: 'ok' } as
    | { outcome: 'ok'; requests: unknown[] }
    | { outcome: 'queue_changed' }
    | { outcome: 'invalid' }
    | { outcome: 'empty' },
};

vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  reorderWaitingRequests: vi.fn(async () => state.reorder),
}));
vi.mock('@/lib/events.server', () => ({
  resolveEventAccess: vi.fn(async () => state.access),
}));

import { POST } from './route';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function makeReq(authorization: string | undefined, body: unknown) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.access = { ok: true, event: null };
  state.reorder = { outcome: 'ok', requests: [{ id: UUID_A }, { id: UUID_B }] };
});

describe('POST /api/rooms/[slug]/dj/reorder', () => {
  it('rejects a caller with no bearer token (401) before any DB work', async () => {
    const res = await POST(makeReq(undefined, { orderedRequestIds: [UUID_A] }), ctx);
    expect(res.status).toBe(401);
  });

  it('rejects a caller not authorized for this room (401)', async () => {
    state.auth = null; // authorizeDj denies (wrong room / revoked / bad cred)
    const res = await POST(makeReq('Bearer x', { orderedRequestIds: [UUID_A] }), ctx);
    expect(res.status).toBe(401);
  });

  it('rejects a non-array / empty payload (400)', async () => {
    expect((await POST(makeReq('Bearer x', { orderedRequestIds: [] }), ctx)).status).toBe(400);
    expect((await POST(makeReq('Bearer x', { orderedRequestIds: 'nope' }), ctx)).status).toBe(400);
    expect((await POST(makeReq('Bearer x', {}), ctx)).status).toBe(400);
  });

  it('rejects non-uuid ids (400)', async () => {
    const res = await POST(makeReq('Bearer x', { orderedRequestIds: ['not-a-uuid'] }), ctx);
    expect(res.status).toBe(400);
  });

  it('reorders successfully and returns the fresh queue (200)', async () => {
    const res = await POST(makeReq('Bearer x', { orderedRequestIds: [UUID_B, UUID_A] }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.requests)).toBe(true);
    expect(data.requests).toHaveLength(2);
  });

  it('maps a changed queue to 409 QUEUE_CHANGED', async () => {
    state.reorder = { outcome: 'queue_changed' };
    const res = await POST(makeReq('Bearer x', { orderedRequestIds: [UUID_A] }), ctx);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('QUEUE_CHANGED');
  });

  it('maps an invalid reorder to 400', async () => {
    state.reorder = { outcome: 'invalid' };
    const res = await POST(makeReq('Bearer x', { orderedRequestIds: [UUID_A] }), ctx);
    expect(res.status).toBe(400);
  });

  it('an ended event refuses reorder HONESTLY with 409 EVENT_ENDED (before any reorder work)', async () => {
    state.access = { ok: false, status: 409, code: 'EVENT_ENDED', error: 'This event has ended' };
    const res = await POST(makeReq('Bearer x', { orderedRequestIds: [UUID_A, UUID_B] }), ctx);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('EVENT_ENDED');
  });
});
