// POST /api/host/timezone — one-time capture wiring. Auth required; delegates to the
// atomic, eligibility-gated capture RPC (mocked here). No app-level TOCTOU.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { account: { id: 'acct-1' } as null | { id: string }, outcome: 'ok' };
const capture = vi.fn(async (_a: string, _tz: string) => ({ outcome: state.outcome }));

vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: async () => state.account }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => 'host-token' }));
vi.mock('@/lib/metering.server', () => ({ captureAccountTimezone: (a: string, tz: string) => capture(a, tz) }));

import { POST } from './route';

function req(body: unknown) {
  return new Request('https://x/api/host/timezone', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.outcome = 'ok';
  capture.mockClear();
});

describe('POST /api/host/timezone', () => {
  it('captures a valid timezone for an authenticated Host', async () => {
    const res = await POST(req({ timezone: 'America/Los_Angeles' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: 'ok' });
    expect(capture).toHaveBeenCalledWith('acct-1', 'America/Los_Angeles');
  });

  it('unauthenticated → 401, never touches the RPC', async () => {
    state.account = null;
    const res = await POST(req({ timezone: 'America/Los_Angeles' }));
    expect(res.status).toBe(401);
    expect(capture).not.toHaveBeenCalled();
  });

  it('missing/invalid timezone field → 400, never touches the RPC', async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ timezone: 123 }))).status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
  });

  it('an invalid IANA name from the RPC → 400', async () => {
    state.outcome = 'invalid_timezone';
    const res = await POST(req({ timezone: 'Not/AZone' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, outcome: 'invalid_timezone' });
  });

  it('ineligible (already captured / usage started) → 200 with the honest outcome', async () => {
    state.outcome = 'locked_usage_started';
    const res = await POST(req({ timezone: 'America/Los_Angeles' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, outcome: 'locked_usage_started' });
  });
});
