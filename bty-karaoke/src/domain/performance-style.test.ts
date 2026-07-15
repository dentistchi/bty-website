import { describe, it, expect } from 'vitest';
import {
  biasStyleQuery,
  normalizeStyle,
  styleCopy,
  DEFAULT_STYLE,
  PERFORMANCE_STYLES,
} from './performance-style';

describe('performance style — defaults', () => {
  it('MR is the default style', () => {
    expect(DEFAULT_STYLE).toBe('mr');
    expect(normalizeStyle(undefined)).toBe('mr');
    expect(normalizeStyle(null)).toBe('mr');
    expect(normalizeStyle('nonsense')).toBe('mr');
  });

  it('normalizes the three known styles', () => {
    for (const s of PERFORMANCE_STYLES) expect(normalizeStyle(s)).toBe(s);
  });
});

describe('biasStyleQuery — MR', () => {
  it('appends " instrumental" for non-Korean queries', () => {
    expect(biasStyleQuery('Dancing Queen', 'mr')).toBe('Dancing Queen instrumental');
  });
  it('appends " MR" for Korean queries', () => {
    expect(biasStyleQuery('아이유 밤편지', 'mr')).toBe('아이유 밤편지 MR');
  });
  it('never double-appends when intent already present', () => {
    expect(biasStyleQuery('밤편지 MR', 'mr')).toBe('밤편지 MR');
    expect(biasStyleQuery('Song instrumental', 'mr')).toBe('Song instrumental');
    expect(biasStyleQuery('Song backing track', 'mr')).toBe('Song backing track');
    expect(biasStyleQuery('노래 반주', 'mr')).toBe('노래 반주');
  });
});

describe('biasStyleQuery — Karaoke', () => {
  it('appends 노래방 for Korean, karaoke otherwise', () => {
    expect(biasStyleQuery('밤편지', 'karaoke')).toBe('밤편지 노래방');
    expect(biasStyleQuery('Hello', 'karaoke')).toBe('Hello karaoke');
  });
  it('does not double-append an existing karaoke term', () => {
    expect(biasStyleQuery('Hello karaoke', 'karaoke')).toBe('Hello karaoke');
    expect(biasStyleQuery('밤편지 노래방', 'karaoke')).toBe('밤편지 노래방');
  });
});

describe('biasStyleQuery — Original', () => {
  it('returns the query unchanged (no bias)', () => {
    expect(biasStyleQuery('Dancing Queen', 'original')).toBe('Dancing Queen');
    expect(biasStyleQuery('아이유 밤편지', 'original')).toBe('아이유 밤편지');
  });
});

describe('biasStyleQuery — edges', () => {
  it('empty stays empty for every style', () => {
    for (const s of PERFORMANCE_STYLES) expect(biasStyleQuery('', s)).toBe('');
    expect(biasStyleQuery('   ', 'mr')).toBe('');
  });
});

describe('styleCopy', () => {
  it('has a label + hint for each style and never promises lyrics', () => {
    for (const s of PERFORMANCE_STYLES) {
      const c = styleCopy(s);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
    }
    // Karaoke copy stays honest: "가능성" (likely), not a guarantee.
    expect(styleCopy('karaoke').hint).toContain('가능성');
  });
});
