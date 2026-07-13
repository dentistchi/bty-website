import { describe, expect, it } from 'vitest';
import { sha256Hex, timingSafeEqual, credentialMatches, bearerFromHeader } from './dj-auth.server';

describe('sha256Hex', () => {
  it('is deterministic and 64 hex chars', async () => {
    const a = await sha256Hex('hello');
    const b = await sha256Hex('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it('differs for different inputs', async () => {
    expect(await sha256Hex('a')).not.toBe(await sha256Hex('b'));
  });
});

describe('timingSafeEqual', () => {
  it('compares equal/unequal and length mismatches', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'ab')).toBe(false);
  });
});

describe('credentialMatches', () => {
  it('accepts the raw credential that hashes to the stored hash', async () => {
    const stored = await sha256Hex('strong-random-credential');
    expect(await credentialMatches(stored, 'strong-random-credential')).toBe(true);
  });

  it('rejects a wrong credential', async () => {
    const stored = await sha256Hex('strong-random-credential');
    expect(await credentialMatches(stored, 'guess')).toBe(false);
  });

  it('rejects the retired demo-dj credential against a real room hash', async () => {
    const stored = await sha256Hex('Wkq9-Zf3pL0aB2cD4eF6gH8i'); // stands in for a real strong cred
    expect(await credentialMatches(stored, 'demo-dj')).toBe(false);
  });

  it('rejects empty/absent inputs', async () => {
    expect(await credentialMatches(null, 'x')).toBe(false);
    expect(await credentialMatches('deadbeef', '')).toBe(false);
  });
});

describe('bearerFromHeader', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerFromHeader('Bearer abc.def')).toBe('abc.def');
    expect(bearerFromHeader('bearer  spaced')).toBe('spaced');
  });
  it('returns null for missing/other schemes', () => {
    expect(bearerFromHeader(null)).toBeNull();
    expect(bearerFromHeader('Basic xyz')).toBeNull();
  });
});
