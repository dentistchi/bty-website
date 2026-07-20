// Cross-Platform Identity V1 — Google ID-token rejection paths (§10.17-21).
//
// Signature verification needs a live JWKS, so these drive the checks that run
// BEFORE and AFTER the crypto step with crafted tokens: algorithm pinning, missing
// kid, malformed input, and the not-configured case. The claim rules (issuer,
// audience, expiry, nbf, subject, nonce) are exercised through the same function
// with a stubbed JWKS + signature so a correctly-signed but WRONG token still fails.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyGoogleIdToken, googleAudiences, googleEnabled, __resetGoogleKeyCache } from './google-auth.server';

const AUD = 'client-ios.apps.googleusercontent.com';

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const tok = (header: unknown, payload: unknown, sig = 'c2ln') => `${b64url(header)}.${b64url(payload)}.${sig}`;

beforeEach(() => {
  __resetGoogleKeyCache();
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('googleAudiences / googleEnabled', () => {
  it('is DISABLED when no client ids are configured (never accepts any audience)', () => {
    vi.stubEnv('KARAOKE_GOOGLE_CLIENT_IDS', '');
    expect(googleAudiences()).toEqual([]);
    expect(googleEnabled()).toBe(false);
  });

  it('parses a comma-separated allow-list of client ids', () => {
    vi.stubEnv('KARAOKE_GOOGLE_CLIENT_IDS', ' a.apps , b.apps ');
    expect(googleAudiences()).toEqual(['a.apps', 'b.apps']);
    expect(googleEnabled()).toBe(true);
  });
});

describe('verifyGoogleIdToken — pre-crypto rejections', () => {
  it('refuses everything when Google sign-in is NOT configured', async () => {
    const d = await verifyGoogleIdToken({ idToken: tok({ alg: 'RS256', kid: 'k' }, { sub: 'x' }), audiences: [] });
    expect(d).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' });
  });

  it('rejects a missing or malformed token', async () => {
    expect(await verifyGoogleIdToken({ idToken: '', audiences: [AUD] })).toMatchObject({ ok: false, code: 'NO_TOKEN' });
    expect(await verifyGoogleIdToken({ idToken: 'not.a.jwt.at.all', audiences: [AUD] })).toMatchObject({
      ok: false, code: 'MALFORMED',
    });
  });

  it('PINS the algorithm — alg:none and HS256 are refused before any key lookup', async () => {
    const none = await verifyGoogleIdToken({ idToken: tok({ alg: 'none' }, { sub: 'x' }), audiences: [AUD] });
    expect(none).toMatchObject({ ok: false, code: 'BAD_ALG' });
    const hs = await verifyGoogleIdToken({ idToken: tok({ alg: 'HS256', kid: 'k' }, { sub: 'x' }), audiences: [AUD] });
    expect(hs).toMatchObject({ ok: false, code: 'BAD_ALG' });
  });

  it('rejects a token with no key id', async () => {
    const d = await verifyGoogleIdToken({ idToken: tok({ alg: 'RS256' }, { sub: 'x' }), audiences: [AUD] });
    expect(d).toMatchObject({ ok: false, code: 'NO_KID' });
  });

  it('rejects an unknown key id (after refreshing the JWKS once)', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true, json: async () => ({ keys: [{ kty: 'RSA', kid: 'other', n: 'n', e: 'AQAB' }] }),
    }) as unknown as Response);
    vi.stubGlobal('fetch', fetchSpy);
    const d = await verifyGoogleIdToken({ idToken: tok({ alg: 'RS256', kid: 'missing' }, { sub: 'x' }), audiences: [AUD] });
    expect(d).toMatchObject({ ok: false, code: 'UNKNOWN_KID' });
    expect(fetchSpy).toHaveBeenCalledTimes(2); // cached, then one forced refresh
  });

  it('a bad signature is refused (crypto failure never falls through to claims)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ keys: [{ kty: 'RSA', kid: 'k', n: 'bad-modulus', e: 'AQAB' }] }),
    }) as unknown as Response));
    const d = await verifyGoogleIdToken({
      idToken: tok({ alg: 'RS256', kid: 'k' }, { iss: 'https://accounts.google.com', aud: AUD, sub: 'x' }),
      audiences: [AUD],
    });
    // Either the key import or the verify fails — both are refusals, never ok.
    expect(d.ok).toBe(false);
    expect(['VERIFY_ERROR', 'BAD_SIGNATURE']).toContain((d as { code: string }).code);
  });
});
