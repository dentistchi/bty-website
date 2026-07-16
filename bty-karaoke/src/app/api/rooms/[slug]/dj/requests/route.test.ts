// DJ Add Song endpoint: auth boundary, validation, default guest name, and that
// it reuses the guest submission service (addRequest) to append a waiting row.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  auth: null as null | { room: { id: string } },
  acceptance: { ok: true, sessionId: 'sess-1' } as { ok: boolean; sessionId: string | null },
};
const addRequest = vi.fn(async (args: { guestName: string }) => ({
  request: { id: 'req-new', guest_name: args.guestName, status: 'waiting', position: 9 },
}));
const listActiveRequests = vi.fn(async () => [{ id: 'req-new' }]);

vi.mock('@/lib/rooms.server', () => ({
  authorizeDj: vi.fn(async () => state.auth),
  addRequest: (a: { guestName: string }) => addRequest(a),
  listActiveRequests: () => listActiveRequests(),
}));
vi.mock('@/lib/sessions.server', () => ({
  requestAcceptance: vi.fn(async () => state.acceptance),
}));
// V7 PART H: the add-song route gates through resolveEventAccess. Legacy/no-event
// rooms resolve to ok so the existing DJ add-song behavior is unchanged.
vi.mock('@/lib/events.server', () => ({
  resolveEventAccess: vi.fn(async () => ({ ok: true, event: null })),
}));

import { POST } from './route';

const VID = { youtubeVideoId: 'dQw4w9WgXcQ', youtubeTitle: 'Song', youtubeChannelTitle: 'Chan' };

function makeReq(authorization: string | undefined, body: unknown) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ slug: 'bty-home' }) };

beforeEach(() => {
  state.auth = { room: { id: 'room-1' } };
  state.acceptance = { ok: true, sessionId: 'sess-1' };
  addRequest.mockClear();
  listActiveRequests.mockClear();
});

describe('POST /api/rooms/[slug]/dj/requests', () => {
  it('rejects a caller with no bearer (401)', async () => {
    expect((await POST(makeReq(undefined, VID), ctx)).status).toBe(401);
  });

  it('rejects a caller not authorized for this room (401)', async () => {
    state.auth = null;
    expect((await POST(makeReq('Bearer x', VID), ctx)).status).toBe(401);
    expect(addRequest).not.toHaveBeenCalled();
  });

  it('rejects a payload with no video (400)', async () => {
    expect((await POST(makeReq('Bearer x', { guestName: 'DJ' }), ctx)).status).toBe(400);
  });

  it('409s when the night is not open', async () => {
    state.acceptance = { ok: false, sessionId: null };
    expect((await POST(makeReq('Bearer x', VID), ctx)).status).toBe(409);
  });

  it('adds a waiting request and returns the fresh queue (201)', async () => {
    const res = await POST(makeReq('Bearer x', VID), ctx);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.request.id).toBe('req-new');
    expect(Array.isArray(data.requests)).toBe(true);
    expect(addRequest).toHaveBeenCalledOnce();
  });

  it('defaults the guest name to "DJ" when none is given', async () => {
    await POST(makeReq('Bearer x', VID), ctx);
    expect(addRequest.mock.calls[0][0].guestName).toBe('DJ');
  });

  it('keeps a DJ-entered name for whom the song is added', async () => {
    await POST(makeReq('Bearer x', { ...VID, guestName: '한빛' }), ctx);
    expect(addRequest.mock.calls[0][0].guestName).toBe('한빛');
  });
});
