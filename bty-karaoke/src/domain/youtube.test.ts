import { describe, expect, it } from 'vitest';
import { parseYoutubeVideoId } from './youtube';

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
