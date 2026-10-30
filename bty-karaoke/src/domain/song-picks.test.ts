import { describe, expect, it } from 'vitest';
import { SONG_PICKS, SONG_PICK_CATEGORIES } from './song-picks';
import { normalizeSearchQuery } from './youtube-search';

describe('editorial catalog integrity', () => {
  it('contains 60 distinct songs, ten for each approved category', () => {
    expect(SONG_PICKS).toHaveLength(60);
    expect(new Set(SONG_PICKS.map((song) => song.id)).size).toBe(60);
    expect(new Set(SONG_PICKS.map((song) => `${song.artist}:${song.title}`)).size).toBe(60);
    for (const category of SONG_PICK_CATEGORIES) {
      expect(SONG_PICKS.filter((song) => song.category === category)).toHaveLength(10);
    }
  });

  it('provides complete queries accepted unchanged by the existing search boundary', () => {
    for (const song of SONG_PICKS) {
      expect(song.title.trim()).not.toBe('');
      expect(song.artist.trim()).not.toBe('');
      expect(song.searchQuery).toContain(song.title);
      expect(song.searchQuery).toContain(song.artist);
      expect(normalizeSearchQuery(song.searchQuery)).toBe(song.searchQuery);
      expect(song).not.toHaveProperty('videoId');
      expect(song).not.toHaveProperty('youtubeProvenance');
    }
  });
});
