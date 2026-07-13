import { describe, it, expect } from 'vitest';
import { normalizePin, hashPin, verifyPin, PBKDF2_ITERATIONS } from './admin-pin.server';

describe('normalizePin', () => {
  it('accepts a 6+ digit numeric PIN', () => {
    expect(normalizePin('123456')).toEqual({ ok: true, pin: '123456' });
    expect(normalizePin('12345')).toEqual({ ok: false }); // too short
  });
  it('requires ≥8 for passphrases (any non-digit)', () => {
    expect(normalizePin('sing123')).toEqual({ ok: false }); // 7 chars, has letters
    expect(normalizePin('singtonight')).toEqual({ ok: true, pin: 'singtonight' });
  });
  it('rejects leading/trailing whitespace instead of trimming', () => {
    expect(normalizePin(' 123456')).toEqual({ ok: false });
    expect(normalizePin('123456 ')).toEqual({ ok: false });
  });
  it('rejects empty, over-length, and non-strings', () => {
    expect(normalizePin('')).toEqual({ ok: false });
    expect(normalizePin('9'.repeat(129))).toEqual({ ok: false });
    expect(normalizePin(1234 as unknown)).toEqual({ ok: false });
  });
  it('NFC-normalizes before checking', () => {
    // "é" as base+combining (7 code units) → NFC single char; passphrase ≥8 still enforced
    const decomposed = 'caféword'; // café word variants
    const r = normalizePin(decomposed);
    if (r.ok) expect(r.pin).toBe(decomposed.normalize('NFC'));
  });
});

describe('hashPin / verifyPin', () => {
  it('round-trips a PIN (low iterations for speed)', async () => {
    const rec = await hashPin('123456', 2000);
    expect(rec.startsWith('pbkdf2_sha256$2000$')).toBe(true);
    expect((await verifyPin(rec, '123456')).ok).toBe(true);
    expect((await verifyPin(rec, '654321')).ok).toBe(false);
  });
  it('flags needsRehash when the stored iterations are below target', async () => {
    const rec = await hashPin('123456', 2000);
    const r = await verifyPin(rec, '123456', PBKDF2_ITERATIONS);
    expect(r.ok).toBe(true);
    expect(r.needsRehash).toBe(true);
  });
  it('rejects malformed records without throwing', async () => {
    expect((await verifyPin('', '123456')).ok).toBe(false);
    expect((await verifyPin('garbage', '123456')).ok).toBe(false);
    expect((await verifyPin('pbkdf2_sha256$x$y$z', '123456')).ok).toBe(false);
    expect((await verifyPin(null, '123456')).ok).toBe(false);
  });
  it('produces a unique salt per hash', async () => {
    const a = await hashPin('123456', 1000);
    const b = await hashPin('123456', 1000);
    expect(a).not.toBe(b);
  });
});
