// V7.1 Event-Scoped State Correction — wiring guards. Assert that every screen and
// every statistic is computed from ONE explicit eventId, never room-wide history,
// and that an already-open guest screen transitions to ended. Complements the
// behavioral proof in src/lib/events.lifecycle.test.ts.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../../', import.meta.url)); // src/app/
const libRoot = fileURLToPath(new URL('../../../lib/', import.meta.url)); // src/lib/
const migRoot = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const readApp = (p: string) => readFileSync(appRoot + p, 'utf8');
const readLib = (p: string) => readFileSync(libRoot + p, 'utf8');

const events = readLib('events.server.ts');
const rooms = readLib('rooms.server.ts');
const displayRoute = readApp('api/rooms/[slug]/display/route.ts');
const djQueue = readApp('api/rooms/[slug]/dj/queue/route.ts');
const adminSession = readApp('api/rooms/[slug]/admin/session/route.ts');
const guestReq = readApp('api/rooms/[slug]/requests/route.ts');
const djReq = readApp('api/rooms/[slug]/dj/requests/route.ts');
const guestPage = readApp('r/[slug]/page.tsx');
const liveGuard = readApp('r/[slug]/RoomLiveGuard.tsx');
const displayClient = readApp('r/[slug]/display/DisplayClient.tsx');
const djBoard = readApp('r/[slug]/dj/DjBoard.tsx');

describe('migration — requests carry an event_id (additive, indexed)', () => {
  it('a migration adds event_id to karaoke_requests with an index', () => {
    const file = readdirSync(migRoot).find((f) => f.includes('request_event_id'));
    expect(file).toBeTruthy();
    const sql = readFileSync(migRoot + file, 'utf8');
    expect(sql).toMatch(/add column if not exists event_id/i);
    expect(sql).toMatch(/references public\.karaoke_events/i);
    expect(sql).toMatch(/create index if not exists .*event/i);
  });
});

describe('PART A/B — every stat read is event-scoped, never room-wide', () => {
  it('the room-wide statRowsForRooms sweep is gone; statRowsForEvents replaces it', () => {
    expect(events).not.toContain('statRowsForRooms');
    expect(events).toContain('statRowsForEvents');
    expect(events).toContain('eventStatsById');
  });
  it('statRowsForEvents filters requests by event_id (not room_id)', () => {
    const body = events.slice(events.indexOf('function statRowsForEvents'));
    expect(body.slice(0, 400)).toMatch(/\.in\('event_id'/);
  });
  it('the DJ/Admin header (getEventStatusForRoom) is event-scoped', () => {
    const body = events.slice(events.indexOf('function getEventStatusForRoom'), events.indexOf('function getEventStatusForRoom') + 1100);
    expect(body).toContain('statRowsForEvents([event.id])');
    expect(body).toContain('listActiveRequests(roomId, event.id)');
  });
  it('the guest live-presence counts are event-scoped', () => {
    const body = events.slice(events.indexOf('function getGuestLivePresenceByEvent'));
    expect(body.slice(0, 700)).toContain('statRowsForEvents([event.id])');
  });
  it('the manager event list keys stats by event id, not room id', () => {
    const body = events.slice(events.indexOf('function listEventSummaries'));
    expect(body.slice(0, 700)).toContain('statRowsForEvents(events.map');
    expect(body.slice(0, 700)).toContain('stats.get(event.id)');
  });
});

describe('rooms.server — queue + display stats accept and apply an eventId', () => {
  it('listActiveRequests scopes by event_id when given one', () => {
    const body = rooms.slice(rooms.indexOf('function listActiveRequests'));
    expect(body.slice(0, 600)).toMatch(/eventId\?: string \| null/);
    expect(body.slice(0, 600)).toMatch(/if \(eventId\) q = q\.eq\('event_id', eventId\)/);
  });
  it('displayStatRows scopes by event_id when given one, else room', () => {
    const body = rooms.slice(rooms.indexOf('function displayStatRows'));
    expect(body.slice(0, 500)).toMatch(/eventId \? q\.eq\('event_id', eventId\) : q\.eq\('room_id', roomId\)/);
  });
  it('getDisplayState threads the eventId into queue + stats', () => {
    const body = rooms.slice(rooms.indexOf('function getDisplayState'));
    expect(body.slice(0, 1200)).toContain('listActiveRequests(room.id, eventId)');
    expect(body.slice(0, 1200)).toContain('displayStatRows(room.id, eventId)');
  });
  it('addRequest stamps the event_id column', () => {
    const body = rooms.slice(rooms.indexOf('function addRequest'));
    expect(body.slice(0, 1200)).toContain('event_id: args.eventId ?? null');
  });
});

describe('routes resolve the event and pass its id into every read', () => {
  it('display route reads state scoped to the resolved event id', () => {
    expect(displayRoute).toContain('getDisplayState(room, event?.id ?? null)');
  });
  it('dj/queue scopes queue + stats to the live event id', () => {
    expect(djQueue).toContain('listActiveRequests(auth.room.id, event?.id ?? null)');
    expect(djQueue).toContain('activeRequestStats(auth.room.id, event?.id ?? null)');
  });
  it('admin/session scopes live stats to the event and adds ended-summary counts', () => {
    expect(adminSession).toContain('activeRequestStats(auth.room.id, event?.id ?? null)');
    expect(adminSession).toContain('eventStatsById(endedEvent.id)');
    expect(adminSession).toMatch(/counts:\s*\{[\s\S]*singers:/);
  });
  it('guest requests GET scopes the queue to the live event', () => {
    expect(guestReq).toContain('listActiveRequests(room.id, live?.id ?? null)');
  });
  it('guest + DJ inserts stamp the request with the live event id', () => {
    expect(guestReq).toContain('eventId: access.event?.id ?? null');
    expect(djReq).toContain('eventId: access.event?.id ?? null');
  });
});

describe('PART E/F — an already-open guest screen transitions to ended', () => {
  it('the page wraps the form/board in a live guard holding the initial eventId', () => {
    expect(guestPage).toContain('RoomLiveGuard');
    expect(guestPage).toContain('initialEventId={eventId}');
  });
  it('the guard polls, and flips to ended on ended-status OR a superseding event', () => {
    expect(liveGuard).toContain("status === 'ended'");
    expect(liveGuard).toContain('ev.id !== initialEventId'); // rotation → superseded
    expect(liveGuard).toContain("cache: 'no-store'");
    // A legacy eventless screen is never force-ended.
    expect(liveGuard).toContain('if (!initialEventId) return');
  });
});

describe('PART G — Display join QR (V1.3: warm central invitation while waiting)', () => {
  it('the waiting stage frames the QR as a prominent central invitation', () => {
    // V1.3 supersedes the V7.1 "no central QR": an empty stage now invites warmly.
    expect(displayClient).toContain('js-invite-qr');
    expect(displayClient).toContain('오늘의 무대가 곧 시작됩니다');
    expect(displayClient).toContain('함께 부르고 싶은 노래를 신청해 주세요');
    // The top-right header QR is suppressed while waiting so there is ONE QR.
    expect(displayClient).toMatch(/mode !== 'waiting'/);
  });
  it('the top-right QR is hidden once the event has ended', () => {
    expect(displayClient).toContain('qr && !ended');
  });
  it('the QR re-fetches when the canonical event id changes (rotation)', () => {
    expect(displayClient).toMatch(/\[slug, eventId\]/);
  });
});

describe('PART H — Admin hides the Guest QR action on an ended event', () => {
  it('the Guest QR button is gated behind !eventEnded', () => {
    expect(djBoard).toContain('const eventEnded =');
    expect(djBoard).toContain('{!eventEnded && (');
  });
});

describe('invariants preserved', () => {
  it('guest requests GET is no-store (PART J)', () => {
    expect(guestReq).toMatch(/Cache-Control.*no-store/);
  });
  it('no Display video, no guest Start/Finish playback controls', () => {
    expect(displayClient).not.toContain('<iframe');
    expect(displayClient).not.toContain('youtube.com/embed');
  });
});
