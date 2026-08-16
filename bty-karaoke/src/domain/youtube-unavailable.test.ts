import { describe, it, expect } from 'vitest';
import { unavailableCopy, showsYouTubeAttribution } from './youtube-unavailable';
import { resolveStageDecision, primaryPlayTarget, isPlayable } from './play-flow';

// BUILD 26T-R1B-R6-R1B-R6 §H/§K/§L.

describe('§H the approved copy, verbatim', () => {
  it('O2: English title and body match the ratified wording exactly', () => {
    expect(unavailableCopy('en')).toEqual({
      title: 'YouTube video unavailable',
      body: 'This video is currently unavailable through YouTube.',
    });
  });

  it('O3: Korean title and body match the ratified wording exactly', () => {
    expect(unavailableCopy('ko')).toEqual({
      title: 'YouTube 동영상을 사용할 수 없음',
      body: '현재 YouTube를 통해 이 동영상을 이용할 수 없습니다.',
    });
  });

  it('an unknown locale falls back to English rather than rendering a key', () => {
    expect(unavailableCopy(null).title).toBe('YouTube video unavailable');
    expect(unavailableCopy('fr').title).toBe('YouTube video unavailable');
    expect(unavailableCopy('ko-KR').title).toBe('YouTube 동영상을 사용할 수 없음');
  });

  it('the copy NEVER asserts a reason we did not measure', () => {
    // An absent id in a videos.list response cannot distinguish deleted / private / region-blocked.
    for (const locale of ['en', 'ko'] as const) {
      const { title, body } = unavailableCopy(locale);
      const text = `${title} ${body}`.toLowerCase();
      for (const forbidden of ['deleted', 'private', 'removed', '삭제', '비공개', '차단']) {
        expect(text, `${locale} must not claim "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });
});

describe('§L attribution', () => {
  it('O16: an unavailable row gets NO live-API attribution mark', () => {
    expect(showsYouTubeAttribution({ youtubeUnavailable: true })).toBe(false);
  });

  it('an ordinary row is unaffected — the measured contract does not regress', () => {
    expect(showsYouTubeAttribution({ youtubeUnavailable: false })).toBe(true);
    expect(showsYouTubeAttribution({})).toBe(true);
  });
});

describe('§K the unavailable item is not a playback candidate', () => {
  const row = (id: string, over: Partial<{ ready_at: string | null; youtube_unavailable: boolean; position: number }> = {}) => ({
    id,
    status: 'waiting' as const,
    position: over.position ?? 1,
    created_at: '2026-08-01T00:00:00Z',
    ready_at: over.ready_at ?? '2026-08-01T00:00:00Z',
    ...(over.youtube_unavailable !== undefined ? { youtube_unavailable: over.youtube_unavailable } : {}),
  });

  it('isPlayable treats an ABSENT flag as available — no existing caller changes meaning', () => {
    expect(isPlayable({})).toBe(true);
    expect(isPlayable({ youtube_unavailable: false })).toBe(true);
    expect(isPlayable({ youtube_unavailable: true })).toBe(false);
  });

  it('M-8/O13: an unavailable head-of-queue does not block the next playable item', () => {
    const d = resolveStageDecision([
      row('gone', { position: 1, youtube_unavailable: true }),
      row('good', { position: 2 }),
    ]);
    expect(d.kind).toBe('promote');
    if (d.kind !== 'promote') throw new Error('unreachable');
    expect(d.request.id).toBe('good');
  });

  it('M-12/O12: an unavailable item is never itself promoted', () => {
    const d = resolveStageDecision([row('gone', { youtube_unavailable: true })]);
    expect(d.kind).toBe('empty'); // truthfully: nothing PLAYABLE
    expect(d.kind).not.toBe('promote');
  });

  it('M-9/O15: when every waiting item is unavailable the state is truthfully empty', () => {
    const d = resolveStageDecision([
      row('a', { position: 1, youtube_unavailable: true }),
      row('b', { position: 2, youtube_unavailable: true }),
    ]);
    expect(d.kind).toBe('empty');
  });

  it('a playing song is still never interrupted, unavailable or not', () => {
    const d = resolveStageDecision([
      { ...row('now'), status: 'playing' as 'waiting' | 'playing', youtube_unavailable: true },
      row('next', { position: 2 }),
    ]);
    expect(d.kind).toBe('busy');
  });

  it('O14: "Play First Song" targets the first PLAYABLE song, not merely the first', () => {
    const q = [
      { id: 'gone', status: 'waiting' as const, youtube_unavailable: true },
      { id: 'good', status: 'waiting' as const },
    ];
    expect(primaryPlayTarget(null, q)?.id).toBe('good');
  });

  it('O15: with only unavailable songs there is NO play target — no dead CTA', () => {
    const q = [{ id: 'gone', status: 'waiting' as const, youtube_unavailable: true }];
    expect(primaryPlayTarget(null, q)).toBeNull();
  });

  it('the ordinary queue is completely unchanged when nothing is unavailable', () => {
    const q: Array<{ id: string; status: 'waiting' | 'playing' }> = [
      { id: 'a', status: 'waiting' },
      { id: 'b', status: 'waiting' },
    ];
    expect(primaryPlayTarget(null, q)?.id).toBe('a');
    expect(primaryPlayTarget({ id: 'x', status: 'playing' as const }, q)).toBeNull();
  });
});

describe('§K the flag is read in BOTH shapes — no adapter can be forgotten', () => {
  it('a RAW request row (timestamp form) is recognised as unplayable', () => {
    // The DJ console passes raw rows straight through. If isPlayable only understood the derived
    // boolean, every one of those rows would look playable and the dead CTA would come back.
    expect(isPlayable({ youtube_metadata_unavailable_at: '2026-08-15T00:00:00Z' })).toBe(false);
    expect(isPlayable({ youtube_metadata_unavailable_at: null })).toBe(true);
  });

  it('a raw unavailable row is filtered out of promotion and of Play First Song', () => {
    const raw = {
      id: 'gone',
      status: 'waiting' as const,
      position: 1,
      created_at: '2026-08-01T00:00:00Z',
      ready_at: '2026-08-01T00:00:00Z',
      youtube_metadata_unavailable_at: '2026-08-15T00:00:00Z',
    };
    const good = { ...raw, id: 'good', position: 2, youtube_metadata_unavailable_at: null };
    const d = resolveStageDecision([raw, good]);
    expect(d.kind).toBe('promote');
    if (d.kind !== 'promote') throw new Error('unreachable');
    expect(d.request.id).toBe('good');
    expect(primaryPlayTarget(null, [raw, good])?.id).toBe('good');
  });
});
