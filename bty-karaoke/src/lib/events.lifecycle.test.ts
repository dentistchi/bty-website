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

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
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
  bootstrapInitialEvent,
  startNewEvent,
  endEvent,
  getCanonicalEvent,
  getLatestEndedEvent,
  roomHasAnyEvent,
} from './events.server';

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

describe('bootstrapInitialEvent — first open only, NEVER re-create after End (V7 PART A)', () => {
  it('creates the first Event for a brand-new room', async () => {
    const ev = await bootstrapInitialEvent('room-A', 'BTY Home');
    expect(ev?.status).toBe('active');
    expect(db.events).toHaveLength(1);
  });

  it('returns the live Event unchanged when one already exists (idempotent)', async () => {
    const first = seedEvent({ status: 'active' });
    const ev = await bootstrapInitialEvent('room-A', 'BTY Home');
    expect(ev?.id).toBe(first.id);
    expect(db.events).toHaveLength(1);
  });

  it('returns NULL (does NOT auto-create) when the room only has an ended Event', async () => {
    seedEvent({ status: 'ended', ended_at: '2026-07-15T01:00:00Z' });
    const ev = await bootstrapInitialEvent('room-A', 'BTY Home');
    expect(ev).toBeNull();
    // No new live event was spawned — the Admin must Start a New Event explicitly.
    expect(db.events.filter((e) => e.status !== 'ended')).toHaveLength(0);
  });
});

describe('roomHasAnyEvent', () => {
  it('is false for a room with no events, true once any (even ended) exists', async () => {
    expect(await roomHasAnyEvent('room-A')).toBe(false);
    seedEvent({ status: 'ended' });
    expect(await roomHasAnyEvent('room-A')).toBe(true);
  });
});

describe('startNewEvent — explicit rotation, fresh identity, double-tap safe (V7 PART D)', () => {
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

describe('endEvent — closes the Event + clears the live queue (V7 PART B)', () => {
  it('flips status→ended, stamps ended_at, removes waiting, completes playing, clears ready', async () => {
    const ev = seedEvent({ status: 'active' });
    db.requests.push(
      { id: 'r1', room_id: 'room-A', status: 'waiting', ready_at: '2026-07-15T00:30:00Z' },
      { id: 'r2', room_id: 'room-A', status: 'playing', ready_at: null },
      { id: 'r3', room_id: 'room-A', status: 'completed', ready_at: null }, // history, untouched
    );
    db.sessions.push({ id: 's1', room_id: 'room-A', status: 'active', ended_at: null });

    const ended = await endEvent(ev.id);
    expect(ended?.status).toBe('ended');
    expect(ended?.ended_at).toBeTruthy();

    const byId = (id: string) => db.requests.find((r) => r.id === id)!;
    expect(byId('r1').status).toBe('removed'); // waiting → removed
    expect(byId('r1').ready_at).toBeNull(); // ready cleared
    expect(byId('r2').status).toBe('completed'); // playing → completed
    expect(byId('r3').status).toBe('completed'); // pre-existing history untouched
    expect(db.sessions[0].status).toBe('ended'); // the night ended too
  });

  it('is idempotent — ending an already-ended Event does not throw or double-clear', async () => {
    const ev = seedEvent({ status: 'ended', ended_at: 'x' });
    const again = await endEvent(ev.id);
    expect(again?.status).toBe('ended');
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
