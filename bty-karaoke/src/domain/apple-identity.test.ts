// Host Account V1 — every rejection path of Apple identity-token CLAIM validation.
// Signature verification is separate (apple-auth.server.ts); these prove that even
// a correctly-signed token is refused unless issuer, audience, expiry, subject and
// nonce are all right.

import { describe, it, expect } from 'vitest';
import { validateAppleClaims, APPLE_ISSUER } from './apple-identity';

const AUD = 'com.bty.BTYNorebangAdmin';
const NOW = 1_800_000_000; // fixed clock

const base = {
  iss: APPLE_ISSUER,
  aud: AUD,
  exp: NOW + 600,
  iat: NOW - 10,
  sub: 'apple-sub-123',
};

const validate = (over: Record<string, unknown> = {}, nonceHash: string | null = null) =>
  validateAppleClaims({
    claims: { ...base, ...over },
    expectedAudience: AUD,
    expectedNonceHash: nonceHash,
    nowSeconds: NOW,
  });

describe('validateAppleClaims — the identity gate', () => {
  it('accepts a well-formed token and returns the stable subject', () => {
    const d = validate();
    expect(d).toMatchObject({ ok: true, subject: 'apple-sub-123' });
  });

  it('rejects a token from a DIFFERENT issuer (not Apple)', () => {
    expect(validate({ iss: 'https://evil.example.com' })).toMatchObject({
      ok: false,
      code: 'BAD_ISSUER',
    });
  });

  it('rejects a token minted for a DIFFERENT audience (audience confusion)', () => {
    // A perfectly valid Apple token for someone else's app must not sign anyone in.
    expect(validate({ aud: 'com.someone.else' })).toMatchObject({ ok: false, code: 'BAD_AUDIENCE' });
  });

  it('rejects a missing or non-string audience rather than guessing', () => {
    expect(validate({ aud: undefined })).toMatchObject({ ok: false, code: 'BAD_AUDIENCE' });
    expect(validate({ aud: [AUD] })).toMatchObject({ ok: false, code: 'BAD_AUDIENCE' });
  });

  it('rejects an expired token (and a missing exp)', () => {
    expect(validate({ exp: NOW - 3600 })).toMatchObject({ ok: false, code: 'EXPIRED' });
    expect(validate({ exp: undefined })).toMatchObject({ ok: false, code: 'EXPIRED' });
  });

  it('allows small clock skew around expiry rather than failing a just-expired token', () => {
    expect(validate({ exp: NOW - 30 })).toMatchObject({ ok: true });
  });

  it('rejects a token issued meaningfully in the future', () => {
    expect(validate({ iat: NOW + 3600 })).toMatchObject({ ok: false, code: 'BAD_ISSUED_AT' });
  });

  it('rejects a token with no subject — email is never an identifier', () => {
    expect(validate({ sub: undefined })).toMatchObject({ ok: false, code: 'NO_SUBJECT' });
    expect(validate({ sub: '' })).toMatchObject({ ok: false, code: 'NO_SUBJECT' });
  });

  it('enforces the nonce when one was used (replay protection)', () => {
    expect(validate({ nonce: 'hash-abc' }, 'hash-abc')).toMatchObject({ ok: true });
    // A token captured from a DIFFERENT sign-in carries a different nonce.
    expect(validate({ nonce: 'hash-OTHER' }, 'hash-abc')).toMatchObject({ ok: false, code: 'BAD_NONCE' });
    // A token with NO nonce cannot satisfy a nonce we demanded.
    expect(validate({}, 'hash-abc')).toMatchObject({ ok: false, code: 'BAD_NONCE' });
  });

  it('returns the email only as convenience, never as the identifier', () => {
    const d = validate({ email: 'relay@privaterelay.appleid.com' });
    expect(d).toMatchObject({ ok: true, subject: 'apple-sub-123', email: 'relay@privaterelay.appleid.com' });
  });

  it('checks issuer/audience BEFORE trusting anything else', () => {
    // Bad issuer AND expired: issuer is reported, so a foreign token never gets to
    // influence any later decision.
    expect(validate({ iss: 'https://evil.example.com', exp: NOW - 10_000 })).toMatchObject({
      code: 'BAD_ISSUER',
    });
  });
});
