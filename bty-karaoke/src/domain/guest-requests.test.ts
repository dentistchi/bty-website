import { describe, it, expect } from 'vitest';
import {
  myRequestsKey,
  isTerminalState,
  pruneMyRequests,
  addMyRequest,
  collapsedSummary,
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
});

describe('collapsedSummary', () => {
  it('is empty label with no active requests', () => {
    expect(collapsedSummary([]).count).toBe(0);
  });
  it('leads with the soonest waiting position and total count', () => {
    const s = collapsedSummary([
      { state: 'waiting', position: 5 },
      { state: 'up_next', position: 1 },
    ]);
    expect(s.count).toBe(2);
    expect(s.label).toBe('대기 1번 · 2곡');
  });
  it('drops terminal rows from the active count', () => {
    const s = collapsedSummary([
      { state: 'waiting', position: 3 },
      { state: 'done', position: 0 },
    ]);
    expect(s.count).toBe(1);
    expect(s.label).toBe('대기 3번');
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
