// Google Login + Android Web Access V1 — OAuth security invariants.
//
// These prove the parts that protect the browser flow: fail-closed configuration,
// open-redirect prevention, one-time bounded transactions, PKCE derivation, and
// that no secret ever travels in a URL.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  googleWebConfig, googleWebConfigured, googleRedirectUri, publicOrigin,
  newOAuthTransaction, safeReturnTo, transactionExpired, pkceChallenge,
  googleAuthorizeUrl, exchangeCodeForIdToken, GOOGLE_SCOPES, OAUTH_TX_TTL_MS,
} from './google-oauth.server';

const ORIGIN = 'https://bty-karaoke.ywamer2022.workers.dev';

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function configure() {
  vi.stubEnv('KARAOKE_GOOGLE_WEB_CLIENT_ID', 'client-web.apps.googleusercontent.com');
  vi.stubEnv('KARAOKE_GOOGLE_WEB_CLIENT_SECRET', 'test-secret');
}

describe('configuration — fail closed', () => {
  it('is NOT configured when either half is missing', () => {
    expect(googleWebConfigured()).toBe(false);
    expect(googleWebConfig(ORIGIN)).toBeNull();

    vi.stubEnv('KARAOKE_GOOGLE_WEB_CLIENT_ID', 'id-only.apps.googleusercontent.com');
    expect(googleWebConfigured()).toBe(false);       // secret still missing
    expect(googleWebConfig(ORIGIN)).toBeNull();
  });

  it('is configured only when BOTH the client id and secret exist', () => {
    configure();
    expect(googleWebConfigured()).toBe(true);
    expect(googleWebConfig(ORIGIN)).toMatchObject({
      clientId: 'client-web.apps.googleusercontent.com',
      redirectUri: `${ORIGIN}/host/auth/google/callback`,
    });
  });

  it('never invents a placeholder client id', () => {
    expect(googleWebConfig(ORIGIN)).toBeNull();      // not an object with a fake id
  });

  it('uses the canonical public origin when configured, else the request origin', () => {
    expect(publicOrigin('http://localhost:3002')).toBe('http://localhost:3002');
    vi.stubEnv('KARAOKE_PUBLIC_ORIGIN', 'https://norebang.example.com/');
    expect(publicOrigin('http://localhost:3002')).toBe('https://norebang.example.com');
    expect(googleRedirectUri('http://localhost:3002'))
      .toBe('https://norebang.example.com/host/auth/google/callback');
  });

  it('an explicit redirect URI overrides derivation (must match Google byte-for-byte)', () => {
    vi.stubEnv('KARAOKE_GOOGLE_REDIRECT_URI', 'https://x.test/host/auth/google/callback');
    expect(googleRedirectUri(ORIGIN)).toBe('https://x.test/host/auth/google/callback');
  });
});

describe('open-redirect prevention (safeReturnTo)', () => {
  it('allows only internal /host paths', () => {
    expect(safeReturnTo('/host')).toBe('/host');
    expect(safeReturnTo('/host/account')).toBe('/host/account');
  });

  it('rejects absolute, protocol-relative and scheme-bearing destinations', () => {
    for (const evil of [
      'https://evil.example.com',
      '//evil.example.com',
      'http://evil.example.com/host',
      'javascript:alert(1)',
      '/\\evil.example.com',
      '/host\\..\\evil',
      '/host\nSet-Cookie: x=1',
    ]) {
      expect(safeReturnTo(evil)).toBe('/host');
    }
  });

  it('rejects internal paths outside /host (keeps the blast radius small)', () => {
    expect(safeReturnTo('/admin')).toBe('/host');
    expect(safeReturnTo('/r/bty-home/dj')).toBe('/host');
  });

  it('defaults safely for empty input', () => {
    expect(safeReturnTo(null)).toBe('/host');
    expect(safeReturnTo(undefined)).toBe('/host');
    expect(safeReturnTo('')).toBe('/host');
  });
});

describe('transactions — unique, bounded, one-time', () => {
  it('mints unguessable, distinct state / verifier / nonce every time', () => {
    const a = newOAuthTransaction('/host');
    const b = newOAuthTransaction('/host');
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.nonce).not.toBe(b.nonce);
    // Enough entropy to resist guessing.
    expect(a.state.length).toBeGreaterThanOrEqual(32);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43); // PKCE minimum
    // state and verifier are distinct secrets, never the same value.
    expect(a.state).not.toBe(a.verifier);
  });

  it('sanitises returnTo at mint time', () => {
    expect(newOAuthTransaction('https://evil.example.com').returnTo).toBe('/host');
  });

  it('expires after the bounded TTL', () => {
    const tx = newOAuthTransaction('/host');
    expect(transactionExpired(tx, tx.createdAt + 1000)).toBe(false);
    expect(transactionExpired(tx, tx.createdAt + OAUTH_TX_TTL_MS + 1)).toBe(true);
  });
});

describe('PKCE + authorize URL', () => {
  it('derives an S256 challenge that differs from the verifier', async () => {
    const tx = newOAuthTransaction('/host');
    const challenge = await pkceChallenge(tx.verifier);
    expect(challenge).not.toBe(tx.verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    // Deterministic for a given verifier.
    expect(await pkceChallenge(tx.verifier)).toBe(challenge);
  });

  it('sends state + challenge but NEVER the verifier or nonce secret material', async () => {
    configure();
    const config = googleWebConfig(ORIGIN)!;
    const tx = newOAuthTransaction('/host');
    const challenge = await pkceChallenge(tx.verifier);
    const url = googleAuthorizeUrl(config, tx, challenge);

    expect(url).toContain('response_type=code');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain(encodeURIComponent(challenge));
    expect(url).toContain(encodeURIComponent(tx.state));
    // THE critical negative: the PKCE verifier must never leave the server.
    expect(url).not.toContain(tx.verifier);
    // Identity scopes only — no offline access, so no refresh token is issued.
    // (URLSearchParams encodes spaces as '+', so parse rather than string-match.)
    expect(new URL(url).searchParams.get('scope')).toBe(GOOGLE_SCOPES);
    expect(url).not.toContain('access_type=offline');
    expect(url).not.toContain('refresh');
  });

  it('requests only openid/email/profile', () => {
    expect(GOOGLE_SCOPES.split(' ').sort()).toEqual(['email', 'openid', 'profile']);
  });
});

describe('code exchange', () => {
  it('returns the id token on success and discards everything else', async () => {
    configure();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ id_token: 'ID', access_token: 'ACCESS', refresh_token: 'REFRESH' }),
    }) as unknown as Response));
    const r = await exchangeCodeForIdToken(googleWebConfig(ORIGIN)!, 'code', 'verifier');
    expect(r).toEqual({ ok: true, idToken: 'ID' });
    // Only the id token is surfaced; access/refresh are never returned upward.
    expect(JSON.stringify(r)).not.toContain('ACCESS');
    expect(JSON.stringify(r)).not.toContain('REFRESH');
  });

  it('fails closed on a non-2xx exchange without echoing Google’s error body', async () => {
    configure();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'invalid_grant', code: 'SECRET-CODE-VALUE' }),
    }) as unknown as Response));
    const r = await exchangeCodeForIdToken(googleWebConfig(ORIGIN)!, 'code', 'verifier');
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain('SECRET-CODE-VALUE');
  });

  it('fails closed when Google returns no id token, and on network failure', async () => {
    configure();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response));
    expect((await exchangeCodeForIdToken(googleWebConfig(ORIGIN)!, 'c', 'v')).ok).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await exchangeCodeForIdToken(googleWebConfig(ORIGIN)!, 'c', 'v')).ok).toBe(false);
  });
});
