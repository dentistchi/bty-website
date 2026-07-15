import { describe, it, expect } from 'vitest';
import {
  rankResults,
  rankSearchResults,
  isMrCandidate,
  scoreItem,
  queryTerms,
  titleKey,
  PRIMARY_RESULT_COUNT,
} from './youtube-rank';
import type { YoutubeSearchItem } from './youtube-search';

const item = (videoId: string, title: string, channelTitle = 'ch'): YoutubeSearchItem => ({
  videoId,
  title,
  channelTitle,
  thumbnailUrl: null,
});

const ids = (r: { top: YoutubeSearchItem[]; more: YoutubeSearchItem[] }) => ({
  top: r.top.map((x) => x.videoId),
  more: r.more.map((x) => x.videoId),
});

describe('rankSearchResults — MR-first (V5.2)', () => {
  it('MR mode leads with real MR, not popular TJ/금영 karaoke', () => {
    const items = [item('k', '이별 노래방 TJ'), item('m', '이별 MR instrumental')];
    expect(ids(rankSearchResults(items, { style: 'mr', query: '이별' })).top[0]).toBe('m');
  });

  it('when ≥3 MR candidates exist (on-song), the first 3 are all MR', () => {
    const items = [
      item('k1', '이별 노래방'),
      item('m1', '이별 MR'),
      item('k2', '이별 TJ'),
      item('m2', '이별 instrumental'),
      item('m3', '이별 반주'),
    ];
    const top = rankSearchResults(items, { style: 'mr', query: '이별' }).top;
    expect(top.every(isMrCandidate)).toBe(true);
    expect(top.map((x) => x.videoId).sort()).toEqual(['m1', 'm2', 'm3']);
  });

  it('with 2 MR candidates, the first 2 are MR', () => {
    const items = [item('k1', '이별 노래방'), item('m1', '이별 MR'), item('k2', '이별 TJ'), item('m2', '이별 반주')];
    const top = rankSearchResults(items, { style: 'mr', query: '이별' }).top;
    expect([top[0], top[1]].every(isMrCandidate)).toBe(true);
  });

  it('when NO MR candidate exists, results are NOT hidden (shown honestly)', () => {
    const items = [item('k1', '이별 노래방'), item('k2', '이별 TJ')];
    const r = rankSearchResults(items, { style: 'mr', query: '이별' });
    expect(r.top).toHaveLength(2);
    expect(items.some(isMrCandidate)).toBe(false);
  });

  it('official/MV rank below MR in MR mode', () => {
    const items = [item('mv', '이별 Official MV', 'artistVEVO'), item('m', '이별 MR')];
    expect(ids(rankSearchResults(items, { style: 'mr', query: '이별' })).top[0]).toBe('m');
  });

  it('a generic OFF-song backing track never floats above the on-song result', () => {
    const items = [item('on', '이별 노래방'), item('gen', 'Piano Instrumental Relaxing Mix')];
    expect(ids(rankSearchResults(items, { style: 'mr', query: '이별' })).top[0]).toBe('on');
  });

  it('score ties keep the original YouTube order (stable)', () => {
    const items = [item('a', '이별 노래방 A'), item('b', '이별 노래방 B')];
    expect(ids(rankSearchResults(items, { style: 'karaoke', query: '이별' })).top).toEqual(['a', 'b']);
  });

  it('karaoke mode leads with karaoke; original mode leads with official/MV', () => {
    const kItems = [item('m', '이별 instrumental'), item('k', '이별 노래방')];
    expect(ids(rankSearchResults(kItems, { style: 'karaoke', query: '이별' })).top[0]).toBe('k');
    const oItems = [item('k', '이별 노래방'), item('o', '이별 Official MV', 'artistVEVO')];
    expect(ids(rankSearchResults(oItems, { style: 'original', query: '이별' })).top[0]).toBe('o');
  });

  it('"더 보기" (more) continues the same ranked list', () => {
    const items = [
      item('k1', '이별 노래방'),
      item('m1', '이별 MR'),
      item('m2', '이별 instrumental'),
      item('m3', '이별 반주'),
      item('k2', '이별 TJ'),
    ];
    const r = rankSearchResults(items, { style: 'mr', query: '이별' }, 3);
    expect(r.top).toHaveLength(3);
    expect(r.more.every(isMrCandidate)).toBe(false); // the karaoke rows fall to "more"
  });
});

describe('isMrCandidate', () => {
  it('is true for MR/instrumental, false for karaoke/official', () => {
    expect(isMrCandidate(item('x', '이별 MR'))).toBe(true);
    expect(isMrCandidate(item('x', '이별 반주'))).toBe(true);
    expect(isMrCandidate(item('x', '이별 노래방 TJ'))).toBe(false);
    expect(isMrCandidate(item('x', '이별 Official MV', 'artistVEVO'))).toBe(false);
  });
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
