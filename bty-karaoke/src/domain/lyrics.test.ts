import { describe, it, expect } from 'vitest';
import {
  sanitizeLyrics,
  lyricsViewFor,
  normalizeSongForLyrics,
  scoreLyricsCandidate,
  pickBestLyricsCandidate,
  canonicalTrackKey,
  LYRICS_MATCH_THRESHOLD,
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

describe('scoreLyricsCandidate + pickBestLyricsCandidate', () => {
  const withLyrics = (o: Record<string, unknown>) => ({ plainLyrics: '가사', instrumental: false, ...o });

  it('scores an exact title+artist match high', () => {
    const s = scoreLyricsCandidate({ song: 'Love wins all', artist: 'IU' }, withLyrics({ trackName: 'Love wins all', artistName: 'IU' }));
    expect(s).toBeGreaterThan(0.9);
  });

  it('matches a bilingual LRCLIB title via substring containment (Korean)', () => {
    const s = scoreLyricsCandidate({ song: '밤편지', artist: '아이유' }, withLyrics({ trackName: 'Through the Night (밤편지)', artistName: 'IU (아이유)' }));
    expect(s).toBeGreaterThanOrEqual(LYRICS_MATCH_THRESHOLD);
  });

  it('gives 0 to an instrumental candidate (no words to show)', () => {
    const s = scoreLyricsCandidate({ song: '밤편지', artist: '아이유' }, { trackName: '밤편지', artistName: '아이유', instrumental: true, plainLyrics: null, syncedLyrics: null });
    expect(s).toBe(0);
  });

  it('gives 0 to a candidate with no lyrics at all', () => {
    const s = scoreLyricsCandidate({ song: '밤편지', artist: '아이유' }, { trackName: '밤편지', artistName: '아이유', instrumental: false, plainLyrics: null, syncedLyrics: null });
    expect(s).toBe(0);
  });

  it('caps the score when the artist clearly mismatches (wrong-artist guard)', () => {
    const right = scoreLyricsCandidate({ song: '사랑', artist: '김동률' }, withLyrics({ trackName: '사랑', artistName: '김동률' }));
    const wrong = scoreLyricsCandidate({ song: '사랑', artist: '김동률' }, withLyrics({ trackName: '사랑', artistName: '전혀다른가수' }));
    expect(wrong).toBeLessThan(right);
    expect(wrong).toBeLessThanOrEqual(0.55);
  });

  it('pickBest returns the strongest candidate above threshold', () => {
    const best = pickBestLyricsCandidate({ song: 'Love wins all', artist: 'IU' }, [
      withLyrics({ trackName: 'Some other song', artistName: 'IU' }),
      withLyrics({ trackName: 'Love wins all', artistName: 'IU' }),
    ]);
    expect(best?.candidate.trackName).toBe('Love wins all');
  });

  it('pickBest returns null when nothing clears the bar (never a wrong match)', () => {
    const best = pickBestLyricsCandidate({ song: '내 노래', artist: '가수A' }, [
      withLyrics({ trackName: '완전히 다른 곡', artistName: '다른 가수' }),
    ]);
    expect(best).toBeNull();
  });

  it('pickBest returns null for an empty candidate list', () => {
    expect(pickBestLyricsCandidate({ song: 'x', artist: 'y' }, [])).toBeNull();
  });
});

describe('canonicalTrackKey', () => {
  it('is stable across noise / case / spacing (repeat-song reuse)', () => {
    const a = canonicalTrackKey('Love Wins All', 'IU');
    const b = canonicalTrackKey('love   wins all', 'iu');
    expect(a).toBe(b);
  });

  it('is identical for the same song regardless of surrounding punctuation', () => {
    expect(canonicalTrackKey('밤편지!!', '아이유')).toBe(canonicalTrackKey('밤편지', '아이유'));
  });

  it('uses ? for a missing artist and differs from a known artist', () => {
    expect(canonicalTrackKey('봄날', null).startsWith('?::')).toBe(true);
    expect(canonicalTrackKey('봄날', null)).not.toBe(canonicalTrackKey('봄날', 'BTS'));
  });

  it('separates different songs by the same artist', () => {
    expect(canonicalTrackKey('봄날', 'BTS')).not.toBe(canonicalTrackKey('Dynamite', 'BTS'));
  });
});
