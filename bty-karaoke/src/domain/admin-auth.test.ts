import { describe, it, expect } from 'vitest';
import { adminAuthHeader, finalizeAdminAuth, isCookieCred, COOKIE_CRED } from './admin-auth';

describe('adminAuthHeader — provider-neutral, mode-aware', () => {
  it('sends a Bearer header for a real token', () => {
    expect(adminAuthHeader('dev-tok')).toEqual({ authorization: 'Bearer dev-tok' });
  });
  it('(15) sends NO header for cookie mode (browser attaches bty_room); no provider in the header', () => {
    expect(adminAuthHeader(COOKIE_CRED)).toEqual({});
  });
  it('sends no header for a missing credential', () => {
    expect(adminAuthHeader(null)).toEqual({});
    expect(adminAuthHeader('')).toEqual({});
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
