// CSRF protection for cookie-authenticated Host web routes (Phase 2 §4).
// SameSite=Lax is a mitigation; these prove the explicit server-side check.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { csrfTokenFor, verifyHostCsrf, csrfFromForm, allowedOrigins } from './host-csrf.server';

const ORIGIN = 'https://bty-karaoke.ywamer2022.workers.dev';
const SESSION = 'host-session-token-abc';

function makeReq(headers: Record<string, string>, origin = ORIGIN) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    nextUrl: { origin, protocol: new URL(origin).protocol },
  } as never;
}

beforeEach(() => { vi.unstubAllEnvs(); vi.stubEnv('KARAOKE_CAP_SECRET', 'test-secret'); });
afterEach(() => vi.unstubAllEnvs());

describe('token derivation', () => {
  it('is deterministic per session and different across sessions', async () => {
    const a = await csrfTokenFor(SESSION);
    expect(await csrfTokenFor(SESSION)).toBe(a);
    expect(await csrfTokenFor('another-session')).not.toBe(a);
  });

  it('is not the session token itself and is long enough to resist guessing', async () => {
    const t = await csrfTokenFor(SESSION);
    expect(t).not.toBe(SESSION);
    expect(t).not.toContain(SESSION);
    expect(t.length).toBeGreaterThanOrEqual(64);   // HMAC-SHA256 hex
  });

  it('rotates implicitly when the Host session is replaced', async () => {
    // Replacing the session (login/rotation) invalidates every prior CSRF token.
    expect(await csrfTokenFor('session-v1')).not.toBe(await csrfTokenFor('session-v2'));
  });
});

describe('verifyHostCsrf', () => {
  it('accepts a valid token from an allowed Origin', async () => {
    const t = await csrfTokenFor(SESSION);
    expect(await verifyHostCsrf(makeReq({ origin: ORIGIN }), SESSION, t)).toEqual({ ok: true });
  });

  it('rejects a MISSING token', async () => {
    const r = await verifyHostCsrf(makeReq({ origin: ORIGIN }), SESSION, null);
    expect(r).toMatchObject({ ok: false, reason: 'missing_token' });
  });

  it('rejects a WRONG token', async () => {
    const r = await verifyHostCsrf(makeReq({ origin: ORIGIN }), SESSION, 'deadbeef'.repeat(8));
    expect(r).toMatchObject({ ok: false, reason: 'bad_token' });
  });

  it("rejects another session's token (tokens are session-bound)", async () => {
    const other = await csrfTokenFor('someone-elses-session');
    const r = await verifyHostCsrf(makeReq({ origin: ORIGIN }), SESSION, other);
    expect(r).toMatchObject({ ok: false, reason: 'bad_token' });
  });

  it('rejects a WRONG Origin even with a valid token', async () => {
    const t = await csrfTokenFor(SESSION);
    const r = await verifyHostCsrf(makeReq({ origin: 'https://evil.example.com' }), SESSION, t);
    expect(r).toMatchObject({ ok: false, reason: 'bad_origin' });
  });

  it('rejects when BOTH Origin and Referer are absent (never assumes same-site)', async () => {
    const t = await csrfTokenFor(SESSION);
    expect(await verifyHostCsrf(makeReq({}), SESSION, t)).toMatchObject({ ok: false, reason: 'no_origin' });
  });

  it('falls back to Referer origin only when Origin is absent', async () => {
    const t = await csrfTokenFor(SESSION);
    expect(await verifyHostCsrf(makeReq({ referer: `${ORIGIN}/host` }), SESSION, t)).toEqual({ ok: true });
    expect(await verifyHostCsrf(makeReq({ referer: 'https://evil.example.com/x' }), SESSION, t))
      .toMatchObject({ ok: false, reason: 'bad_origin' });
  });

  it('rejects when there is no Host session at all', async () => {
    expect(await verifyHostCsrf(makeReq({ origin: ORIGIN }), null, 'anything'))
      .toMatchObject({ ok: false, reason: 'no_session' });
  });

  it('allows the measured local dev origin', () => {
    expect(allowedOrigins(makeReq({}, 'http://localhost:3002'))).toContain('http://localhost:3002');
  });
});

describe('csrfFromForm', () => {
  it('extracts a non-empty token, else null', () => {
    const f = new FormData(); f.set('csrf', 'abc');
    expect(csrfFromForm(f)).toBe('abc');
    const empty = new FormData(); empty.set('csrf', '');
    expect(csrfFromForm(empty)).toBeNull();
    expect(csrfFromForm(null)).toBeNull();
  });
});
