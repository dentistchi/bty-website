import { describe, it, expect } from 'vitest';
import { parseArtist, coreTitle, recommendationQueries } from './recommendations';

describe('parseArtist', () => {
  it('reads the artist from an "Artist - Song" title', () => {
    expect(parseArtist({ title: '아이유 - 밤편지', channelTitle: '1theK' })).toBe('아이유');
  });
  it('falls back to a cleaned channel name', () => {
    expect(parseArtist({ title: 'Blueming', channelTitle: 'IUVEVO' })).toBe('IU');
  });
  it('strips "- Topic"', () => {
    expect(parseArtist({ title: 'Song', channelTitle: 'ROSÉ - Topic' })).toBe('ROSÉ');
  });
});

describe('coreTitle', () => {
  it('drops bracket tags and the artist prefix', () => {
    expect(coreTitle({ title: '아이유 - 밤편지 (Official)', channelTitle: 'x' }, '아이유')).toBe('밤편지');
  });
});

describe('recommendationQueries', () => {
  it('puts same-artist queries first', () => {
    const qs = recommendationQueries({ title: '아이유 - 밤편지', channelTitle: '1theK' });
    expect(qs[0]).toContain('아이유');
    expect(qs[1]).toContain('아이유');
    expect(qs.some((q) => q.includes('비슷한 노래'))).toBe(true);
  });

  it('uses a mood seed when no artist is parseable', () => {
    const qs = recommendationQueries({ title: 'Random Title', channelTitle: 'Official Music' });
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => typeof q === 'string' && q.length > 0)).toBe(true);
  });

  it('dedupes queries', () => {
    const qs = recommendationQueries({ title: 'A - A', channelTitle: 'A' });
    expect(new Set(qs).size).toBe(qs.length);
  });
});
