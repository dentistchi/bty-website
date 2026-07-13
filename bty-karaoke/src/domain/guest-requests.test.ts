import { describe, it, expect } from 'vitest';
import {
  myRequestsKey,
  isTerminalState,
  pruneMyRequests,
  addMyRequest,
  collapsedSummary,
  cancelRowAction,
  MY_REQUESTS_TTL_MS,
  type MyRequest,
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
  it('scopes the key per room', () => {
    expect(myRequestsKey('bty-home')).toBe('bty-karaoke:bty-home:my-requests');
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
    const s = collapsedSummary([]);
    expect(s.count).toBe(0);
    expect(s.nearestPosition).toBeNull();
    expect(s.label).toBe('');
  });
  it('reports the nearest position unambiguously (no "N번 · N곡")', () => {
    const s = collapsedSummary([
      { state: 'waiting', position: 5 },
      { state: 'up_next', position: 1 },
    ]);
    expect(s.count).toBe(2);
    expect(s.nearestPosition).toBe(1);
    expect(s.label).toBe('가장 빠른 순번 1번');
    expect(s.label).not.toContain('곡'); // count lives outside the sub-line
  });
  it('uses a single-request phrasing when only one is active', () => {
    expect(collapsedSummary([{ state: 'waiting', position: 3 }]).label).toBe('지금 대기 3번');
  });
  it('drops terminal rows from the active count', () => {
    const s = collapsedSummary([
      { state: 'waiting', position: 3 },
      { state: 'done', position: 0 },
    ]);
    expect(s.count).toBe(1);
    expect(s.nearestPosition).toBe(3);
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
