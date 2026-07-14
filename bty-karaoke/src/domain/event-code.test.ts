import { describe, it, expect } from 'vitest';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  publicCodeFromBytes,
  slugifyName,
  buildGuestSlug,
  eventRoomSlug,
} from './event-code';

describe('publicCodeFromBytes', () => {
  it('produces a CODE_LENGTH code drawn only from the alphabet', () => {
    const bytes = new Uint8Array([0, 1, 2, 30, 31, 62]);
    const code = publicCodeFromBytes(bytes);
    expect(code).toHaveLength(CODE_LENGTH);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
  });

  it('never emits a confusable glyph (0 O 1 I L)', () => {
    for (const forbidden of ['0', 'O', '1', 'I', 'L']) {
      expect(CODE_ALPHABET).not.toContain(forbidden);
    }
    const bytes = new Uint8Array(Array.from({ length: 6 }, (_, i) => i * 7));
    expect(/[0O1IL]/.test(publicCodeFromBytes(bytes))).toBe(false);
  });

  it('is deterministic for the same bytes and wraps by modulo', () => {
    const a = new Uint8Array([0, 0, 0, 0, 0, 0]);
    expect(publicCodeFromBytes(a)).toBe(CODE_ALPHABET[0].repeat(CODE_LENGTH));
    const wrap = new Uint8Array([CODE_ALPHABET.length, 0, 0, 0, 0, 0]);
    expect(publicCodeFromBytes(wrap)[0]).toBe(CODE_ALPHABET[0]); // wraps to index 0
  });

  it('throws when given too few bytes', () => {
    expect(() => publicCodeFromBytes(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe('slugifyName', () => {
  it('kebab-cases an ASCII name', () => {
    expect(slugifyName('Friday Night')).toBe('friday-night');
    expect(slugifyName('  Dr. Chi & Friends!! ')).toBe('dr-chi-friends');
  });

  it('returns empty for a name with no ASCII alphanumerics', () => {
    expect(slugifyName('금요일 밤')).toBe('');
    expect(slugifyName('🎤🎶')).toBe('');
  });

  it('caps overly long names without a trailing dash', () => {
    const s = slugifyName('a'.repeat(50) + ' ' + 'b'.repeat(50));
    expect(s.length).toBeLessThanOrEqual(32);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('buildGuestSlug', () => {
  it('appends the lowercased code to the name base', () => {
    expect(buildGuestSlug('Friday Night', '7K4M2P')).toBe('friday-night-7k4m2p');
  });

  it('falls back to "event" when the name yields no ASCII base', () => {
    expect(buildGuestSlug('금요일 밤', '7K4M2P')).toBe('event-7k4m2p');
  });
});

describe('eventRoomSlug', () => {
  it('prefixes evt- and lowercases the code', () => {
    expect(eventRoomSlug('7K4M2P')).toBe('evt-7k4m2p');
  });
});
