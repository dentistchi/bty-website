import { describe, expect, it } from 'vitest';
import { parseYoutubeVideoId, isValidVideoId, safeYoutubeWatchUrl } from './youtube';

describe('parseYoutubeVideoId', () => {
  it('accepts a bare 11-char id', () => {
    expect(parseYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses a standard watch url', () => {
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s')).toBe('dQw4w9WgXcQ');
  });

  it('parses a youtu.be short link', () => {
    expect(parseYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses a /shorts/ link', () => {
    expect(parseYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('rejects junk and non-youtube urls', () => {
    expect(parseYoutubeVideoId('')).toBeNull();
    expect(parseYoutubeVideoId('hello world')).toBeNull();
    expect(parseYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
  });
});

describe('safeYoutubeWatchUrl / isValidVideoId', () => {
  it('builds the canonical watch URL for a valid id', () => {
    expect(safeYoutubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
  });

  it('rejects malformed / unsafe ids (returns null, never a URL)', () => {
    for (const bad of ['', 'short', 'way-too-long-id-here', 'javascript:alert(1)', 'a b c d e f g', null, undefined]) {
      expect(safeYoutubeWatchUrl(bad as string)).toBeNull();
      expect(isValidVideoId(bad as string)).toBe(false);
    }
  });

  it('never yields a non-https scheme', () => {
    expect(safeYoutubeWatchUrl('dQw4w9WgXcQ')!.startsWith('https://www.youtube.com/')).toBe(true);
  });
});
