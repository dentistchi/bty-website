// Event Lifecycle V1 — ZERO IMPLICIT AUTO-CREATE PROOF.
//
// The contract: a Room with zero Events STAYS at zero until an authenticated Host
// explicitly POSTs Start. No GET, manager login, device-token restoration, polling,
// QR lookup, or "first open" bootstrap may create an Event.
//
// This is proved BEHAVIOURALLY against a fake Supabase that counts every INSERT into
// karaoke_events — not by grepping source text. Any accidental re-introduction of a
// get-or-create/bootstrap helper on a read path fails these tests.

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

const db = { events: [] as Ev[], requests: [] as unknown[], sessions: [] as unknown[], seq: 0, inserts: 0 };

function liveFor(roomId: string): Ev | undefined {
  return db.events.find((e) => e.room_id === roomId && (e.status === 'draft' || e.status === 'active'));
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    // BUILD 26U-R1 — creation moved into karaoke_start_premium_room_session. This emulation
    // keeps `db.inserts` as the file's central instrument: it counts EVERY Event row this fake
    // creates, by whatever path, so "(1)-(5) a read never writes" still means exactly what it
    // meant before, and the double-tap fast path is still observable as "no new insert".
    rpc(name: string, params: Record<string, unknown>) {
      if (name !== 'karaoke_start_premium_room_session') {
        return Promise.resolve({ data: null, error: { message: 'no rpc in this fake' } });
      }
      const roomId = String(params.p_room_id);
      const live = liveFor(roomId);
      if (live) {
        return Promise.resolve({
          data: { outcome: 'already_live', eventId: live.id, activated: false },
          error: null,
        });
      }
      db.inserts += 1;
      const ev: Ev = {
        id: `evt-${++db.seq}`,
        room_id: roomId,
        name: String(params.p_name),
        public_code: String(params.p_public_code),
        guest_slug: String(params.p_guest_slug),
        status: 'active',
        starts_at: '2026-07-15T00:00:00Z',
        ended_at: null,
        created_by: String(params.p_created_by ?? 'admin-hub'),
        created_at: '2026-07-15T00:00:00Z',
        updated_at: '2026-07-15T00:00:00Z',
      };
      db.events.push(ev);
      return Promise.resolve({
        data: { outcome: 'ok', eventId: ev.id, activated: true, source: 'ACTIVATED_PASS', expiresAt: null },
        error: null,
      });
    },
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let inFilter: { col: string; vals: unknown[] } | null = null;
      let orderAsc = true;
      let orderCol: string | null = null;
      let lim: number | null = null;
      let insertRow: Record<string, unknown> | null = null;

      const arrFor = (): Record<string, unknown>[] =>
        table === 'karaoke_events'
          ? (db.events as unknown as Record<string, unknown>[])
          : table === 'karaoke_requests'
            ? (db.requests as Record<string, unknown>[])
            : (db.sessions as Record<string, unknown>[]);

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
        if (table === 'karaoke_events') db.inserts += 1; // ← the tripwire
        const roomOf = String(row.room_id ?? '');
        if ((row.status === 'active' || row.status === 'draft') && liveFor(roomOf)) {
          return { data: null, error: { code: '23505' } }; // one-live-per-room
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
          created_at: '2026-07-19T00:00:00Z',
          updated_at: '2026-07-19T00:00:00Z',
        };
        db.events.push(ev);
        return { data: ev, error: null };
      };

      const b = {
        select: () => b,
        insert: (row: Record<string, unknown>) => {
          insertRow = row;
          return b;
        },
        update: () => b,
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
          const rows = matched();
          if (rows.length > 1) return { data: null, error: { code: 'PGRST116' } };
          return { data: rows[0] ?? null, error: null };
        },
        single: async () => {
          if (insertRow) return applyInsert();
          const rows = matched();
          return { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } };
        },
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve(resolve({ data: matched(), error: null })),
      };
      return b;
    },
  }),
}));

import * as events from './events.server';
const { getCanonicalEvent, getLatestEndedEvent, resolveEventAccess } = events;

/** Unwrap the gated session start; every case in this file is expected to succeed. */
async function startNewEvent(roomId: string, name: string) {
  const r = await events.startHostedRoomSession(roomId, name);
  if (!r.ok) throw new Error(`expected a started session, got ${r.code}`);
  return r.event;
}

beforeEach(() => {
  db.events = [];
  db.requests = [];
  db.sessions = [];
  db.seq = 0;
  db.inserts = 0;
});

const ROOM = { id: 'room-A' };

describe('ZERO implicit auto-create — a read never writes an Event', () => {
  it('(1) the FIRST read of a room with zero Events creates nothing', async () => {
    const ev = await getCanonicalEvent(ROOM.id);
    expect(ev).toBeNull();
    expect(db.inserts).toBe(0);
    expect(db.events).toHaveLength(0);
  });

  it('(2) REPEATED reads (polling) still create nothing', async () => {
    for (let i = 0; i < 10; i++) await getCanonicalEvent(ROOM.id);
    expect(db.inserts).toBe(0);
    expect(db.events).toHaveLength(0);
  });

  it('(3/4/5) every resolver a login / device-restore / poll path uses is read-only', async () => {
    // These are exactly the helpers behind: Admin Hub GET (/admin/session),
    // manager login → events list, device-token restore (/admin/device/context),
    // guest + display + dj polling, and QR lookup.
    await getCanonicalEvent(ROOM.id);
    await getLatestEndedEvent(ROOM.id);
    await resolveEventAccess(ROOM);
    expect(db.inserts).toBe(0);
    expect(db.events).toHaveLength(0);
  });

  it('the module exposes NO get-or-create/bootstrap helper at all', () => {
    // Structural guard: these were the historical auto-create paths. Their absence
    // is what makes "zero" hold for any future caller, not just today's callers.
    expect((events as Record<string, unknown>).bootstrapInitialEvent).toBeUndefined();
    expect((events as Record<string, unknown>).ensureCanonicalLiveEvent).toBeUndefined();
  });

  it('a room whose only Event is ENDED is never re-opened by a read', async () => {
    db.events.push({
      id: 'evt-old', room_id: ROOM.id, name: 'Round 1', public_code: 'c', guest_slug: 'g',
      status: 'ended', starts_at: null, ended_at: '2026-07-19T01:00:00Z', created_by: null,
      created_at: 'c', updated_at: 'u',
    });
    expect(await getCanonicalEvent(ROOM.id)).toBeNull();
    const access = await resolveEventAccess(ROOM);
    expect(access.ok).toBe(false);
    expect(db.inserts).toBe(0);
    expect(db.events.filter((e) => e.status !== 'ended')).toHaveLength(0);
  });

  it('a room with NO event refuses operations honestly (409 NO_ACTIVE_EVENT), never opens', async () => {
    const access = await resolveEventAccess(ROOM);
    expect(access).toMatchObject({ ok: false, status: 409, code: 'NO_ACTIVE_EVENT' });
    expect(db.inserts).toBe(0);
  });
});

describe('EXPLICIT start is the only creation path', () => {
  it('(6) an explicit start creates exactly ONE active Event', async () => {
    const ev = await startNewEvent(ROOM.id, 'BTY Home');
    expect(ev.status).toBe('active');
    expect(db.inserts).toBe(1);
    expect(db.events.filter((e) => e.status === 'active')).toHaveLength(1);
  });

  it('(7) CONCURRENT starts leave exactly ONE active Event (both resolve to it)', async () => {
    const [a, b, c] = await Promise.all([
      startNewEvent(ROOM.id, 'BTY Home'),
      startNewEvent(ROOM.id, 'BTY Home'),
      startNewEvent(ROOM.id, 'BTY Home'),
    ]);
    expect(db.events.filter((e) => e.status === 'active')).toHaveLength(1);
    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
  });

  it('a repeated (sequential double-tap) start returns the SAME Event, no second insert', async () => {
    const first = await startNewEvent(ROOM.id, 'BTY Home');
    const insertsAfterFirst = db.inserts;
    const second = await startNewEvent(ROOM.id, 'BTY Home');
    expect(second.id).toBe(first.id);
    expect(db.inserts).toBe(insertsAfterFirst); // fast path: no insert attempted at all
    expect(db.events.filter((e) => e.status === 'active')).toHaveLength(1);
  });
});
