import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { enabled: true, correct: 'right-pass' };
vi.mock('@/lib/manager-auth.server', () => ({
  MANAGER_COOKIE: 'bty_mgr',
  MANAGER_SESSION_TTL_MS: 12 * 60 * 60 * 1000,
  managerEnabled: () => state.enabled,
  verifyManagerPasscode: (p: string | null | undefined) => p === state.correct,
  signManagerSession: async () => 'signed-manager-token',
}));

// Rate limiter unavailable in unit env (no secret/KV) -> best-effort skip.
vi.mock('@/lib/rate-limit.server', () => ({
  makeLimiter: async () => null,
  isLockedOut: async () => false,
  recordFailure: async () => {},
  recordSuccess: async () => {},
}));

import { POST, DELETE } from './route';

function makeReq(body: unknown) {
  return {
    headers: { get: () => null },
    nextUrl: { protocol: 'https:' },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  state.enabled = true;
});

describe('POST /api/manager/session', () => {
  it('rejects a wrong passcode with a uniform 401 and NO token in the body', async () => {
    const res = await POST(makeReq({ passcode: 'nope' }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.managerToken).toBeUndefined();
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('returns the SAME uniform 401 when the feature is not configured (no config leak)', async () => {
    state.enabled = false;
    const res = await POST(makeReq({ passcode: 'right-pass' }));
    expect(res.status).toBe(401); // not 503 — indistinguishable from a wrong passcode
    const data = await res.json();
    expect(data.error).toBe('That passcode is not valid.');
  });

  it('sets an HttpOnly, SameSite=Lax session cookie on success and returns no token', async () => {
    const res = await POST(makeReq({ passcode: 'right-pass' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.managerToken).toBeUndefined();
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('bty_mgr=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(cookie.toLowerCase()).toContain('secure');
  });

  it('rejects a malformed body with a uniform 401', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/manager/session', () => {
  it('clears the session cookie', async () => {
    const res = await DELETE(makeReq({}));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('bty_mgr=');
    expect(cookie.toLowerCase()).toContain('max-age=0');
  });
});
