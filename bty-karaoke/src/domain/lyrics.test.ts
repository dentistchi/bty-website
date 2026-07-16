import { describe, it, expect } from 'vitest';
import {
  sanitizeLyrics,
  lyricsViewFor,
  normalizeSongForLyrics,
  MAX_LYRICS_LEN,
  LOW_CONFIDENCE,
} from './lyrics';

describe('sanitizeLyrics', () => {
  it('keeps multi-line plain text and preserves line breaks', () => {
    const r = sanitizeLyrics('첫 줄\n둘째 줄\n셋째 줄');
    expect(r.status).toBe('available');
    expect(r.text).toBe('첫 줄\n둘째 줄\n셋째 줄');
  });

  it('treats empty / whitespace-only input as a clear (unavailable)', () => {
    expect(sanitizeLyrics('')).toEqual({ text: null, status: 'unavailable' });
    expect(sanitizeLyrics('   \n\n  \t ')).toEqual({ text: null, status: 'unavailable' });
    expect(sanitizeLyrics(null)).toEqual({ text: null, status: 'unavailable' });
    expect(sanitizeLyrics(undefined)).toEqual({ text: null, status: 'unavailable' });
  });

  it('normalizes CRLF to LF', () => {
    expect(sanitizeLyrics('a\r\nb\rc').text).toBe('a\nb\nc');
  });

  it('collapses excessive blank lines and trims edge blank lines', () => {
    expect(sanitizeLyrics('\n\na\n\n\n\nb\n\n').text).toBe('a\n\nb');
  });

  it('strips control characters but keeps newline and tab', () => {
    // NUL + BEL + ESC embedded around a real tab; the tab and letters survive.
    const input = 'a\x00b\x07\x1b\tcd';
    const r = sanitizeLyrics(input);
    expect(r.text).toBe('ab\tcd');
  });

  it('neutralizes an attempted HTML/script injection as inert text', () => {
    const r = sanitizeLyrics('<script>alert(1)</script>\n<img onerror=x>');
    // No execution surface — it is stored/returned verbatim as text (Display
    // renders text only, never HTML), only control bytes are removed.
    expect(r.status).toBe('available');
    expect(r.text).toContain('<script>alert(1)</script>');
    expect(r.text).toContain('<img onerror=x>');
  });

  it('caps length at MAX_LYRICS_LEN', () => {
    const r = sanitizeLyrics('x'.repeat(MAX_LYRICS_LEN + 500));
    expect(r.text!.length).toBe(MAX_LYRICS_LEN);
  });
});

describe('lyricsViewFor', () => {
  it('returns unavailable for a row with no lyrics', () => {
    expect(lyricsViewFor(null)).toEqual({ status: 'unavailable', text: null, source: null });
    expect(lyricsViewFor({})).toEqual({ status: 'unavailable', text: null, source: null });
  });

  it('surfaces available text with its source', () => {
    const v = lyricsViewFor({ lyrics_text: '가사\n둘', lyrics_status: 'available', lyrics_source: 'admin' });
    expect(v).toEqual({ status: 'available', text: '가사\n둘', source: 'admin' });
  });

  it('degrades available-with-no-text to unavailable (never claim empty lyrics)', () => {
    const v = lyricsViewFor({ lyrics_text: '   ', lyrics_status: 'available' });
    expect(v.status).toBe('unavailable');
    expect(v.text).toBeNull();
  });

  it('never leaks text for a failed status', () => {
    const v = lyricsViewFor({ lyrics_text: null, lyrics_status: 'failed' });
    expect(v.status).toBe('failed');
    expect(v.text).toBeNull();
  });

  it('coerces an unknown status to unavailable', () => {
    expect(lyricsViewFor({ lyrics_status: 'garbage' }).status).toBe('unavailable');
  });
});

describe('normalizeSongForLyrics', () => {
  it('normalizes an Original title into song + artist', () => {
    const r = normalizeSongForLyrics({
      youtubeTitle: 'IU(아이유) _ Love wins all (Official MV)',
      channelTitle: '1theK (원더케이)',
      mode: 'original',
    });
    expect(r.song.toLowerCase()).toContain('love wins all');
    expect(r.song.toLowerCase()).not.toContain('official');
    expect(r.song.toLowerCase()).not.toContain('mv');
    expect(r.confidence).toBeGreaterThan(LOW_CONFIDENCE);
  });

  it('strips karaoke suffixes to the original song', () => {
    const r = normalizeSongForLyrics({
      youtubeTitle: '[TJ노래방] 하여가 - 서태지와아이들 / TJ Karaoke',
      channelTitle: 'TJ KARAOKE',
      mode: 'karaoke',
    });
    expect(r.song).toContain('하여가');
    expect(r.song.toLowerCase()).not.toContain('karaoke');
    expect(r.song).not.toContain('노래방');
    expect(r.artist).toBeTruthy();
  });

  it('strips MR / instrumental suffixes and does not treat the MR filename as the song', () => {
    const r = normalizeSongForLyrics({
      youtubeTitle: '밤편지 (MR / Instrumental) [반주]',
      channelTitle: '금영노래방',
      mode: 'mr',
    });
    expect(r.song).toContain('밤편지');
    expect(r.song.toLowerCase()).not.toContain('instrumental');
    expect(r.song).not.toContain('MR');
    expect(r.song).not.toContain('반주');
  });

  it('parses "Song - Artist" with a karaoke signal', () => {
    const r = normalizeSongForLyrics({
      youtubeTitle: '거짓말 - 빅뱅 노래방',
      channelTitle: 'KY',
    });
    expect(r.song).toBe('거짓말');
    expect(r.artist).toBe('빅뱅');
  });

  it('rejects a title that is only a karaoke catalog code (low confidence)', () => {
    const r = normalizeSongForLyrics({ youtubeTitle: '(TJ.12345)', channelTitle: 'TJ' });
    expect(r.confidence).toBeLessThan(LOW_CONFIDENCE);
    expect(r.song).toBe('');
    expect(r.reason).toBeTruthy();
  });

  it('reports zero confidence when there is no title at all', () => {
    const r = normalizeSongForLyrics({});
    expect(r.confidence).toBe(0);
    expect(r.reason).toBe('no-title');
  });

  it('lowers confidence when normalization strips almost everything', () => {
    const r = normalizeSongForLyrics({
      youtubeTitle: 'Official Lyric Video Karaoke Instrumental MR Live HD 4K',
    });
    expect(r.confidence).toBeLessThan(LOW_CONFIDENCE);
  });

  it('trusts an explicit song title outright', () => {
    const r = normalizeSongForLyrics({ songTitle: '봄날', artist: 'BTS' });
    expect(r).toMatchObject({ song: '봄날', artist: 'BTS' });
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('handles a malformed / undefined-ish provider input without throwing', () => {
    const r = normalizeSongForLyrics({ youtubeTitle: null, searchQuery: null, channelTitle: null });
    expect(r.confidence).toBe(0);
  });
});
