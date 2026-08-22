import { describe, it, expect } from 'vitest';
import {
  adminAuthHeader,
  finalizeAdminAuth,
  isCookieCred,
  webReleaseClient,
  COOKIE_CRED,
} from './admin-auth';

describe('adminAuthHeader — provider-neutral, mode-aware', () => {
  // BUILD 26U-R2 — every request now also announces the web release client. The AUTHORIZATION
  // contract these cases exist to protect is unchanged and is still asserted exactly: cookie
  // mode and a missing credential still send NO Authorization header, and a real token still
  // sends exactly `Bearer <token>`. What is added is orthogonal, and is proved to be a WEB
  // classification (never native, never a credential).
  const CLIENT = 'x-bty-client';

  it('sends a Bearer header for a real token', () => {
    const h = adminAuthHeader('dev-tok');
    expect(h.authorization).toBe('Bearer dev-tok');
    expect(Object.keys(h).sort()).toEqual(['authorization', CLIENT]);
  });
  it('(15) sends NO Authorization for cookie mode (browser attaches bty_room); no provider in it', () => {
    const h = adminAuthHeader(COOKIE_CRED);
    expect(h.authorization).toBeUndefined();
    expect(Object.keys(h)).toEqual([CLIENT]);
  });
  it('sends no Authorization for a missing credential', () => {
    for (const cred of [null, '']) {
      const h = adminAuthHeader(cred);
      expect(h.authorization).toBeUndefined();
      expect(Object.keys(h)).toEqual([CLIENT]);
    }
  });
  it('the release client is always WEB, and carries no credential', () => {
    for (const cred of ['dev-tok', COOKIE_CRED, null, '']) {
      const v = adminAuthHeader(cred)[CLIENT];
      expect(v.startsWith('web/')).toBe(true);
      expect(v).not.toContain('native');
      expect(v).not.toContain('dev-tok');
    }
  });
  it('an absent or unusable build id still classifies as web', () => {
    expect(webReleaseClient()).toMatch(/^web\/[A-Za-z0-9._-]{1,64}$/);
  });
  it('the cookie sentinel is non-empty so `if (!cred)` guards still pass', () => {
    expect(Boolean(COOKIE_CRED)).toBe(true);
    expect(isCookieCred(COOKIE_CRED)).toBe(true);
    expect(isCookieCred('dev-tok')).toBe(false);
  });
});

describe('finalizeAdminAuth — Bearer-first, cookie fallback, transient never pairs', () => {
  it('(1) valid Bearer -> authed bearer', () => {
    expect(finalizeAdminAuth('ok', null)).toEqual({ phase: 'authed', mode: 'bearer' });
  });
  it('(2) Bearer preferred over cookie when both valid', () => {
    expect(finalizeAdminAuth('ok', 'ok')).toEqual({ phase: 'authed', mode: 'bearer' });
  });
  it('(3) no Bearer + valid cookie -> authed cookie', () => {
    expect(finalizeAdminAuth(null, 'ok')).toEqual({ phase: 'authed', mode: 'cookie' });
  });
  it('(5) no Bearer + cookie 401 -> need-auth (pairing)', () => {
    expect(finalizeAdminAuth(null, 'unauth')).toEqual({ phase: 'need-auth', mode: null });
  });
  it('(6) rejected Bearer + rejected cookie -> need-auth', () => {
    expect(finalizeAdminAuth('unauth', 'unauth')).toEqual({ phase: 'need-auth', mode: null });
  });
  it('(7)(8) transient cookie failure -> retry, NEVER pairing', () => {
    expect(finalizeAdminAuth(null, 'neterr')).toEqual({ phase: 'retry', mode: null });
  });
  it('a transient Bearer failure -> retry, never pairing', () => {
    expect(finalizeAdminAuth('neterr', null)).toEqual({ phase: 'retry', mode: null });
  });
  it('(11) a rejected Bearer with a transient cookie retries (no infinite pairing)', () => {
    expect(finalizeAdminAuth('unauth', 'neterr')).toEqual({ phase: 'retry', mode: null });
  });
  it('nothing probed yet -> need-auth only when both are definitive/absent', () => {
    expect(finalizeAdminAuth(null, null)).toEqual({ phase: 'need-auth', mode: null });
  });
});
