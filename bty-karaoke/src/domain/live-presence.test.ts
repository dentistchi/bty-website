import { describe, it, expect } from 'vitest';
import {
  selectLivePresence,
  presenceState,
  formatEventDuration,
  type LiveRow,
  type GuestLivePresence,
} from './live-presence';

const row = (over: Partial<LiveRow>): LiveRow => ({
  id: 'id',
  status: 'waiting',
  position: 1,
  created_at: '2026-07-14T00:00:00.000Z',
  started_at: null,
  guest_name: 'Guest',
  youtube_title: 'Song',
  search_query: null,
  youtube_video_id: 'vid',
  youtube_thumbnail_url: null,
  ...over,
});

describe('selectLivePresence', () => {
  it('no active rows → nothing playing, nothing up next (first-song-ready)', () => {
    expect(selectLivePresence([])).toEqual({ nowPlaying: null, upNext: null });
  });

  it('waiting only → up next, no now playing', () => {
    const r = selectLivePresence([row({ id: 'a', status: 'waiting', youtube_title: 'Dancing Queen', guest_name: 'Sarah' })]);
    expect(r.nowPlaying).toBeNull();
    expect(r.upNext).toEqual({ title: 'Dancing Queen', guestName: 'Sarah', thumbnailUrl: null });
  });

  it('playing only → now singing, no up next', () => {
    const r = selectLivePresence([
      row({ id: 'p', status: 'playing', youtube_title: 'Perfect', guest_name: 'John', started_at: '2026-07-14T01:00:00.000Z' }),
    ]);
    expect(r.upNext).toBeNull();
    expect(r.nowPlaying).toEqual({ title: 'Perfect', guestName: 'John', thumbnailUrl: null, startedAt: '2026-07-14T01:00:00.000Z' });
  });

  it('playing + waiting → both; up next excludes the playing row', () => {
    const r = selectLivePresence([
      row({ id: 'w', status: 'waiting', position: 2, youtube_title: 'Dancing Queen', guest_name: 'Sarah' }),
      row({ id: 'p', status: 'playing', position: 1, youtube_title: 'Perfect', guest_name: 'John', started_at: '2026-07-14T01:00:00.000Z' }),
    ]);
    expect(r.nowPlaying?.title).toBe('Perfect');
    expect(r.upNext).toEqual({ title: 'Dancing Queen', guestName: 'Sarah', thumbnailUrl: null });
  });

  it('multiple waiting → canonical first (lowest position) is up next', () => {
    const r = selectLivePresence([
      row({ id: 'b', status: 'waiting', position: 5, youtube_title: 'Later' }),
      row({ id: 'a', status: 'waiting', position: 2, youtube_title: 'Sooner' }),
    ]);
    expect(r.upNext?.title).toBe('Sooner');
  });

  it('abnormal multiple playing → deterministic: most-recently-started wins', () => {
    const rows = [
      row({ id: 'old', status: 'playing', youtube_title: 'Old', started_at: '2026-07-14T01:00:00.000Z' }),
      row({ id: 'new', status: 'playing', youtube_title: 'New', started_at: '2026-07-14T02:00:00.000Z' }),
    ];
    expect(selectLivePresence(rows).nowPlaying?.title).toBe('New');
    // Order-independent (deterministic regardless of input order).
    expect(selectLivePresence([...rows].reverse()).nowPlaying?.title).toBe('New');
  });

  it('title falls back search_query → placeholder, never the video id', () => {
    const q = selectLivePresence([row({ id: 'q', status: 'playing', youtube_title: null, search_query: 'aespa spicy' })]);
    expect(q.nowPlaying?.title).toBe('aespa spicy');
    const none = selectLivePresence([row({ id: 'n', status: 'playing', youtube_title: null, search_query: null, youtube_video_id: 'RAWID' })]);
    expect(none.nowPlaying?.title).toBe('Untitled request');
    expect(none.nowPlaying?.title).not.toContain('RAWID');
  });

  it('does not mutate its input', () => {
    const rows = [row({ id: 'a', position: 3 }), row({ id: 'b', position: 1 })];
    const snapshot = JSON.stringify(rows);
    selectLivePresence(rows);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});

const presence = (over: Partial<GuestLivePresence>): GuestLivePresence => ({
  event: { name: 'Friday Night', hostName: 'Dr. Chi', status: 'active' },
  nowPlaying: null,
  upNext: null,
  counts: { guests: 0, requests: 0, waiting: 0 },
  ...over,
});

describe('presenceState', () => {
  it('maps each combination to the guest-facing state', () => {
    expect(presenceState(presence({}))).toBe('ready');
    expect(presenceState(presence({ upNext: { title: 'X', guestName: 'A', thumbnailUrl: null } }))).toBe('up_next');
    expect(presenceState(presence({ nowPlaying: { title: 'X', guestName: 'A', thumbnailUrl: null, startedAt: null } }))).toBe('now_singing');
    expect(
      presenceState(
        presence({
          nowPlaying: { title: 'X', guestName: 'A', thumbnailUrl: null, startedAt: null },
          upNext: { title: 'Y', guestName: 'B', thumbnailUrl: null },
        }),
      ),
    ).toBe('now_singing_up_next');
  });

  it('formatEventDuration formats hours+minutes, minutes, and edges', () => {
    const start = '2026-07-14T00:00:00.000Z';
    const at = (min: number) => Date.parse(start) + min * 60_000;
    expect(formatEventDuration(start, at(84))).toBe('1h 24m');
    expect(formatEventDuration(start, at(24))).toBe('24m');
    expect(formatEventDuration(start, at(0) + 30_000)).toBe('<1m');
    expect(formatEventDuration(start, at(120))).toBe('2h 0m');
    expect(formatEventDuration(null, at(84))).toBe('');
    expect(formatEventDuration(start, Date.parse(start) - 5_000)).toBe('0m'); // clock skew guard
  });

  it('ended/archived event overrides any queue state', () => {
    expect(presenceState(presence({ event: { name: 'F', hostName: null, status: 'ended' } }))).toBe('ended');
    expect(
      presenceState(
        presence({
          event: { name: 'F', hostName: null, status: 'archived' },
          nowPlaying: { title: 'X', guestName: 'A', thumbnailUrl: null, startedAt: null },
        }),
      ),
    ).toBe('ended');
  });
});
