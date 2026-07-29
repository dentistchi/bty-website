// BUILD 20B-WEB7 — OPTION B Recently Sung reconciler. The false-history-prevention
// contract is the whole point: a performance records ONLY on a witnessed own
// playing→gone transition while the same Event stays live.

import { describe, it, expect } from 'vitest';
import {
  reconcileRecentlySung,
  parseRecentlySung,
  addRecentlySung,
  recentlySungKey,
  RECENTLY_SUNG_MAX,
  type OwnStatusRow,
  type PlayingSnapshot,
  type RecentlySung,
} from './recently-sung';

const row = (over: Partial<OwnStatusRow> & { requestId: string; state: OwnStatusRow['state'] }): OwnStatusRow => ({
  videoId: 'vid00000001',
  title: 'Song',
  artist: 'Artist',
  thumbnailUrl: null,
  ...over,
});

const proof = (requestId: string, videoId = 'vid00000001'): Record<string, PlayingSnapshot> => ({
  [requestId]: { requestId, videoId, title: 'Song', artist: 'Artist', thumbnailUrl: null },
});

describe('reconcileRecentlySung — recording', () => {
  it('own playing → done records one performance (finish→next / finish→idle)', () => {
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'done' })],
      unresolved: proof('r1'),
      eventActive: true,
      pollOk: true,
      nowMs: 100,
    });
    expect(r.recorded).toHaveLength(1);
    expect(r.recorded[0]).toMatchObject({ requestId: 'r1', videoId: 'vid00000001', sungAt: 100 });
    expect(r.unresolved).toEqual({}); // proof consumed
  });

  it('own playing → gone (not_found) records a performance', () => {
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'not_found' })],
      unresolved: proof('r1'),
      eventActive: true,
      pollOk: true,
      nowMs: 5,
    });
    expect(r.recorded).toHaveLength(1);
  });

  it('captures proof the moment an own request is seen now_playing', () => {
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'now_playing' })],
      unresolved: {},
      eventActive: true,
      pollOk: true,
      nowMs: 1,
    });
    expect(r.recorded).toHaveLength(0);
    expect(r.unresolved.r1).toBeTruthy(); // proof held, not yet recorded
  });
});

describe('reconcileRecentlySung — never records', () => {
  it('waiting / up_next never record and never capture proof', () => {
    for (const state of ['waiting', 'up_next'] as const) {
      const r = reconcileRecentlySung({
        own: [row({ requestId: 'r1', state })],
        unresolved: {},
        eventActive: true,
        pollOk: true,
        nowMs: 1,
      });
      expect(r.recorded).toHaveLength(0);
      expect(r.unresolved).toEqual({});
    }
  });

  it('still now_playing holds proof (no premature record on repeated polls)', () => {
    let unresolved = proof('r1');
    for (let i = 0; i < 3; i++) {
      const r = reconcileRecentlySung({
        own: [row({ requestId: 'r1', state: 'now_playing' })],
        unresolved,
        eventActive: true,
        pollOk: true,
        nowMs: i,
      });
      expect(r.recorded).toHaveLength(0);
      unresolved = r.unresolved;
    }
    expect(unresolved.r1).toBeTruthy();
  });

  it('repeated polls after done do not duplicate (proof consumed once)', () => {
    const first = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'done' })],
      unresolved: proof('r1'),
      eventActive: true,
      pollOk: true,
      nowMs: 1,
    });
    expect(first.recorded).toHaveLength(1);
    const second = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'done' })],
      unresolved: first.unresolved, // {}
      eventActive: true,
      pollOk: true,
      nowMs: 2,
    });
    expect(second.recorded).toHaveLength(0);
  });

  it('cancelled (removed) after playing drops proof without recording', () => {
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'removed' })],
      unresolved: proof('r1'),
      eventActive: true,
      pollOk: true,
      nowMs: 1,
    });
    expect(r.recorded).toHaveLength(0);
    expect(r.unresolved).toEqual({});
  });

  it('EVENT_ENDED / inactive Event records nothing and drops every proof', () => {
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'done' })],
      unresolved: proof('r1'),
      eventActive: false,
      pollOk: true,
      nowMs: 1,
    });
    expect(r.recorded).toHaveLength(0);
    expect(r.unresolved).toEqual({});
  });

  it('failed poll holds proofs and records nothing (a blip is not "left the stage")', () => {
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'done' })],
      unresolved: proof('r1'),
      eventActive: true,
      pollOk: false,
      nowMs: 1,
    });
    expect(r.recorded).toHaveLength(0);
    expect(r.unresolved.r1).toBeTruthy(); // proof preserved for a later good poll
  });

  it('page reload with no retained proof records nothing from a done status', () => {
    // A fresh session sees a request already 'done' but never witnessed it playing.
    const r = reconcileRecentlySung({
      own: [row({ requestId: 'r1', state: 'done' })],
      unresolved: {}, // in-memory proof set is empty after reload
      eventActive: true,
      pollOk: true,
      nowMs: 1,
    });
    expect(r.recorded).toHaveLength(0);
  });

  it('another guest is never in the own list, so it can never record', () => {
    const r = reconcileRecentlySung({
      own: [], // the other guest's now_playing is simply not among own requests
      unresolved: {},
      eventActive: true,
      pollOk: true,
      nowMs: 1,
    });
    expect(r.recorded).toHaveLength(0);
  });
});

describe('recently-sung list model', () => {
  it('same video sung twice → two rows (identity is requestId, not videoId)', () => {
    let list: RecentlySung[] = [];
    list = addRecentlySung(list, { requestId: 'r1', videoId: 'v', title: 'S', artist: 'A', thumbnailUrl: null, sungAt: 1 });
    list = addRecentlySung(list, { requestId: 'r2', videoId: 'v', title: 'S', artist: 'A', thumbnailUrl: null, sungAt: 2 });
    expect(list).toHaveLength(2);
  });

  it('caps at RECENTLY_SUNG_MAX, newest first', () => {
    let list: RecentlySung[] = [];
    for (let i = 0; i < RECENTLY_SUNG_MAX + 5; i++) {
      list = addRecentlySung(list, { requestId: `r${i}`, videoId: 'v', title: 'S', artist: null, thumbnailUrl: null, sungAt: i });
    }
    expect(list).toHaveLength(RECENTLY_SUNG_MAX);
    expect(list[0].sungAt).toBeGreaterThan(list[1].sungAt); // newest first
  });

  it('key is Event-scoped and falls back to room scope', () => {
    expect(recentlySungKey('room', 'evt')).toBe('bty-karaoke:room:evt:recently-sung');
    expect(recentlySungKey('room', null)).toBe('bty-karaoke:room:recently-sung');
  });

  it('parseRecentlySung tolerates junk and dedupes by requestId', () => {
    expect(parseRecentlySung(null)).toEqual([]);
    expect(parseRecentlySung('not json')).toEqual([]);
    const parsed = parseRecentlySung(
      JSON.stringify([
        { requestId: 'r1', videoId: 'v', title: 'S', artist: null, thumbnailUrl: null, sungAt: 1 },
        { requestId: 'r1', videoId: 'v', title: 'S', artist: null, thumbnailUrl: null, sungAt: 1 },
        { nope: true },
      ]),
    );
    expect(parsed).toHaveLength(1);
  });
});
