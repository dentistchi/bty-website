// Event Lifecycle V1 — the guest self-cancel route rejects an ENDED event HONESTLY
// (409 EVENT_ENDED) after ownership is proven, rather than only failing indirectly
// because End already removed the row. Ownership is still checked first.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  owns: true,
  room: { id: 'room-1' } as null | { id: string },
  access: { ok: true, event: null } as
    | { ok: true; event: unknown }
    | { ok: false; status: 403 | 409; code: string; error: string },
  cancel: { outcome: 'ok', status: 'removed' } as
    | { outcome: 'ok'; status: string }
    | { outcome: 'not_found' }
    | { outcome: 'not_cancellable'; from: string },
};

vi.mock('@/lib/capability.server', () => ({
  verifyCancelCapability: vi.fn(async () => state.owns),
}));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
  cancelOwnRequest: vi.fn(async () => state.cancel),
}));
vi.mock('@/lib/events.server', () => ({
  resolveEventAccess: vi.fn(async () => state.access),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home', id: 'req-1' }) };
const body = { token: 'cap-token' };

beforeEach(() => {
  state.owns = true;
  state.room = { id: 'room-1' };
  state.access = { ok: true, event: null };
  state.cancel = { outcome: 'ok', status: 'removed' };
});

describe('POST /api/rooms/[slug]/requests/[id]/cancel — ended-event gate', () => {
  it('a live event cancels a still-waiting request (200 removed)', async () => {
    const res = await POST(makeReq(body), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('removed');
  });

  it('an ended event refuses cancel HONESTLY with 409 EVENT_ENDED', async () => {
    state.access = { ok: false, status: 409, code: 'EVENT_ENDED', error: 'This event has ended' };
    const res = await POST(makeReq(body), ctx);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('EVENT_ENDED');
  });

  it('rejects a caller who does not own the request BEFORE resolving the event (403)', async () => {
    state.owns = false;
    const res = await POST(makeReq(body), ctx);
    expect(res.status).toBe(403);
  });
});
