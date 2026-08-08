import { describe, it, expect } from 'vitest';
import {
  myRequestsKey,
  legacyMyRequestsKey,
  isTerminalState,
  pruneMyRequests,
  addMyRequest,
  collapsedSummary,
  cancelRowAction,
  groupOwned,
  ownedCounts,
  readyStageCopy,
  hasActiveMedia,
  MY_REQUESTS_TTL_MS,
  type MyRequest,
  type OwnedRow,
} from './guest-requests';
import { displaySong, cleanSongTitle } from './song-title';

const req = (id: string, submittedAt = 0): MyRequest => ({
  requestId: id,
  cancelToken: 't',
  title: id,
  artist: null,
  submittedAt,
});

describe('guest-requests model', () => {
  it('scopes the key per room (legacy, no event)', () => {
    expect(myRequestsKey('bty-home')).toBe('bty-karaoke:bty-home:my-requests');
    expect(myRequestsKey('bty-home', null)).toBe('bty-karaoke:bty-home:my-requests');
    expect(legacyMyRequestsKey('bty-home')).toBe('bty-karaoke:bty-home:my-requests');
  });
  it('namespaces ownership by event so it never crosses an event boundary (V5)', () => {
    expect(myRequestsKey('bty-home', 'evt-1')).toBe('bty-karaoke:bty-home:evt-1:my-requests');
    // A different event → a different key → a new event can't inherit prior requests.
    expect(myRequestsKey('bty-home', 'evt-2')).not.toBe(myRequestsKey('bty-home', 'evt-1'));
    // Event-scoped key differs from the legacy room-scoped key.
    expect(myRequestsKey('bty-home', 'evt-1')).not.toBe(legacyMyRequestsKey('bty-home'));
  });
  it('classifies terminal states', () => {
    expect(isTerminalState('done')).toBe(true);
    expect(isTerminalState('removed')).toBe(true);
    expect(isTerminalState('not_found')).toBe(true);
    expect(isTerminalState('waiting')).toBe(false);
    expect(isTerminalState('now_playing')).toBe(false);
  });
  it('prunes entries past the TTL', () => {
    const now = MY_REQUESTS_TTL_MS + 1000;
    const kept = pruneMyRequests([req('fresh', now - 1000), req('stale', 0)], now);
    expect(kept.map((r) => r.requestId)).toEqual(['fresh']);
  });
  it('adds without duplicating by requestId', () => {
    const list = addMyRequest([req('a')], req('a', 5));
    expect(list).toHaveLength(1);
    expect(list[0].submittedAt).toBe(5);
    expect(addMyRequest([req('a')], req('b'))).toHaveLength(2);
  });
  it('retains a distinct cancelToken per request (no token bleed)', () => {
    let list: MyRequest[] = [];
    for (let i = 1; i <= 5; i++) {
      list = addMyRequest(list, { requestId: `r${i}`, cancelToken: `tok-${i}`, title: `s${i}`, artist: null, submittedAt: i });
    }
    expect(list).toHaveLength(5);
    expect(list.map((r) => r.cancelToken)).toEqual(['tok-1', 'tok-2', 'tok-3', 'tok-4', 'tok-5']);
    // Cancelling #3 targets exactly tok-3; the others are untouched.
    const third = list.find((r) => r.requestId === 'r3');
    expect(third?.cancelToken).toBe('tok-3');
    const remaining = list.filter((r) => r.requestId !== 'r3');
    expect(remaining.map((r) => r.cancelToken)).toEqual(['tok-1', 'tok-2', 'tok-4', 'tok-5']);
  });
});

describe('cancelRowAction', () => {
  it('offers cancel when cancellable and a token is held', () => {
    expect(cancelRowAction('waiting', true)).toBe('cancel');
    expect(cancelRowAction('up_next', true)).toBe('cancel');
  });
  it('shows unavailable when cancellable but no token (old stored entry)', () => {
    expect(cancelRowAction('waiting', false)).toBe('unavailable');
  });
  it('offers nothing once playing or terminal', () => {
    expect(cancelRowAction('now_playing', true)).toBe('none');
    expect(cancelRowAction('done', true)).toBe('none');
    expect(cancelRowAction('removed', true)).toBe('none');
  });
});

describe('collapsedSummary', () => {
  it('is empty with no active requests', () => {
    const s = collapsedSummary('ko', []);
    expect(s.count).toBe(0);
    expect(s.nearestPosition).toBeNull();
    expect(s.label).toBe('');
  });
  it('reports the nearest position unambiguously (no "N번 · N곡")', () => {
    const s = collapsedSummary('ko', [
      { state: 'waiting', position: 5 },
      { state: 'up_next', position: 1 },
    ]);
    expect(s.count).toBe(2);
    expect(s.nearestPosition).toBe(1);
    expect(s.label).toBe('가장 빠른 순번 1번');
    expect(s.label).not.toContain('곡'); // count lives outside the sub-line
  });
  it('uses a single-request phrasing when only one is active', () => {
    expect(collapsedSummary('ko', [{ state: 'waiting', position: 3 }]).label).toBe('지금 대기 3번');
  });
  it('drops terminal rows from the active count', () => {
    const s = collapsedSummary('ko', [
      { state: 'waiting', position: 3 },
      { state: 'done', position: 0 },
    ]);
    expect(s.count).toBe(1);
    expect(s.nearestPosition).toBe(3);
  });
});

describe('groupOwned — current requests vs completed history vs dropped', () => {
  const rows: OwnedRow[] = [
    { requestId: 'p', state: 'now_playing' },
    { requestId: 'w', state: 'waiting' },
    { requestId: 'd1', state: 'done' },
    { requestId: 'd2', state: 'done' },
    { requestId: 'x', state: 'removed' },
    { requestId: 'g', state: 'not_found' },
  ];
  it('active = waiting + playing only', () => {
    expect(groupOwned(rows).activeIds).toEqual(['p', 'w']);
  });
  it('completed = done only, in order', () => {
    expect(groupOwned(rows).completedIds).toEqual(['d1', 'd2']);
  });
  it('removed / not_found belong to neither collection', () => {
    const g = groupOwned(rows);
    expect(g.activeIds).not.toContain('x');
    expect(g.completedIds).not.toContain('g');
  });
  it('a request is never in both active and completed', () => {
    const g = groupOwned(rows);
    expect(g.activeIds.some((id) => g.completedIds.includes(id))).toBe(false);
  });
});

describe('ownedCounts — active / completed / ready', () => {
  const rows: OwnedRow[] = [
    { requestId: 'p', state: 'now_playing' },
    { requestId: 'r', state: 'waiting', readyAt: '2026-07-18T00:00:00Z' },
    { requestId: 'n', state: 'waiting', readyAt: null },
    { requestId: 'd', state: 'done' },
    { requestId: 'x', state: 'removed' },
  ];
  it('active counts waiting + playing (not completed/removed)', () => {
    expect(ownedCounts(rows).active).toBe(3);
  });
  it('completed counts done only', () => {
    expect(ownedCounts(rows).completed).toBe(1);
  });
  it('ready counts waiting rows with ready_at only (not Not-Ready)', () => {
    expect(ownedCounts(rows).ready).toBe(1);
  });
  it('the count-vs-render bug: active count excludes the completed cards', () => {
    // 1 active Ready + 4 completed → the sheet must show active=1, not 5.
    const mix: OwnedRow[] = [
      { requestId: 'a', state: 'waiting', readyAt: 'x' },
      { requestId: 'c1', state: 'done' },
      { requestId: 'c2', state: 'done' },
      { requestId: 'c3', state: 'done' },
      { requestId: 'c4', state: 'done' },
    ];
    expect(ownedCounts(mix).active).toBe(1);
    expect(ownedCounts(mix).completed).toBe(4);
  });
});

describe('readyStageCopy — honest, state-derived', () => {
  const base = { ready: true, stageOpen: null as boolean | null, isEarliestReady: false, readyAheadCount: 0 };
  it('idle earliest Ready does NOT mention a previous stage', () => {
    const c = readyStageCopy('ko', { ...base, state: 'up_next', stageOpen: true, isEarliestReady: true });
    expect(c).toBe('첫 곡으로 시작할 준비가 됐어요');
    expect(c).not.toContain('앞의 무대가 끝나면');
  });
  it('another song playing + next eligible Ready → continuation copy', () => {
    expect(readyStageCopy('ko', { ...base, state: 'waiting', stageOpen: false, isEarliestReady: true })).toBe(
      '현재 무대가 끝나면 자동으로 이어집니다',
    );
  });
  it('Ready songs ahead → honest ahead count', () => {
    expect(readyStageCopy('ko', { ...base, state: 'waiting', readyAheadCount: 2 })).toBe('앞에 준비된 노래 2곡이 있어요');
  });
  it('not ready → neutral copy', () => {
    expect(readyStageCopy('ko', { ...base, state: 'waiting', ready: false })).toBe('준비되면 재생 순서에 반영됩니다');
  });
  it('playing / done have their own copy', () => {
    expect(readyStageCopy('ko', { ...base, state: 'now_playing' })).toBe('지금 부르는 중입니다');
    expect(readyStageCopy('ko', { ...base, state: 'done' })).toBe('이 곡을 불렀어요');
  });
});

describe('hasActiveMedia — duplicate guard for 다시 신청', () => {
  const rows: OwnedRow[] = [
    { requestId: 'a', state: 'waiting', videoId: 'VID1' },
    { requestId: 'b', state: 'done', videoId: 'VID2' },
  ];
  it('same media already active → duplicate', () => {
    expect(hasActiveMedia('VID1', rows)).toBe(true);
  });
  it('same media only in completed history → NOT a duplicate (re-request allowed)', () => {
    expect(hasActiveMedia('VID2', rows)).toBe(false);
  });
  it('missing / unknown media → not a duplicate', () => {
    expect(hasActiveMedia(null, rows)).toBe(false);
    expect(hasActiveMedia('OTHER', rows)).toBe(false);
  });
});

describe('song-title normalization', () => {
  it('cleans a noisy KY karaoke title to the real song + artist', () => {
    const d = displaySong('[KY ENTERTAINMENT] 하여가 - 서태지와 아이들 (KY.2213) / KY Karaoke', 'KY Karaoke');
    expect(d.song).toBe('하여가');
    expect(d.artist).toBe('서태지와 아이들');
  });
  it('does not lead with the raw bracketed title', () => {
    expect(cleanSongTitle('[MV] 밤편지 (Official)')).not.toContain('[MV]');
  });
  it('keeps a non-karaoke title as the song and uses the channel as artist', () => {
    const d = displaySong('Blueming', 'IU Official');
    expect(d.song).toBe('Blueming');
    expect(d.artist).toBe('IU');
  });
});
