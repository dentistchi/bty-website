// V7 Event Lifecycle — behavioral proof against a fake Supabase that models the
// one-live-Event-per-room invariant (partial unique index) plus the request/session
// side-effects of ending an Event. Proves the NON-NEGOTIABLE V7 rules:
//   - bootstrap NEVER re-creates a live Event after one was ended (PART A);
//   - Start New Event mints a fresh Event with a NEW guest_slug + is double-tap safe (PART D);
//   - End Event flips status→ended, records ended_at, removes waiting + completes
//     playing requests, and clears the ready signal (PART B);
//   - ended + live Events coexist without any all-status lookup throwing (PART K).

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Ev {
  id: string;
  room_id: string;
  name: string;
  public_code: string;
  guest_slug: string;
  status: string;
  starts_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
interface Req {
  id: string;
  room_id: string;
  status: string;
  ready_at: string | null;
  event_id?: string | null;
  guest_name?: string;
}
interface Sess {
  id: string;
  room_id: string;
  status: string;
  ended_at: string | null;
}

const db = {
  events: [] as Ev[],
  requests: [] as Req[],
  sessions: [] as Sess[],
  seq: 0,
};

function liveFor(roomId: string): Ev | undefined {
  return db.events.find(
    (e) => e.room_id === roomId && (e.status === 'draft' || e.status === 'active'),
  );
}

// Models the end_karaoke_event RPC against the in-memory tables: WAITING→removed,
// PLAYING→skipped (NOT completed), session ended, event→ended, returns the honest
// summary. Idempotent for an already ended/archived event (closes nothing, still
// reports completed_count). Request rows are scoped by event_id (V7.1).
function fakeEndEventRpc(eventId: string) {
  const ev = db.events.find((e) => e.id === eventId);
  // The real RPC returns SQL NULL for an unknown event (caller maps to 404).
  if (!ev) return { data: null as unknown, error: null };
  const completedCount = () =>
    db.requests.filter((r) => r.event_id === eventId && r.status === 'completed').length;
  if (ev.status === 'ended' || ev.status === 'archived') {
    return {
      data: {
        eventId,
        status: ev.status,
        endedAt: ev.ended_at,
        completedCount: completedCount(),
        unfinishedClosedCount: 0,
      },
      error: null,
    };
  }
  for (const s of db.sessions) {
    if (s.room_id === ev.room_id && s.status === 'active') {
      s.status = 'ended';
      s.ended_at = '2026-07-19T00:00:00Z';
    }
  }
  let closed = 0;
  for (const r of db.requests) {
    if (r.event_id === eventId && r.status === 'waiting') {
      r.status = 'removed';
      r.ready_at = null;
      (r as { youtube_queued_at?: string | null }).youtube_queued_at = null;
      closed++;
    }
  }
  for (const r of db.requests) {
    if (r.event_id === eventId && r.status === 'playing') {
      r.status = 'skipped';
      r.ready_at = null;
      (r as { youtube_queued_at?: string | null }).youtube_queued_at = null;
      closed++;
    }
  }
  ev.status = 'ended';
  ev.ended_at = '2026-07-19T00:00:00Z';
  return {
    data: {
      eventId,
      status: 'ended',
      endedAt: ev.ended_at,
      completedCount: completedCount(),
      unfinishedClosedCount: closed,
    },
    error: null,
  };
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc(name: string, params: Record<string, unknown>) {
      if (name === 'end_karaoke_event') {
        return Promise.resolve(fakeEndEventRpc(String(params.p_event_id)));
      }
      // BUILD 26U-R1 — the create path is now an RPC. The emulation preserves the two
      // properties this describe-block proves: a fresh identity after an ended round, and
      // double-tap safety (an incumbent live Event is returned, never a second one).
      if (name === 'karaoke_start_premium_room_session') {
        const roomId = String(params.p_room_id);
        const live = db.events.find(
          (e) => e.room_id === roomId && (e.status === 'draft' || e.status === 'active'),
        );
        if (live) {
          return Promise.resolve({
            data: { outcome: 'already_live', eventId: live.id, activated: false },
            error: null,
          });
        }
        const ev = seedEvent({
          room_id: roomId,
          name: String(params.p_name),
          public_code: String(params.p_public_code),
          guest_slug: String(params.p_guest_slug),
          status: 'active',
        });
        return Promise.resolve({
          data: { outcome: 'ok', eventId: ev.id, activated: true, source: 'ACTIVATED_PASS', expiresAt: null },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    },
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let inFilter: { col: string; vals: unknown[] } | null = null;
      let orderCol: string | null = null;
      let orderAsc = true;
      let lim: number | null = null;
      let insertRow: Record<string, unknown> | null = null;
      let updateRow: Record<string, unknown> | null = null;

      const arrFor = (): Record<string, unknown>[] =>
        table === 'karaoke_events'
          ? (db.events as unknown as Record<string, unknown>[])
          : table === 'karaoke_requests'
            ? (db.requests as unknown as Record<string, unknown>[])
            : (db.sessions as unknown as Record<string, unknown>[]);

      const matched = (): Record<string, unknown>[] => {
        let rows = arrFor().filter((r) => filters.every(([c, v]) => r[c] === v));
        if (inFilter) rows = rows.filter((r) => inFilter!.vals.includes(r[inFilter!.col]));
        if (orderCol) {
          const col = orderCol;
          rows = [...rows].sort((a, b) => {
            const av = String(a[col] ?? '');
            const bv = String(b[col] ?? '');
            return (av < bv ? -1 : av > bv ? 1 : 0) * (orderAsc ? 1 : -1);
          });
        }
        if (lim != null) rows = rows.slice(0, lim);
        return rows;
      };

      const applyInsert = (): { data: unknown; error: unknown } => {
        const row = insertRow ?? {};
        const roomOf = String(row.room_id ?? '');
        // one-live-per-room: reject a second draft/active insert (23505).
        if (
          (row.status === 'active' || row.status === 'draft') &&
          liveFor(roomOf)
        ) {
          return { data: null, error: { code: '23505' } };
        }
        const ev: Ev = {
          id: `evt-${++db.seq}`,
          room_id: roomOf,
          name: String(row.name ?? 'x'),
          public_code: String(row.public_code ?? `c${db.seq}`),
          guest_slug: String(row.guest_slug ?? `g${db.seq}`),
          status: String(row.status ?? 'active'),
          starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
          ended_at: null,
          created_by: typeof row.created_by === 'string' ? row.created_by : null,
          created_at: '2026-07-15T00:00:00Z',
          updated_at: '2026-07-15T00:00:00Z',
        };
        db.events.push(ev);
        return { data: ev, error: null };
      };

      const applyUpdate = (): Record<string, unknown>[] => {
        const rows = matched();
        for (const r of rows) Object.assign(r, updateRow);
        return rows;
      };

      const b = {
        select: () => b,
        insert: (row: Record<string, unknown>) => {
          insertRow = row;
          return b;
        },
        update: (row: Record<string, unknown>) => {
          updateRow = row;
          return b;
        },
        eq: (c: string, v: unknown) => {
          filters.push([c, v]);
          return b;
        },
        in: (c: string, vals: unknown[]) => {
          inFilter = { col: c, vals };
          return b;
        },
        order: (c: string, opts?: { ascending?: boolean }) => {
          orderCol = c;
          orderAsc = opts?.ascending !== false;
          return b;
        },
        limit: (n: number) => {
          lim = n;
          return b;
        },
        maybeSingle: async () => {
          if (insertRow) return applyInsert();
          if (updateRow) {
            const rows = applyUpdate();
            return { data: rows[0] ?? null, error: null };
          }
          const rows = matched();
          if (rows.length > 1) {
            return { data: null, error: { code: 'PGRST116', message: 'multiple (or no) rows' } };
          }
          return { data: rows[0] ?? null, error: null };
        },
        single: async () => {
          if (insertRow) return applyInsert();
          const rows = matched();
          return { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } };
        },
        // Awaited directly (no .single) — used by endEvent's request/session updates.
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          if (updateRow) {
            const rows = applyUpdate();
            return Promise.resolve(resolve({ data: rows, error: null }));
          }
          return Promise.resolve(resolve({ data: matched(), error: null }));
        },
      };
      return b;
    },
  }),
}));

// endEvent also ends the active session in-line (no sessions.server import); the
// fake above handles the karaoke_sessions update path.
import {
  startHostedRoomSession,
  endEvent,
  getCanonicalEvent,
  getLatestEndedEvent,
  eventStatsById,
} from './events.server';

/** Unwrap the gated session start; every case in this file is expected to succeed. */
async function startNewEvent(roomId: string, name: string) {
  const r = await startHostedRoomSession(roomId, name);
  if (!r.ok) throw new Error(`expected a started session, got ${r.code}`);
  return r.event;
}

function seedEvent(partial: Partial<Ev>): Ev {
  const ev: Ev = {
    id: `evt-${++db.seq}`,
    room_id: 'room-A',
    name: 'Night',
    public_code: `c${db.seq}`,
    guest_slug: `g${db.seq}`,
    status: 'active',
    starts_at: '2026-07-15T00:00:00Z',
    ended_at: null,
    created_by: 'admin-hub',
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
    ...partial,
  };
  db.events.push(ev);
  return ev;
}

beforeEach(() => {
  db.events = [];
  db.requests = [];
  db.sessions = [];
  db.seq = 0;
});

describe('a read NEVER creates an Event (Event Lifecycle V1 — bootstrap removed)', () => {
  it('a brand-new room resolves to null and stays at zero Events', async () => {
    expect(await getCanonicalEvent('room-A')).toBeNull();
    expect(db.events).toHaveLength(0);
  });

  it('a room whose only Event is ENDED is never re-opened by a read', async () => {
    seedEvent({ status: 'ended', ended_at: '2026-07-15T01:00:00Z' });
    expect(await getCanonicalEvent('room-A')).toBeNull();
    expect(db.events.filter((e) => e.status !== 'ended')).toHaveLength(0);
  });
});

describe('startHostedRoomSession — explicit rotation, fresh identity, double-tap safe (V7 PART D)', () => {
  it('mints a fresh live Event with a NEW guest_slug after the previous ended', async () => {
    const old = seedEvent({ status: 'ended', guest_slug: 'old-slug', ended_at: 'x' });
    const fresh = await startNewEvent('room-A', 'BTY Home');
    expect(fresh.status).toBe('active');
    expect(fresh.id).not.toBe(old.id);
    expect(fresh.guest_slug).not.toBe(old.guest_slug); // old Guest QR can't join this
    // history preserved: the ended Event still exists.
    expect(db.events.filter((e) => e.status === 'ended')).toHaveLength(1);
  });

  it('is double-tap safe — a second call returns the SAME live Event, never two live', async () => {
    const first = await startNewEvent('room-A', 'BTY Home');
    const second = await startNewEvent('room-A', 'BTY Home');
    expect(second.id).toBe(first.id);
    expect(db.events.filter((e) => e.status === 'active')).toHaveLength(1);
  });
});

describe('endEvent — closes the Event + clears the live queue (Event Lifecycle V1)', () => {
  it('flips status→ended, stamps ended_at, removes waiting, SKIPS playing (never completed), clears ready, returns summary', async () => {
    const ev = seedEvent({ status: 'active' });
    db.requests.push(
      { id: 'r1', room_id: 'room-A', event_id: ev.id, status: 'waiting', ready_at: '2026-07-15T00:30:00Z' },
      { id: 'r2', room_id: 'room-A', event_id: ev.id, status: 'playing', ready_at: null },
      { id: 'r3', room_id: 'room-A', event_id: ev.id, status: 'completed', ready_at: null }, // history, untouched
    );
    db.sessions.push({ id: 's1', room_id: 'room-A', status: 'active', ended_at: null });

    const ended = await endEvent(ev.id);
    expect(ended?.event.status).toBe('ended');
    expect(ended?.event.ended_at).toBeTruthy();

    const byId = (id: string) => db.requests.find((r) => r.id === id)!;
    expect(byId('r1').status).toBe('removed'); // waiting → removed (never played)
    expect(byId('r1').ready_at).toBeNull(); // ready cleared
    // Event Lifecycle V1 §7.3.7 — a song cut off by End is UNFINISHED, closed with a
    // terminal NON-completed status (skipped), NEVER marked completed.
    expect(byId('r2').status).toBe('skipped');
    expect(byId('r3').status).toBe('completed'); // pre-existing history untouched
    expect(db.sessions[0].status).toBe('ended'); // the night ended too

    // Honest summary: 1 genuinely completed (r3); 2 unfinished closed (r1 removed + r2 skipped).
    expect(ended?.summary.completedCount).toBe(1);
    expect(ended?.summary.unfinishedClosedCount).toBe(2);
  });

  it('is idempotent — ending an already-ended Event does not throw, closes nothing, reports completed count', async () => {
    const ev = seedEvent({ status: 'ended', ended_at: 'x' });
    db.requests.push(
      { id: 'c1', room_id: 'room-A', event_id: ev.id, status: 'completed', ready_at: null },
    );
    const again = await endEvent(ev.id);
    expect(again?.event.status).toBe('ended');
    expect(again?.summary.unfinishedClosedCount).toBe(0); // nothing re-closed
    expect(again?.summary.completedCount).toBe(1);
  });
});

describe('V7.1 — LIVE stats are scoped to ONE event id, never room history', () => {
  const req = (event_id: string | null, status: string, guest_name: string): Req => ({
    id: `r-${++db.seq}`,
    room_id: 'room-A',
    status,
    ready_at: null,
    event_id,
    guest_name,
  });

  it('counts only the current event — a past event and untagged legacy rows are excluded', async () => {
    db.requests.push(
      // Event 1 (past): should NOT count toward event 2.
      req('evt-1', 'completed', 'Ann'),
      req('evt-1', 'completed', 'Ben'),
      // Legacy pre-V7.1 rows (event_id null): belong to no event.
      req(null, 'completed', 'Ghost'),
      req(null, 'waiting', 'Ghost2'),
      // Event 2 (current): the only rows that should count for evt-2.
      req('evt-2', 'waiting', 'Cara'),
      req('evt-2', 'playing', 'Dan'),
      req('evt-2', 'completed', 'Cara'), // Cara again — distinct singers must dedupe
    );
    const stats = await eventStatsById('evt-2');
    expect(stats.totalRequests).toBe(3); // only evt-2 rows
    expect(stats.uniqueGuests).toBe(2); // Cara + Dan (deduped), NOT the 4 others
    expect(stats.completed).toBe(1); // only Cara's evt-2 completion
    expect(stats.waiting).toBe(1);
    expect(stats.playing).toBe(1);
  });

  it('a brand-new event with no tagged rows reads exactly zero', async () => {
    db.requests.push(req('evt-1', 'completed', 'Ann'), req('evt-1', 'waiting', 'Ben'));
    const stats = await eventStatsById('evt-2');
    expect(stats.totalRequests).toBe(0);
    expect(stats.uniqueGuests).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.waiting).toBe(0);
  });

  it('event 1 summary stays frozen after event 2 accrues its own requests', async () => {
    db.requests.push(
      req('evt-1', 'completed', 'Ann'),
      req('evt-1', 'completed', 'Ben'),
      req('evt-2', 'waiting', 'Cara'),
      req('evt-2', 'waiting', 'Dan'),
    );
    const e1 = await eventStatsById('evt-1');
    expect(e1.totalRequests).toBe(2);
    expect(e1.completed).toBe(2);
    expect(e1.waiting).toBe(0); // event 2's waiting rows never leak into event 1
  });
});

describe('ended + live coexist without an all-status throw (V7 PART K)', () => {
  it('after rotation, getCanonicalEvent returns the LIVE one, getLatestEndedEvent the ended', async () => {
    seedEvent({ status: 'ended', ended_at: '2026-07-15T01:00:00Z', name: 'Round 1' });
    const live = await startNewEvent('room-A', 'Round 2');
    // Two events for the room — a naive all-status maybeSingle would throw here.
    const canonical = await getCanonicalEvent('room-A');
    const ended = await getLatestEndedEvent('room-A');
    expect(canonical?.id).toBe(live.id);
    expect(canonical?.status).toBe('active');
    expect(ended?.name).toBe('Round 1');
    expect(ended?.status).toBe('ended');
  });

  it('getLatestEndedEvent returns the MOST RECENT ended round', async () => {
    seedEvent({ status: 'ended', ended_at: '2026-07-15T01:00:00Z', name: 'Round 1' });
    seedEvent({ status: 'ended', ended_at: '2026-07-15T03:00:00Z', name: 'Round 2' });
    const ended = await getLatestEndedEvent('room-A');
    expect(ended?.name).toBe('Round 2');
  });
});
