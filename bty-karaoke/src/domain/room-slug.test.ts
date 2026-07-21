import { describe, it, expect } from 'vitest';
import { slugBaseFromName, buildRoomSlug } from './room-slug';

describe('slugBaseFromName', () => {
  it('lowercases and hyphenates an ASCII name', () => {
    expect(slugBaseFromName('Chi Family Norebang')).toBe('chi-family-norebang');
  });

  it('collapses and trims separators/punctuation', () => {
    expect(slugBaseFromName('  Hello,   World!!  ')).toBe('hello-world');
    expect(slugBaseFromName('a__b--c')).toBe('a-b-c');
  });

  it('falls back to "norebang" for a name with no ASCII alphanumerics', () => {
    expect(slugBaseFromName('노래방')).toBe('norebang'); // Korean → stripped → fallback
    expect(slugBaseFromName('🎤🎶')).toBe('norebang');
    expect(slugBaseFromName('   ')).toBe('norebang');
    expect(slugBaseFromName('')).toBe('norebang');
  });

  it('keeps ASCII that rides alongside non-ASCII', () => {
    expect(slugBaseFromName('Chi 노래방 2')).toBe('chi-2');
  });

  it('bounds the base length and never ends on a hyphen', () => {
    const base = slugBaseFromName('a'.repeat(40));
    expect(base.length).toBeLessThanOrEqual(24);
    expect(base.endsWith('-')).toBe(false);
    expect(slugBaseFromName(`${'x'.repeat(24)} tail`).endsWith('-')).toBe(false);
  });

  it('only ever yields url-safe characters', () => {
    expect(slugBaseFromName('Café — Déjà Vu')).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('buildRoomSlug', () => {
  it('joins the name base and the random suffix with a hyphen', () => {
    expect(buildRoomSlug('Chi Family Norebang', 'k3n8p1')).toBe('chi-family-norebang-k3n8p1');
  });

  it('uses the neutral base for a non-ASCII name, so uniqueness rests on the suffix', () => {
    expect(buildRoomSlug('노래방', 'ab12cd')).toBe('norebang-ab12cd');
  });

  it('is a pure function of its inputs (stable / deterministic)', () => {
    expect(buildRoomSlug('My Room', 'zzz')).toBe(buildRoomSlug('My Room', 'zzz'));
  });
});
