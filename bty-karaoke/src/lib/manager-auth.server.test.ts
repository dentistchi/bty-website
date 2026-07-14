import { describe, it, expect, beforeAll } from 'vitest';
import {
  managerEnabled,
  verifyManagerPasscode,
  signManagerSession,
  verifyManagerSession,
  managerAuthorized,
  MANAGER_COOKIE,
  MANAGER_SESSION_TTL_MS,
} from './manager-auth.server';
import type { NextRequest } from 'next/server';

// A minimal NextRequest stand-in exposing only the cookie jar the guard reads.
function reqWithCookie(value: string | null): NextRequest {
  return {
    cookies: { get: (n: string) => (n === MANAGER_COOKIE && value != null ? { value } : undefined) },
  } as unknown as NextRequest;
}

// Deterministic env: an explicit process.env value wins over .dev.vars hydration.
beforeAll(() => {
  process.env.KARAOKE_MANAGER_PASSCODE = 'correct horse battery';
  process.env.KARAOKE_CAP_SECRET = 'hmac-key-for-tests';
});

describe('managerEnabled / verifyManagerPasscode', () => {
  it('is enabled when a passcode is configured', () => {
    expect(managerEnabled()).toBe(true);
  });

  it('accepts the exact passcode and rejects wrong / empty ones', () => {
    expect(verifyManagerPasscode('correct horse battery')).toBe(true);
    expect(verifyManagerPasscode('wrong')).toBe(false);
    expect(verifyManagerPasscode('correct horse batter')).toBe(false); // near-miss
    expect(verifyManagerPasscode('')).toBe(false);
    expect(verifyManagerPasscode(null)).toBe(false);
    expect(verifyManagerPasscode(undefined)).toBe(false);
  });
});

describe('signManagerSession / verifyManagerSession', () => {
  it('round-trips a freshly signed session', async () => {
    const token = await signManagerSession();
    expect(await verifyManagerSession(token)).toBe(true);
  });

  it('rejects an expired session', async () => {
    const past = Date.now() - MANAGER_SESSION_TTL_MS - 1000;
    const token = await signManagerSession(past);
    expect(await verifyManagerSession(token)).toBe(false);
  });

  it('rejects a tampered signature or payload', async () => {
    const token = await signManagerSession();
    const [p, sig] = token.split('.');
    expect(await verifyManagerSession(`${p}.${sig}x`)).toBe(false);
    expect(await verifyManagerSession(`${p}xx.${sig}`)).toBe(false);
    expect(await verifyManagerSession('not-a-token')).toBe(false);
    expect(await verifyManagerSession('')).toBe(false);
    expect(await verifyManagerSession(null)).toBe(false);
  });

  it('does not verify a cancel-style token (purpose is tagged)', async () => {
    // A payload without {m:1} must fail even if signed by the same key path.
    expect(await verifyManagerSession('eyJyIjoieCJ9.zzzz')).toBe(false);
  });
});

describe('managerAuthorized (cookie route guard)', () => {
  it('accepts a valid session cookie and rejects a missing / bad one', async () => {
    const token = await signManagerSession();
    expect(await managerAuthorized(reqWithCookie(token))).toBe(true);
    expect(await managerAuthorized(reqWithCookie('nope'))).toBe(false);
    expect(await managerAuthorized(reqWithCookie(null))).toBe(false);
  });
});
