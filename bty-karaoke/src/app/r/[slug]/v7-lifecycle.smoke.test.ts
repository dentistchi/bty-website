// V7 Event Lifecycle — wiring guards. These assert the End / Start-New / block-old-QR
// plumbing is present at each surface (server routes + guest / display / admin UI),
// complementing the behavioral proof in src/lib/events.lifecycle.test.ts.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// BUILD 26G — the replacement for a hard-coded-literal source scan.
//
// A Guest component no longer holds its copy, so scanning it for Korean text would assert
// nothing. The contract is now two-sided and STRONGER: the source must reference the catalog
// KEY, and the catalog must resolve that key to the pinned Korean AND to a non-empty English.
// A key that lost either language now fails here.
import { guestT, type GuestMessageKey } from '@/domain/guest-messages';

function rendersKey(source: string, key: GuestMessageKey, koreanIs?: string): boolean {
  if (!source.includes(`'${key}'`)) return false;
  const ko = guestT('ko', key);
  const en = guestT('en', key);
  if (!ko || !en || ko === key || en === key) return false;
  return koreanIs === undefined || ko === koreanIs;
}


const appRoot = fileURLToPath(new URL('../../', import.meta.url)); // src/app/
const read = (p: string) => readFileSync(appRoot + p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const adminSession = read('api/rooms/[slug]/admin/session/route.ts');
const startEvent = read('api/rooms/[slug]/admin/start-event/route.ts');
const endEvent = read('api/rooms/[slug]/dj/end-event/route.ts');
const guestReq = read('api/rooms/[slug]/requests/route.ts');
const readyRoute = read('api/rooms/[slug]/requests/[id]/ready/route.ts');
const djReq = read('api/rooms/[slug]/dj/requests/route.ts');
const guestQr = read('api/rooms/[slug]/guest-qr/route.ts');
const displayRoute = read('api/rooms/[slug]/display/route.ts');
const guestPage = read('r/[slug]/page.tsx');
const requestForm = read('r/[slug]/RequestForm.tsx');
const displayClient = read('r/[slug]/display/DisplayClient.tsx');
const djConsole = read('r/[slug]/dj/DjConsole.tsx');
const djBoard = read('r/[slug]/dj/DjBoard.tsx');

describe('PART A — no auto-create, ever (Event Lifecycle V1)', () => {
  it('the Admin Hub init is a PURE READ — no bootstrap/ensure create path', () => {
    expect(adminSession).toContain('getCanonicalEvent');
    expect(strip(adminSession)).not.toContain('ensureCanonicalLiveEvent');
    expect(strip(adminSession)).not.toContain('bootstrapInitialEvent');
    expect(strip(adminSession)).not.toContain('startNewEvent');
  });
  it('the Admin Hub surfaces the ended summary when no live event exists', () => {
    expect(adminSession).toContain('getLatestEndedEvent');
    expect(adminSession).toContain('endedEvent');
  });
});

describe('PART D — Start New Event route (admin-only rotation)', () => {
  it('authorizes as Admin (not merely DJ) and calls the GATED session start + a fresh session', () => {
    expect(startEvent).toContain('authorizeAdmin');
    // BUILD 26U-R1 — the unconditional `startNewEvent` is gone; opening a hosted session now
    // goes through the entitlement-gated authority, and this scan pins that so a future edit
    // cannot quietly restore an ungated create path on the Admin route.
    expect(startEvent).toContain('startHostedRoomSession');
    expect(startEvent).not.toContain('startNewEvent');
    expect(startEvent).toContain('startSession');
  });
  it('the Admin console wires a Start New Event action to this route', () => {
    expect(djConsole).toContain('/admin/start-event');
    expect(djConsole).toContain('onStartNewEvent');
  });
  it('the board shows a Start New Event button in the ended state', () => {
    expect(djBoard).toContain('onStartNewEvent');
    expect(djBoard).toContain('새 이벤트 시작');
    // gated behind an ended (non-active) event
    expect(djBoard).toMatch(/eventStatus.*status !== 'active'/);
  });
});

describe('PART B/K — End Event ends only the LIVE event, no all-status lookup', () => {
  it('the end-event route resolves the live event (never getEventByRoomId)', () => {
    expect(endEvent).toContain('getCanonicalEvent');
    expect(endEvent).not.toContain('getEventByRoomId');
  });
  it('no operational read uses the all-status getEventByRoomId anymore', () => {
    for (const src of [displayRoute, guestReq, djReq]) {
      expect(src).not.toContain('getEventByRoomId');
    }
  });
});

describe('PART E — the Guest QR is event-scoped so an old QR cannot join a new event', () => {
  it('the guest QR carries the live event id (?e=<id>)', () => {
    // BUILD 20B-R1 — the canonical builder appends ?e=<eventId>; the route passes the live event id.
    // The ?e= output is proven by guest-origin.test + the guest-qr route test.
    expect(guestQr).toMatch(/canonicalGuestRoomUrl\(\s*slug\s*,\s*event\?\.id\s*\)/);
  });
  it('the guest screen echoes its scoped eventId on submit', () => {
    expect(requestForm).toMatch(/eventId\s*\?\s*\{\s*eventId\s*\}/);
  });
  it('the request POST asserts the eventId through the honest gate', () => {
    expect(guestReq).toContain('assertedEventId');
    expect(guestReq).toContain('resolveEventAccess(room, assertedEventId)');
  });
  it('the guest page reads the ?e= param and renders an expired/ended notice', () => {
    expect(guestPage).toContain('searchParams');
    expect(guestPage).toContain('scopedToPastEvent');
    expect(rendersKey(guestPage, 'guest.event.ended.eyebrow', '이벤트 종료')).toBe(true);
    expect(rendersKey(guestPage, 'guest.event.ended.title', '이 노래방 이벤트는 종료됐어요')).toBe(true);
    // never auto-redirect or auto-create from a scan
    expect(strip(guestPage)).not.toContain('redirect(');
  });
});

describe('PART F/G — Guest + Display honest ended states', () => {
  it('the requests GET falls back to the latest ended event (so guest sees ended)', () => {
    expect(guestReq).toContain('getLatestEndedEvent');
  });
  it('the display route falls back to the latest ended event', () => {
    expect(displayRoute).toContain('getLatestEndedEvent');
  });
  it('the Display renders an ended stage instead of the join QR when ended', () => {
    expect(displayClient).toContain('EndedStage'); // V1.3 warm ended stage
    expect(displayClient).toContain('오늘의 무대가 끝났어요');
    expect(displayClient).toMatch(/\) : ended \? \(/);
  });
});

describe('PART H/I — mutation + ready gates refuse an ended event', () => {
  it('the ready route gates through resolveEventAccess', () => {
    expect(readyRoute).toContain('resolveEventAccess');
  });
  it('the DJ add-song route gates through resolveEventAccess', () => {
    expect(djReq).toContain('resolveEventAccess');
  });
  it('resolveEventAccess resolves ended events honestly (live ?? latest-ended)', () => {
    const events = read('../lib/events.server.ts');
    expect(events).toMatch(/getCanonicalEvent\(room\.id\)\)\s*\?\?\s*\(await getLatestEndedEvent/);
  });
});

describe('PART J — guest ownership localStorage is namespaced per event (rotation)', () => {
  it('the guest "my requests" key is keyed by eventId so a new event starts clean', () => {
    expect(requestForm).toContain('myRequestsKey(slug, eventId)');
  });
});

describe('invariants preserved — no guest Start/Finish, no Display video, no auto-finish', () => {
  it('the guest screen never re-introduces Start/Finish playback controls', () => {
    const form = strip(requestForm);
    expect(form).not.toMatch(/\/start\b/);
    expect(form).not.toMatch(/\/finish\b/);
  });
  it('the Display client embeds no video player (iframe/YouTube embed)', () => {
    expect(displayClient).not.toContain('<iframe');
    expect(displayClient).not.toContain('youtube.com/embed');
  });
});
