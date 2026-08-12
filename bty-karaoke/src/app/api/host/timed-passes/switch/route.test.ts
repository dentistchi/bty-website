// POST /api/host/timed-passes/switch — the Host continues on another owned pass (BUILD 26M).
//
// Pins the route's authority boundary: the account comes from the SESSION and never the body;
// an unauthenticated request is a uniform 401; an ineligible or already-consumed target is a 409
// rather than a silent success; and the CARRIED figure the client shows in its confirmation is
// passed through from the server rather than computed here.
//
// BUILD 26M-R2 withdrew residual forfeiture. Two assertions below previously encoded the forfeit
// contract as if it were the product rule; they are corrected rather than accommodated.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { account: null as { id: string } | null };

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: (h: string | null) => h?.replace(/^Bearer\s+/, '') ?? null }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: vi.fn(async () => state.account) }));

const switchTimedPass = vi.fn();
const getHostTimedPassInventory = vi.fn();
vi.mock('@/lib/timed-pass.server', () => ({
  switchTimedPass: (...a: unknown[]) => switchTimedPass(...a),
  getHostTimedPassInventory: (...a: unknown[]) => getHostTimedPassInventory(...a),
}));

import { POST } from './route';

const GRANT = '11111111-1111-1111-1111-111111111111';

function req(body?: unknown, auth = 'Bearer tok') {
  return new Request('https://x/api/host/timed-passes/switch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  switchTimedPass.mockReset();
  getHostTimedPassInventory.mockReset();
  getHostTimedPassInventory.mockResolvedValue({ state: { effectiveEntitlement: 'FREE' }, passes: [] });
});

describe('POST /api/host/timed-passes/switch', () => {
  it('unauthenticated → 401, and nothing is switched', async () => {
    state.account = null;
    const res = await POST(req({ passGrantId: GRANT }));
    expect(res.status).toBe(401);
    expect(switchTimedPass).not.toHaveBeenCalled();
  });

  it('derives the account from the session, never the body', async () => {
    switchTimedPass.mockResolvedValue({
      ok: true, passGrantId: GRANT, status: 'SELECTED', changed: true,
      switchedFromPassId: 'old', carriedSeconds: 121, effectiveWindowSeconds: 3721,
    });
    const res = await POST(req({ passGrantId: GRANT, accountId: 'attacker' }));
    expect(res.status).toBe(200);
    expect(switchTimedPass).toHaveBeenCalledWith({
      accountId: 'acct-1', passGrantId: GRANT, idempotencyKey: null,
    });
  });

  it('reports what was CARRIED, and the total the armed pass will be worth', async () => {
    switchTimedPass.mockResolvedValue({
      ok: true, passGrantId: GRANT, status: 'SELECTED', changed: true,
      switchedFromPassId: 'old-pass', carriedSeconds: 121, effectiveWindowSeconds: 3721,
    });
    const body = await (await POST(req({ passGrantId: GRANT }))).json();
    expect(body.ok).toBe(true);
    expect(body.carriedSeconds).toBe(121);
    // The client must never have to add 3600 + 121 itself.
    expect(body.effectiveWindowSeconds).toBe(3721);
    expect(body.switchedFromPassId).toBe('old-pass');
    // The withdrawn contract must not leak back into the payload.
    expect(body.forfeitedSeconds).toBeUndefined();
    // The refreshed inventory rides along so the client never renders a stale pass list after a
    // destructive change.
    expect(body.state).toBeDefined();
    expect(body.passes).toBeDefined();
  });

  it('an EXPIRED/REVOKED/ACTIVE target → 409 not_switchable (never a silent success)', async () => {
    switchTimedPass.mockResolvedValue({ ok: false, error: 'not_switchable', status: 'EXPIRED' });
    const res = await POST(req({ passGrantId: GRANT }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('not_switchable');
    expect(body.status).toBe('EXPIRED');
  });

  it('a pass belonging to someone else → 404, with no hint that it exists', async () => {
    switchTimedPass.mockResolvedValue({ ok: false, error: 'pass_not_found' });
    const res = await POST(req({ passGrantId: GRANT }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('pass_not_found');
  });

  it('a lost race → 409 switch_conflict, so the client refetches instead of retrying blindly', async () => {
    switchTimedPass.mockResolvedValue({ ok: false, error: 'switch_conflict' });
    const res = await POST(req({ passGrantId: GRANT }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('switch_conflict');
  });

  it('a replayed switch reports changed:false and does not transfer twice', async () => {
    switchTimedPass.mockResolvedValue({
      ok: true, passGrantId: GRANT, status: 'SELECTED', changed: false,
      switchedFromPassId: null, carriedSeconds: 121, effectiveWindowSeconds: 3721,
    });
    const body = await (await POST(req({ passGrantId: GRANT }))).json();
    expect(body.changed).toBe(false);
    // A replay reports the carry the target ALREADY holds — it must not read as a second transfer.
    expect(body.carriedSeconds).toBe(121);
    expect(body.switchedFromPassId).toBeNull();
  });

  it('rejects a malformed body and a non-uuid grant id without calling the RPC', async () => {
    expect((await POST(req(undefined))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ passGrantId: 'not-a-uuid' }))).status).toBe(400);
    expect(switchTimedPass).not.toHaveBeenCalled();
  });

  it('never caches a pass-state response', async () => {
    switchTimedPass.mockResolvedValue({
      ok: true, passGrantId: GRANT, status: 'SELECTED', changed: true,
      switchedFromPassId: null, carriedSeconds: 0, effectiveWindowSeconds: 3600,
    });
    const res = await POST(req({ passGrantId: GRANT }));
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
