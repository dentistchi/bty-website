// BUILD 26B — DJ console fixtures.
//
// These are typed against the REAL server types on purpose. During the 26B audit a
// hand-written `eventStatus` (guessed as `{id, startedAt}`) crashed the status
// sheet, and that crash was briefly mistaken for a product defect. It was a
// fixture mistake: the real DjEventStatus carries `counts`, `nowPlaying`, `upNext`
// and `startsAt`/`endedAt`. Importing the types makes that class of false defect a
// compile error instead of a red test.
import type { DjEventStatus } from '@/lib/events.server';
import type { KaraokeSession } from '@/lib/sessions.server';

export const HARNESS_SLUG = 'harness-room';

type Row = {
  id: string;
  guest_name: string;
  search_query: string | null;
  youtube_video_id: string;
  youtube_title: string;
  youtube_channel_title: string;
  youtube_thumbnail_url: string | null;
  position: number;
  status: 'waiting' | 'playing' | 'completed' | 'removed' | 'skipped';
  ready_at: string | null;
  event_id: string;
  created_at: string;
};

const row = (id: string, status: Row['status'], title: string, ready: boolean): Row => ({
  id,
  guest_name: `게스트${id}`,
  search_query: null,
  youtube_video_id: `vid${id}`,
  youtube_title: title,
  youtube_channel_title: 'TJ노래방 공식 유튜브채널',
  youtube_thumbnail_url: null,
  position: Number(id),
  status,
  ready_at: ready ? '2026-08-03T14:00:00Z' : null,
  event_id: 'evt-1',
  created_at: '2026-08-03T13:00:00Z',
});

const ACTIVE_SESSION: KaraokeSession = {
  id: 'sess-1',
  room_id: '00000000-0000-4000-8000-000000000001',
  status: 'active',
  started_at: '2026-08-03T12:00:00Z',
  ended_at: null,
};

const eventStatus = (over: Partial<DjEventStatus> = {}): DjEventStatus => ({
  name: '오늘 밤',
  startsAt: '2026-08-03T12:00:00Z',
  endedAt: null,
  status: 'active',
  counts: { guests: 3, requests: 5, completed: 2, waiting: 4, skipped: 1 },
  nowPlaying: { title: 'All For You', guestName: '게스트1' },
  upNext: { title: '바람의 노래', guestName: '게스트2' },
  ...over,
});

export interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: Row[];
  eventStatus: DjEventStatus | null;
  playback: null;
}

/** A live night: one song on stage, four waiting — the ordinary operating state. */
export const ACTIVE: QueuePayload = {
  room: { display_name: 'Harness Room', status: 'open' },
  role: 'admin',
  session: ACTIVE_SESSION,
  stats: { requests: 5, guests: 3 },
  requests: [
    row('1', 'playing', '[TJ노래방] All For You(응답하라1997 OST) - 서인국,정은지 / TJ Karaoke', true),
    row('2', 'waiting', '[TJ노래방] 조용필 - 바람의 노래 / TJ Karaoke', true),
    row('3', 'waiting', '[TJ노래방] 미도와 파라솔 - 너에게 난, 나에게 넌 / TJ Karaoke', false),
    row('4', 'waiting', '피아노 반주 생일 축하합니다 | 생일 축하곡 | Happy birthday', true),
    row('5', 'waiting', '생일축하노래 MR 부드러운 발라드 버젼 │ 생일축하송', false),
  ],
  eventStatus: eventStatus(),
  playback: null,
};

/** Nothing requested yet. */
export const EMPTY: QueuePayload = {
  ...ACTIVE,
  session: null,
  stats: { requests: 0, guests: 0 },
  requests: [],
  eventStatus: eventStatus({
    counts: { guests: 0, requests: 0, completed: 0, waiting: 0, skipped: 0 },
    nowPlaying: null,
    upNext: null,
  }),
};

/** The night is over — no stale active controls may remain. */
export const ENDED: QueuePayload = {
  ...EMPTY,
  eventStatus: eventStatus({
    status: 'ended',
    endedAt: '2026-08-03T15:00:00Z',
    counts: { guests: 3, requests: 5, completed: 4, waiting: 0, skipped: 1 },
    nowPlaying: null,
    upNext: null,
  }),
};
