// startHostedRoomSession behavior against a fake Supabase that enforces the
// one-live-Event-per-room invariant on insert (mirroring the partial unique
// index). Proves: idempotency, no new room, ended events coexist (not
// reactivated), and the concurrency race resolves to a single live event.

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

const db = {
  store: [] as Ev[],
  seq: 0,
  raceOnNextInsert: false,
  roomsTouched: new Set<string>(), // any karaoke_rooms insert would land here (must stay empty)
};

function liveFor(roomId: string): Ev | undefined {
  return db.store.find((e) => e.room_id === roomId && (e.status === 'draft' || e.status === 'active'));
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    // BUILD 26U-R1 — the create path moved INSIDE karaoke_start_premium_room_session, so the
    // fake emulates that RPC's contract rather than a bare insert. The emulation keeps exactly
    // the properties this file exists to prove: the one-live-per-room invariant is enforced on
    // insert, an incumbent live Event is returned instead of a second one, and no karaoke_rooms
    // row is ever touched. Entitlement is granted here on purpose — this file is about Event
    // lifecycle, and the entitlement gate has its own dedicated tests.
    rpc(name: string, params: Record<string, unknown>) {
      if (name !== 'karaoke_start_premium_room_session') {
        return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
      }
      const roomId = String(params.p_room_id);
      const live = liveFor(roomId);
      if (live) {
        return Promise.resolve({
          data: { outcome: 'already_live', eventId: live.id, activated: false },
          error: null,
        });
      }
      if (db.raceOnNextInsert) {
        db.raceOnNextInsert = false;
        const winner = mkEvent({ room_id: roomId, name: params.p_name }, 'active');
        db.store.push(winner);
        return Promise.resolve({
          data: { outcome: 'already_live', eventId: winner.id, activated: false },
          error: null,
        });
      }
      const ev = mkEvent(
        {
          room_id: roomId,
          name: params.p_name,
          public_code: params.p_public_code,
          guest_slug: params.p_guest_slug,
          created_by: params.p_created_by,
        },
        'active',
      );
      db.store.push(ev);
      return Promise.resolve({
        data: { outcome: 'ok', eventId: ev.id, activated: true, source: 'ACTIVATED_PASS', expiresAt: null },
        error: null,
      });
    },
    from(table: string) {
      const b: Record<string, unknown> = {};
      let roomId: string | null = null;
      let byId: string | null = null;
      let insertRow: Record<string, unknown> | null = null;
      Object.assign(b, {
        select: () => b,
        insert: (row: Record<string, unknown>) => {
          if (table === 'karaoke_rooms') db.roomsTouched.add(String(row.slug ?? 'x'));
          insertRow = row;
          return b;
        },
        eq: (c: string, v: string) => {
          // getEventById reads by id; getCanonicalEvent reads by room_id. One capture each so
          // the RPC's returned eventId can be resolved back to a row.
          if (c === 'id') byId = v;
          else roomId = v;
          return b;
        },
        in: () => b,
        maybeSingle: async () => ({
          data: byId
            ? (db.store.find((e) => e.id === byId) ?? null)
            : (liveFor(roomId ?? String(insertRow?.room_id ?? '')) ?? null),
          error: null,
        }),
        single: async () => {
          const row = insertRow ?? {};
          const roomOf = String(row.room_id ?? '');
          // Simulate a concurrent winner landing between our read and insert.
          if (db.raceOnNextInsert) {
            db.raceOnNextInsert = false;
            db.store.push(mkEvent(row, 'active'));
            return { data: null, error: { code: '23505' } };
          }
          if (liveFor(roomOf)) return { data: null, error: { code: '23505' } };
          const ev = mkEvent(row, String(row.status ?? 'active'));
          db.store.push(ev);
          return { data: ev, error: null };
        },
      });
      return b;
    },
  }),
}));

function mkEvent(row: Record<string, unknown>, status: string): Ev {
  const id = `evt-${++db.seq}`;
  const s = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
  return {
    id,
    room_id: s(row.room_id, ''),
    name: s(row.name, 'x'),
    public_code: s(row.public_code, `c${db.seq}`),
    guest_slug: s(row.guest_slug, `g${db.seq}`),
    status,
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
    ended_at: null,
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  };
}

import { startHostedRoomSession, getCanonicalEvent } from './events.server';

/** Unwrap the gated result; every case in this file is expected to succeed. */
async function start(roomId: string, name: string) {
  const r = await startHostedRoomSession(roomId, name);
  if (!r.ok) throw new Error(`expected a started session, got ${r.code}`);
  return r.event;
}

beforeEach(() => {
  db.store = [];
  db.seq = 0;
  db.raceOnNextInsert = false;
  db.roomsTouched = new Set();
});

describe('startHostedRoomSession — the ONLY create path (explicit Host Start)', () => {
  it('creates exactly one live event for an existing room — and NO new room', async () => {
    const ev = await start('room-A', 'BTY Home');
    expect(ev.room_id).toBe('room-A');
    expect(ev.status).toBe('active');
    expect(db.store).toHaveLength(1);
    expect(db.roomsTouched.size).toBe(0); // never inserts a karaoke_rooms row
  });

  it('is idempotent — a second explicit Start returns the SAME event, no new insert', async () => {
    const first = await start('room-A', 'BTY Home');
    const second = await start('room-A', 'BTY Home');
    expect(second.id).toBe(first.id);
    expect(db.store).toHaveLength(1);
  });

  it('does not reactivate an ended event — it creates a fresh live one alongside history', async () => {
    db.store.push(mkEvent({ room_id: 'room-A', name: 'Old Night' }, 'ended'));
    const ev = await start('room-A', 'BTY Home');
    expect(ev.status).toBe('active');
    expect(db.store.filter((e) => e.room_id === 'room-A' && e.status === 'ended')).toHaveLength(1);
    expect(db.store.filter((e) => e.room_id === 'room-A' && e.status === 'active')).toHaveLength(1);
  });

  it('concurrency: a 23505 from a racing winner resolves to that single live event', async () => {
    db.raceOnNextInsert = true; // our insert loses the one-live-per-room race
    const ev = await start('room-A', 'BTY Home');
    expect(ev.room_id).toBe('room-A');
    expect(ev.status).toBe('active');
    // Exactly one live event exists for the room (the winner), never two.
    expect(db.store.filter((e) => e.room_id === 'room-A' && e.status === 'active')).toHaveLength(1);
  });

  it('getCanonicalEvent returns the live event, or null when none', async () => {
    expect(await getCanonicalEvent('room-Z')).toBeNull();
    await start('room-Z', 'Z');
    expect((await getCanonicalEvent('room-Z'))?.room_id).toBe('room-Z');
  });
});
