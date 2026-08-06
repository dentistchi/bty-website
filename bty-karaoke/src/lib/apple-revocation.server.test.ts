// BUILD 26E — Apple revocation authority (client secret, exchange, revoke, crypto).
//
// The properties that matter: a misconfigured deployment is DETECTED rather than
// discovered at Apple; the client secret has exactly the claims Apple requires; a returned
// identity that is not this account's is REFUSED; retained tokens are authenticated
// ciphertext; and a transient failure is never mistaken for a permanent one.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('./env.server', () => ({
  optionalEnv: (k: string) => env[k],
  karaokeEnv: () => ({ url: 'https://x', key: 'k' }),
}));

const verifyAppleIdentityToken = vi.fn();
vi.mock('./apple-auth.server', () => ({
  verifyAppleIdentityToken: (...a: unknown[]) => verifyAppleIdentityToken(...a),
}));

import {
  appleClientSecret,
  appleRevocationConfig,
  appleRevocationConfigured,
  decryptRefreshToken,
  encryptRefreshToken,
  exchangeAppleAuthorizationCode,
  nextAttemptDelayMs,
  revokeAppleToken,
  TOKEN_ENCRYPTION_KEY_VERSION,
  type AppleRevocationConfig,
} from './apple-revocation.server';

// A real P-256 PKCS#8 key, generated for this test only. Not an Apple key, not a secret.
let TEST_PEM = '';
const KEY_HEX = 'a'.repeat(64);

beforeEach(async () => {
  for (const k of Object.keys(env)) delete env[k];
  verifyAppleIdentityToken.mockReset();
  if (!TEST_PEM) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ]);
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
    TEST_PEM = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  }
});

function configure(overrides: Record<string, string | undefined> = {}) {
  env.KARAOKE_APPLE_REVOCATION_PRIVATE_KEY = TEST_PEM;
  env.KARAOKE_APPLE_REVOCATION_KEY_ID = 'ABCDE12345';
  env.KARAOKE_APPLE_REVOCATION_TEAM_ID = 'CS92W2HFCH';
  env.KARAOKE_APPLE_REVOCATION_CLIENT_ID = 'com.bty.BTYNorebangAdmin';
  env.KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY = KEY_HEX;
  for (const [k, v] of Object.entries(overrides)) env[k] = v;
}
function cfg(): AppleRevocationConfig {
  const r = appleRevocationConfig();
  if (!r.ok) throw new Error('config not ok');
  return r.config;
}

describe('configuration is a DEPLOYMENT BLOCKER', () => {
  it('(1) reports unconfigured when nothing is set', () => {
    expect(appleRevocationConfigured()).toBe(false);
    const r = appleRevocationConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toHaveLength(5);
  });

  it('(2) accepts a complete, well-formed configuration', () => {
    configure();
    expect(appleRevocationConfigured()).toBe(true);
  });

  it.each([
    ['KARAOKE_APPLE_REVOCATION_PRIVATE_KEY', 'not-a-pem'],
    ['KARAOKE_APPLE_REVOCATION_KEY_ID', 'short'],
    ['KARAOKE_APPLE_REVOCATION_TEAM_ID', ''],
    ['KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY', 'zz'],
  ])('(3) rejects a MALFORMED %s, not just an absent one', (key, bad) => {
    configure({ [key]: bad });
    const r = appleRevocationConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain(key);
  });

  it('(4) rejects a client id that is not reverse-DNS (a Services ID / URL paste)', () => {
    configure({ KARAOKE_APPLE_REVOCATION_CLIENT_ID: 'https://example.com/callback' });
    const r = appleRevocationConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain('KARAOKE_APPLE_REVOCATION_CLIENT_ID');
  });

  it('(5) never reveals WHICH secret is missing through the boolean predicate', () => {
    configure({ KARAOKE_APPLE_REVOCATION_KEY_ID: undefined });
    expect(appleRevocationConfigured()).toBe(false);
  });
});

describe('client secret (ES256)', () => {
  it('(6) carries exactly the claims Apple requires', async () => {
    configure();
    const jwt = await appleClientSecret(cfg(), 1_000_000);
    const [h, p] = jwt.split('.');
    const dec = (seg: string) =>
      JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(seg.length / 4) * 4, '=')));
    expect(dec(h)).toEqual({ alg: 'ES256', kid: 'ABCDE12345', typ: 'JWT' });
    const payload = dec(p);
    expect(payload.iss).toBe('CS92W2HFCH'); //            Team ID
    expect(payload.sub).toBe('com.bty.BTYNorebangAdmin'); // the NATIVE client
    expect(payload.aud).toBe('https://appleid.apple.com');
    expect(payload.iat).toBe(1_000_000);
  });

  it('(7) is SHORT-lived — a revocation needs no standing authority', async () => {
    configure();
    const jwt = await appleClientSecret(cfg(), 1_000_000);
    const p = JSON.parse(
      atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(jwt.split('.')[1].length / 4) * 4, '=')),
    );
    expect(p.exp - p.iat).toBeLessThanOrEqual(600);
  });

  it('(8) produces three base64url segments and no padding', async () => {
    configure();
    const jwt = await appleClientSecret(cfg());
    expect(jwt.split('.')).toHaveLength(3);
    expect(jwt).not.toMatch(/[+/=]/);
  });
});

describe('authenticated encryption of the retained refresh token', () => {
  it('(9) round-trips and stamps a key version', async () => {
    const enc = await encryptRefreshToken('refresh-token-value', KEY_HEX);
    expect(enc.keyVersion).toBe(TOKEN_ENCRYPTION_KEY_VERSION);
    expect(await decryptRefreshToken(enc, KEY_HEX)).toBe('refresh-token-value');
  });

  it('(10) never stores the plaintext', async () => {
    const enc = await encryptRefreshToken('refresh-token-value', KEY_HEX);
    expect(enc.ciphertext).not.toContain('refresh-token-value');
    expect(JSON.stringify(enc)).not.toContain('refresh-token-value');
  });

  it('(11) uses a fresh IV per encryption (GCM IV reuse would be catastrophic)', async () => {
    const a = await encryptRefreshToken('same', KEY_HEX);
    const b = await encryptRefreshToken('same', KEY_HEX);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('(12) REFUSES tampered ciphertext — the GCM tag is checked', async () => {
    const enc = await encryptRefreshToken('refresh-token-value', KEY_HEX);
    const bytes = atob(enc.ciphertext).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    const tampered = { ...enc, ciphertext: btoa(bytes.join('')) };
    expect(await decryptRefreshToken(tampered, KEY_HEX)).toBeNull();
  });

  it('(13) returns null (never throws a reason) under the wrong key', async () => {
    const enc = await encryptRefreshToken('v', KEY_HEX);
    expect(await decryptRefreshToken(enc, 'b'.repeat(64))).toBeNull();
  });
});

describe('authorization-code exchange', () => {
  const okTokenResponse = () =>
    new Response(JSON.stringify({ refresh_token: 'rt-1', id_token: 'idt-1' }), { status: 200 });

  it('(14) exchanges server-side and returns the verified subject', async () => {
    configure();
    verifyAppleIdentityToken.mockResolvedValue({ ok: true, subject: 'apple-sub-1' });
    const fetchImpl = vi.fn(async () => okTokenResponse());
    const r = await exchangeAppleAuthorizationCode({
      authorizationCode: 'code-1',
      expectedSubject: 'apple-sub-1',
      config: cfg(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: true, refreshToken: 'rt-1', subject: 'apple-sub-1' });
    // The code goes to Apple's token endpoint, in a POST body — never a query string.
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://appleid.apple.com/auth/token');
    expect(String(url)).not.toContain('code-1');
    expect(String(init.body)).toContain('grant_type=authorization_code');
  });

  it('(15) REFUSES an identity that resolves to a different subject', async () => {
    configure();
    verifyAppleIdentityToken.mockResolvedValue({ ok: true, subject: 'someone-else' });
    const r = await exchangeAppleAuthorizationCode({
      authorizationCode: 'code-1',
      expectedSubject: 'apple-sub-1',
      config: cfg(),
      fetchImpl: (async () => okTokenResponse()) as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, code: 'subject_mismatch' });
  });

  it('(16) never decode-and-trusts: an unverified id_token is refused', async () => {
    configure();
    verifyAppleIdentityToken.mockResolvedValue({ ok: false, code: 'bad_signature' });
    const r = await exchangeAppleAuthorizationCode({
      authorizationCode: 'code-1',
      expectedSubject: 'apple-sub-1',
      config: cfg(),
      fetchImpl: (async () => okTokenResponse()) as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, code: 'identity_unverified' });
  });

  it('(17) a REPLAYED or expired code (Apple 4xx) is invalid_code, not transient', async () => {
    configure();
    const r = await exchangeAppleAuthorizationCode({
      authorizationCode: 'used-already',
      expectedSubject: 'apple-sub-1',
      config: cfg(),
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, code: 'invalid_code' });
  });

  it('(18) an Apple 5xx is TRANSIENT, never a permanent refusal', async () => {
    configure();
    const r = await exchangeAppleAuthorizationCode({
      authorizationCode: 'c',
      expectedSubject: 's',
      config: cfg(),
      fetchImpl: (async () => new Response('', { status: 503 })) as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, code: 'transient' });
  });

  it('(19) a response without a refresh_token cannot be used to revoke', async () => {
    configure();
    verifyAppleIdentityToken.mockResolvedValue({ ok: true, subject: 's' });
    const r = await exchangeAppleAuthorizationCode({
      authorizationCode: 'c',
      expectedSubject: 's',
      config: cfg(),
      fetchImpl: (async () =>
        new Response(JSON.stringify({ id_token: 'i' }), { status: 200 })) as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, code: 'invalid_code' });
  });
});

describe('revocation outcomes', () => {
  it('(20) a 200 is revoked', async () => {
    configure();
    const r = await revokeAppleToken({
      refreshToken: 'rt',
      config: cfg(),
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
    });
    expect(r).toEqual({ outcome: 'revoked' });
  });

  it('(21) 5xx and 429 are RETRYABLE — the token must be kept', async () => {
    configure();
    for (const status of [500, 502, 429]) {
      const r = await revokeAppleToken({
        refreshToken: 'rt',
        config: cfg(),
        fetchImpl: (async () => new Response('', { status })) as unknown as typeof fetch,
      });
      expect(r.outcome).toBe('retryable');
    }
  });

  it('(22) a 4xx is PERMANENT — retrying cannot change it', async () => {
    configure();
    const r = await revokeAppleToken({
      refreshToken: 'rt',
      config: cfg(),
      fetchImpl: (async () => new Response('', { status: 400 })) as unknown as typeof fetch,
    });
    expect(r.outcome).toBe('permanent');
  });

  it('(23) a transport failure is retryable, never permanent', async () => {
    configure();
    const r = await revokeAppleToken({
      refreshToken: 'rt',
      config: cfg(),
      fetchImpl: (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    });
    expect(r).toEqual({ outcome: 'retryable', code: 'network' });
  });

  it('(24) never surfaces an Apple response body', async () => {
    configure();
    const r = await revokeAppleToken({
      refreshToken: 'rt',
      config: cfg(),
      fetchImpl: (async () =>
        new Response('{"error":"secret-ish detail"}', { status: 400 })) as unknown as typeof fetch,
    });
    expect(JSON.stringify(r)).not.toContain('secret-ish');
  });

  it('(25) backoff grows and is bounded', () => {
    expect(nextAttemptDelayMs(1)).toBe(60_000);
    expect(nextAttemptDelayMs(2)).toBe(120_000);
    expect(nextAttemptDelayMs(99)).toBe(6 * 60 * 60 * 1000);
  });
});
