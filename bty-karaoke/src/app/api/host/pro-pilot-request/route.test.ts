// GET/POST /api/host/pro-pilot-request — the FREE Host's request endpoint.
//
// Pins: the account is derived from the SESSION (never the body); a FREE Host can
// create; a PRO Host is rejected (already_pro); an unauthenticated request is a
// uniform 401; a room the account does not own is a 403 (never trusted from the body).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: null as { id: string } | null,
  ownsRoom: false,
};

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: (h: string | null) => h?.replace(/^Bearer\s+/, '') ?? null }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => state.account),
  accountHasRoomAccess: vi.fn(async () => state.ownsRoom),
}));

const getHostProPilotState = vi.fn();
const createProPilotRequest = vi.fn();
vi.mock('@/lib/pro-pilot.server', () => ({
  getHostProPilotState: (...a: unknown[]) => getHostProPilotState(...a),
  createProPilotRequest: (...a: unknown[]) => createProPilotRequest(...a),
}));

import { GET, POST } from './route';

function req(method: 'GET' | 'POST', body?: unknown, auth = 'Bearer tok') {
  return new Request('https://x/api/host/pro-pilot-request', {
    method,
    headers: { 'content-type': 'application/json', authorization: auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.ownsRoom = false;
  getHostProPilotState.mockReset();
  createProPilotRequest.mockReset();
});

describe('GET /api/host/pro-pilot-request', () => {
  it('(6) unauthenticated → uniform 401', async () => {
    state.account = null;
    const res = await GET(req('GET'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns the account plan + request (account from session)', async () => {
    getHostProPilotState.mockResolvedValue({ plan: 'FREE', request: { status: 'PENDING', requestedAt: 't', decidedAt: null } });
    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, plan: 'FREE', request: { status: 'PENDING', requestedAt: 't', decidedAt: null } });
    expect(getHostProPilotState).toHaveBeenCalledWith('acct-1');
  });
});

describe('POST /api/host/pro-pilot-request', () => {
  it('(6) unauthenticated → uniform 401, no create', async () => {
    state.account = null;
    const res = await POST(req('POST', { idempotencyKey: 'k1' }));
    expect(res.status).toBe(401);
    expect(createProPilotRequest).not.toHaveBeenCalled();
  });

  it('(1) a FREE Host creates the request; account comes from the session, not the body', async () => {
    createProPilotRequest.mockResolvedValue({ ok: true, requestId: 'r1', status: 'PENDING', reused: false });
    getHostProPilotState.mockResolvedValue({ plan: 'FREE', request: { status: 'PENDING', requestedAt: 't', decidedAt: null } });
    // A spoofed accountId in the body must be ignored.
    const res = await POST(req('POST', { idempotencyKey: 'k1', accountId: 'attacker' }));
    expect(res.status).toBe(200);
    expect(createProPilotRequest).toHaveBeenCalledWith({ accountId: 'acct-1', roomId: null, idempotencyKey: 'k1' });
  });

  it('(2) a PRO Host is rejected with already_pro (409)', async () => {
    createProPilotRequest.mockResolvedValue({ ok: false, error: 'already_pro' });
    const res = await POST(req('POST', { idempotencyKey: 'k1' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: 'already_pro' });
  });

  it('(5) a room the account does not own → 403, create never attempted', async () => {
    state.ownsRoom = false;
    const res = await POST(req('POST', { idempotencyKey: 'k1', roomId: '11111111-1111-4111-8111-111111111111' }));
    expect(res.status).toBe(403);
    expect(createProPilotRequest).not.toHaveBeenCalled();
  });

  it('(5) an owned room is accepted as context', async () => {
    state.ownsRoom = true;
    createProPilotRequest.mockResolvedValue({ ok: true, requestId: 'r1', status: 'PENDING', reused: false });
    getHostProPilotState.mockResolvedValue({ plan: 'FREE', request: { status: 'PENDING', requestedAt: 't', decidedAt: null } });
    const roomId = '11111111-1111-4111-8111-111111111111';
    const res = await POST(req('POST', { idempotencyKey: 'k1', roomId }));
    expect(res.status).toBe(200);
    expect(createProPilotRequest).toHaveBeenCalledWith({ accountId: 'acct-1', roomId, idempotencyKey: 'k1' });
  });

  it('rejects a missing idempotency key (400)', async () => {
    const res = await POST(req('POST', {}));
    expect(res.status).toBe(400);
    expect(createProPilotRequest).not.toHaveBeenCalled();
  });
});
