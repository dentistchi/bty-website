import { describe, expect, it } from 'vitest';
import { requestDisplayTitle } from './request-view';

describe('requestDisplayTitle', () => {
  it('prefers the YouTube title', () => {
    expect(
      requestDisplayTitle({
        youtube_title: 'IU - Blueming',
        search_query: 'iu blueming',
        youtube_video_id: 'dQw4w9WgXcQ',
      }),
    ).toBe('IU - Blueming');
  });

  it('falls back to the search query when no title', () => {
    expect(
      requestDisplayTitle({
        youtube_title: null,
        search_query: 'iu blueming',
        youtube_video_id: 'dQw4w9WgXcQ',
      }),
    ).toBe('iu blueming');
  });

  it('NEVER returns the opaque video id as the label', () => {
    const label = requestDisplayTitle({
      youtube_title: null,
      search_query: null,
      youtube_video_id: 'dQw4w9WgXcQ',
    });
    expect(label).not.toBe('dQw4w9WgXcQ');
    expect(label).toBe('Untitled request');
  });
});
