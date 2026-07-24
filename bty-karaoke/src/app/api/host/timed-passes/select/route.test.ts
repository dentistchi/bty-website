// POST /api/host/timed-passes/select — a Host selects a pass to use (BUILD 17 §5/Gate B).
//
// Pins: the account is derived from the SESSION (never the body); selection sets no clock;
// an unauthenticated request is a uniform 401; a non-selectable pass is a 409.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { account: null as { id: string } | null };

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: (h: string | null) => h?.replace(/^Bearer\s+/, '') ?? null }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: vi.fn(async () => state.account) }));

const selectTimedPass = vi.fn();
const getHostTimedPassInventory = vi.fn();
vi.mock('@/lib/timed-pass.server', () => ({
  selectTimedPass: (...a: unknown[]) => selectTimedPass(...a),
  getHostTimedPassInventory: (...a: unknown[]) => getHostTimedPassInventory(...a),
}));

import { POST } from './route';

function req(body?: unknown, auth = 'Bearer tok') {
  return new Request('https://x/api/host/timed-passes/select', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  selectTimedPass.mockReset();
  getHostTimedPassInventory.mockReset();
});

describe('POST /api/host/timed-passes/select', () => {
  it('unauthenticated → 401, never selects', async () => {
    state.account = null;
    const res = await POST(req({ passGrantId: '11111111-1111-1111-1111-111111111111' }));
    expect(res.status).toBe(401);
    expect(selectTimedPass).not.toHaveBeenCalled();
  });

  it('derives the account from the session (never the body) and selects', async () => {
    selectTimedPass.mockResolvedValue({ ok: true, passGrantId: 'g1', status: 'SELECTED', changed: true });
    getHostTimedPassInventory.mockResolvedValue({ state: { effectiveEntitlement: 'FREE' }, passes: [] });
    const res = await POST(req({ passGrantId: '11111111-1111-1111-1111-111111111111', accountId: 'attacker' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // account came from the session, not the body's accountId
    expect(selectTimedPass).toHaveBeenCalledWith({
      accountId: 'acct-1', passGrantId: '11111111-1111-1111-1111-111111111111', idempotencyKey: null,
    });
  });

  it('a non-selectable (revoked/expired/active) pass → 409', async () => {
    selectTimedPass.mockResolvedValue({ ok: false, error: 'not_selectable', status: 'REVOKED' });
    const res = await POST(req({ passGrantId: '11111111-1111-1111-1111-111111111111' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('not_selectable');
  });

  it('rejects a malformed body (missing passGrantId)', async () => {
    const res = await POST(req({ foo: 'bar' }));
    expect(res.status).toBe(400);
    expect(selectTimedPass).not.toHaveBeenCalled();
  });
});
