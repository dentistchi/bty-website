// BUILD R4E-R1 — the events console service against a PRODUCTION-SHAPED fake database.
//
// The fixture reproduces the shape R4E-R0 measured on 2026-08-18: 43 events, of which 3 are truly
// live, 9 are active-but-stale, 4 ended within 14 days, 12 are older history, 6 are
// account-deletion tombstones in retired rooms, and the rest are founder tests in ownerless
// manager-console rooms. If the headline summary is wrong, these numbers move.

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { [k: string]: unknown }
const DB: Record<string, Row[]> = {};

// A chainable, thenable fake: every builder method returns the builder, and awaiting it anywhere
// in the chain resolves the table's rows. Filters are ignored on purpose — the fixtures are already
// shaped as the query would leave them, so the test exercises CLASSIFICATION, not PostgREST.
vi.mock('./supabase.server', () => ({
  karaokeDb: () => ({
    from(table: string) {
      const result = () => ({ data: DB[table] ?? [], error: null });
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'neq', 'eq', 'in', 'order', 'limit', 'gte', 'lte']) {
        q[m] = () => q;
      }
      q.then = (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve(res(result()));
      return q;
    },
  }),
}));

import { listEventConsole } from './events.server';

const NOW = Date.parse('2026-08-19T02:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86400000).toISOString();

const ev = (id: string, name: string, roomId: string, status: string, createdDays: number, endedDays?: number) => ({
  id, name, room_id: roomId, status,
  created_at: ago(createdDays), starts_at: ago(createdDays),
  ended_at: endedDays == null ? null : ago(endedDays),
  host_name: null, public_code: id.toUpperCase(), guest_slug: id, updated_at: ago(createdDays), created_by: null,
});
const req = (eventId: string, guest: string, daysAgo: number) => ({
  event_id: eventId, room_id: 'r', guest_name: guest, status: 'completed', created_at: ago(daysAgo),
});

function seed() {
  const events: Row[] = [];
  const requests: Row[] = [];

  // 3 TRUE ACTIVE — real activity inside the window.
  events.push(ev('joy', 'Joy', 'room-owned-1', 'active', 20));
  requests.push(req('joy', 'a', 0), req('joy', 'b', 1));
  events.push(ev('demo', 'BTY Demo Room', 'room-owned-2', 'active', 3));
  requests.push(req('demo', 'a', 2));
  events.push(ev('bty', 'btyNorebang', 'room-owned-3', 'active', 14));
  requests.push(req('bty', 'a', 3));

  // 9 STALE — 4 had activity then went quiet, 5 never had any.
  for (let i = 0; i < 4; i++) {
    events.push(ev(`stale-${i}`, `Stale ${i}`, `room-owned-4${i}`, 'active', 20));
    requests.push(req(`stale-${i}`, 'g', 9 + i));
  }
  for (let i = 0; i < 5; i++) events.push(ev(`empty-${i}`, `Empty ${i}`, `room-owned-5${i}`, 'active', 12 + i));

  // 4 RECENT (ended <=14d) and 12 ENDED (older).
  for (let i = 0; i < 4; i++) events.push(ev(`recent-${i}`, `Recent ${i}`, 'room-owned-2', 'ended', 5, 3 + i));
  for (let i = 0; i < 12; i++) events.push(ev(`old-${i}`, `Old ${i}`, 'room-owned-1', 'ended', 30, 19 + i));

  // 6 tombstones in retired rooms.
  for (let i = 0; i < 6; i++) events.push(ev(`tomb-${i}`, '(삭제된 이벤트)', `room-retired-${i}`, 'ended', 12, 9));

  // 3 founder tests in ownerless manager-console rooms.
  for (let i = 1; i <= 3; i++) events.push(ev(`prot-${i}`, `PRO Multi-Room Test ${i}`, `room-ownerless-${i}`, 'active', 26));

  DB.karaoke_events = events;
  DB.karaoke_requests = requests;
  DB.karaoke_dj_devices = [];
  DB.karaoke_rooms = [
    ...['room-owned-1', 'room-owned-2', 'room-owned-3'].map((id) => ({ id, status: 'open' })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `room-owned-4${i}`, status: 'open' })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `room-owned-5${i}`, status: 'open' })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `room-retired-${i}`, status: 'retired' })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `room-ownerless-${i + 1}`, status: 'open' })),
  ];
  DB.karaoke_room_ownership = (DB.karaoke_rooms as Array<{ id: string }>)
    .filter((r) => !r.id.startsWith('room-ownerless'))
    .map((r) => ({ room_id: r.id, workspace_id: 'ws-1' }));
  DB.karaoke_workspace_members = [{ workspace_id: 'ws-1', status: 'active' }];
}
beforeEach(seed);

const list = (view?: string) =>
  listEventConsole({ view: view as never, nowMs: NOW, limit: 50 });

describe('R4E-R1 — (16) the top summary', () => {
  it('reports Active 3 · Recent 4 · Needs Attention 9 · Deleted/Archived 6', async () => {
    const r = await list('all');
    expect(r.totals.active).toBe(3);
    expect(r.totals.recent).toBe(4);
    expect(r.totals.stale).toBe(9);
    expect(r.totals.deleted).toBe(6);
    expect(r.totals.test).toBe(3);
    expect(r.totals.ended).toBe(12);
    expect(r.totals.all).toBe(37);
  });

  it('(15) totals are identical whichever view is open', async () => {
    const a = await list('active');
    const b = await list('deleted');
    expect(a.totals).toEqual(b.totals);
  });
});

describe('R4E-R1 — (2,3,4,5,10,11) views', () => {
  it('(2,3) the DEFAULT view is Active and returns exactly the live events', async () => {
    const r = await listEventConsole({ nowMs: NOW });
    expect(r.events).toHaveLength(3);
    expect(r.events.map((e) => e.event.name).sort()).toEqual(['BTY Demo Room', 'Joy', 'btyNorebang']);
  });

  it('(4) stale active events never appear in Active', async () => {
    const r = await list('active');
    expect(r.events.some((e) => e.event.name.startsWith('Stale'))).toBe(false);
    expect(r.events.some((e) => e.event.name.startsWith('Empty'))).toBe(false);
  });

  it('(5,7) stale — including never-used — events appear in Needs Attention', async () => {
    const r = await list('needs-attention');
    expect(r.events).toHaveLength(9);
    expect(r.events.filter((e) => e.event.name.startsWith('Empty'))).toHaveLength(5);
  });

  it('(10,11) tombstones are out of Active and reachable under Deleted / Archived', async () => {
    expect((await list('active')).events.some((e) => e.event.name === '(삭제된 이벤트)')).toBe(false);
    const d = await list('deleted');
    expect(d.events).toHaveLength(6);
    expect(d.events.every((e) => e.eventClass === 'DELETED_ARCHIVED')).toBe(true);
  });

  it('(12) proven founder tests land in Test, not Active', async () => {
    const t = await list('test');
    expect(t.events).toHaveLength(3);
    expect(t.events.every((e) => e.event.name.startsWith('PRO Multi-Room Test'))).toBe(true);
    expect((await list('active')).events.some((e) => e.event.name.startsWith('PRO'))).toBe(false);
  });

  it('(8,9) Recent holds only the last 14 days of ended events', async () => {
    const r = await list('recent');
    expect(r.events).toHaveLength(4);
    expect((await list('ended')).events).toHaveLength(12);
  });

  it('All returns every row and hides nothing', async () => {
    const r = await list('all');
    expect(r.events).toHaveLength(37);
  });
});

describe('R4E-R1 — (17,18) ordering and (D) last activity', () => {
  it('(17) Active is ordered by last activity, freshest first', async () => {
    const r = await list('active');
    expect(r.events.map((e) => e.event.name)).toEqual(['Joy', 'BTY Demo Room', 'btyNorebang']);
  });

  it('(18) Recent is ordered by ended_at, most recent first', async () => {
    const r = await list('recent');
    const ends = r.events.map((e) => Date.parse(e.event.ended_at!));
    expect(ends).toEqual([...ends].sort((a, b) => b - a));
  });

  it('lastActivityAt falls back to the event start when no request exists', async () => {
    const r = await list('needs-attention');
    const empty = r.events.find((e) => e.event.name === 'Empty 0')!;
    expect(empty.lastActivityAt).toBe(empty.event.starts_at);
  });

  it('(N) reports its management window rather than claiming all history', async () => {
    const r = await list('all');
    expect(r.window).toEqual({ limit: 50, returned: 37 });
  });
});

describe('R4E-R1 — (19,20,21) the DJ badge is event-scoped', () => {
  it('(20) a month-stale room device never lights an ended event', async () => {
    DB.karaoke_dj_devices = [
      { room_id: 'room-owned-1', label: 'iPad', status: 'active', role: 'dj', last_used_at: ago(29), created_at: ago(40) },
    ];
    const ended = await list('ended');
    expect(ended.events.every((e) => e.djLive === false)).toBe(true);
    // …and not even the ACTIVE event in that same room, because the device is 29 days cold.
    const active = await list('active');
    expect(active.events.find((e) => e.event.name === 'Joy')!.djLive).toBe(false);
  });

  it('(21) a genuinely recent device lights only the live event', async () => {
    DB.karaoke_dj_devices = [
      { room_id: 'room-owned-1', label: 'iPad', status: 'active', role: 'dj', last_used_at: ago(0), created_at: ago(40) },
    ];
    expect((await list('active')).events.find((e) => e.event.name === 'Joy')!.djLive).toBe(true);
    expect((await list('ended')).events.every((e) => e.djLive === false)).toBe(true);
  });
});
