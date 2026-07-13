import { describe, expect, it } from 'vitest';
import {
  biasKaraokeQuery,
  decodeHtmlEntities,
  normalizeSearchQuery,
  projectYoutubeItem,
  youtubeSearchUrl,
  youtubeWatchUrl,
  MAX_QUERY_LEN,
} from './youtube-search';

describe('normalizeSearchQuery', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSearchQuery('  아이유   밤편지 ')).toBe('아이유 밤편지');
  });
  it('caps length', () => {
    expect(normalizeSearchQuery('x'.repeat(200))).toHaveLength(MAX_QUERY_LEN);
  });
});

describe('biasKaraokeQuery', () => {
  it('appends 노래방 for a Korean query', () => {
    expect(biasKaraokeQuery('아이유 밤편지')).toBe('아이유 밤편지 노래방');
  });
  it('appends karaoke for an English query', () => {
    expect(biasKaraokeQuery('IU Blueming')).toBe('IU Blueming karaoke');
  });
  it('does not duplicate an existing Korean bias', () => {
    expect(biasKaraokeQuery('밤편지 노래방')).toBe('밤편지 노래방');
  });
  it('does not duplicate an existing English bias', () => {
    expect(biasKaraokeQuery('Blueming karaoke')).toBe('Blueming karaoke');
  });
  it('treats an existing karaoke term in a Korean query as already biased', () => {
    expect(biasKaraokeQuery('아이유 karaoke')).toBe('아이유 karaoke');
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeHtmlEntities('&quot;Hi&quot;')).toBe('"Hi"');
  });
  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('It&#39;s me')).toBe("It's me");
    expect(decodeHtmlEntities('&#x1F600;')).toBe('😀');
  });
  it('decodes &amp; last so double-encoding survives', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('projectYoutubeItem', () => {
  const raw = {
    id: { videoId: 'dQw4w9WgXcQ' },
    snippet: {
      title: 'IU &#39;Blueming&#39;',
      channelTitle: 'IU &amp; Friends',
      thumbnails: {
        default: { url: 'http://d/def.jpg' },
        medium: { url: 'http://d/med.jpg' },
      },
    },
  };

  it('projects only safe fields and decodes text', () => {
    expect(projectYoutubeItem(raw)).toEqual({
      videoId: 'dQw4w9WgXcQ',
      title: "IU 'Blueming'",
      channelTitle: 'IU & Friends',
      thumbnailUrl: 'http://d/med.jpg',
    });
  });
  it('returns null when videoId or snippet is missing', () => {
    expect(projectYoutubeItem({ snippet: {} })).toBeNull();
    expect(projectYoutubeItem({ id: { videoId: 'x' } })).toBeNull();
  });
});

describe('urls', () => {
  it('builds a standard search fallback url', () => {
    expect(youtubeSearchUrl('a b')).toBe('https://www.youtube.com/results?search_query=a%20b');
  });
  it('builds a watch url', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
