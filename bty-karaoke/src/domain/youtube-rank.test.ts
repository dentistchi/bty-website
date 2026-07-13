import { describe, it, expect } from 'vitest';
import { rankResults, scoreItem, queryTerms, titleKey, PRIMARY_RESULT_COUNT } from './youtube-rank';
import type { YoutubeSearchItem } from './youtube-search';

const item = (videoId: string, title: string, channelTitle = 'ch'): YoutubeSearchItem => ({
  videoId,
  title,
  channelTitle,
  thumbnailUrl: null,
});

describe('queryTerms', () => {
  it('splits, lowercases, drops short + bias words', () => {
    expect(queryTerms('IU Blueming 노래방')).toEqual(['iu', 'blueming']);
  });
});

describe('titleKey', () => {
  it('strips brackets/punctuation for near-dup detection', () => {
    expect(titleKey('APT. (Official Video)')).toBe(titleKey('apt'));
  });
});

describe('scoreItem', () => {
  it('rewards term overlap and karaoke boosts', () => {
    const a = scoreItem(item('1', 'IU Blueming 노래방'), ['iu', 'blueming']);
    const b = scoreItem(item('2', 'Unrelated clip'), ['iu', 'blueming']);
    expect(a).toBeGreaterThan(b);
  });

  it('penalizes reactions/shorts/covers', () => {
    const clean = scoreItem(item('1', 'IU Blueming'), ['iu', 'blueming']);
    const reaction = scoreItem(item('2', 'IU Blueming REACTION'), ['iu', 'blueming']);
    expect(reaction).toBeLessThan(clean);
  });
});

describe('rankResults', () => {
  it('returns only the best N as top, rest as more', () => {
    const items = Array.from({ length: 6 }, (_, i) => item(`v${i}`, `Song ${i}`));
    const { top, more } = rankResults(items, 'song');
    expect(top).toHaveLength(PRIMARY_RESULT_COUNT);
    expect(more).toHaveLength(3);
  });

  it('ranks a clean karaoke match above a reaction', () => {
    const { top } = rankResults(
      [
        item('r', 'IU Blueming REACTION video shorts'),
        item('k', 'IU 블루밍 노래방'),
      ],
      'IU Blueming',
    );
    expect(top[0].videoId).toBe('k');
  });

  it('dedupes by videoId and near-identical title', () => {
    const { top, more } = rankResults(
      [item('a', 'APT (Official)'), item('a', 'APT dup id'), item('b', 'APT [MV]')],
      'apt',
    );
    const ids = [...top, ...more].map((r) => r.videoId);
    expect(ids).toEqual(['a']); // same id dropped; near-identical title dropped
  });

  it('keeps API order for equal scores (stable)', () => {
    const { top } = rankResults([item('x', 'zzz'), item('y', 'zzz2')], 'nomatch');
    expect(top.map((r) => r.videoId)).toEqual(['x', 'y']);
  });
});
