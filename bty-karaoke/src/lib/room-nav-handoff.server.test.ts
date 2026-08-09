// BUILD 26H — room-only navigation resolution: it navigates, and it writes NOTHING.
//
// The whole product promise is that opening the app is not admission. A test that only
// checked the returned envelope would miss the thing that matters, so every DB call the
// resolver makes is recorded and asserted to be a read.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env.server', () => ({
  optionalEnv: () => 'test-secret',
  karaokeEnv: () => ({ url: 'https://example.invalid', key: 'test-service-role-key' }),
}));

/** Every DB operation the resolver performs, in order. Reads and writes alike. */
let dbOps: { table: string; op: string }[] = [];
let room: Record<string, unknown> | null = null;
let liveEvent: Record<string, unknown> | null = null;

function makeDb() {
  const table = (name: string) => {
    const b: Record<string, unknown> = {};
    const read = (op: string) => {
      dbOps.push({ table: name, op });
      return b;
    };
    b.select = () => read('select');
    b.eq = () => b;
    b.in = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = async () => ({ data: name === 'karaoke_events' ? liveEvent : null, error: null });
    b.single = async () => ({ data: null, error: null });
    // Any of these appearing in `dbOps` is a WRITE and fails the zero-write contract.
    b.insert = async () => {
      dbOps.push({ table: name, op: 'insert' });
      return { data: null, error: null };
    };
    b.update = () => {
      dbOps.push({ table: name, op: 'update' });
      return b;
    };
    b.upsert = async () => {
      dbOps.push({ table: name, op: 'upsert' });
      return { data: null, error: null };
    };
    b.delete = () => {
      dbOps.push({ table: name, op: 'delete' });
      return b;
    };
    return b;
  };
  return { from: (name: string) => table(name) };
}

vi.mock('@/lib/supabase.server', () => ({ karaokeDb: () => makeDb() }));
vi.mock('@/lib/rooms.server', async (orig) => {
  const real = await orig<typeof import('@/lib/rooms.server')>();
  return { ...real, getPublicRoomBySlug: async () => room };
});

import { resolveRoomNavigation } from './guest-handoff.server';
import { roomNavIdentifier, roomNavHandoffMarker } from '@/domain/guest-handoff';

const WRITE_OPS = new Set(['insert', 'update', 'upsert', 'delete']);
const writes = () => dbOps.filter((o) => WRITE_OPS.has(o.op));

beforeEach(() => {
  dbOps = [];
  room = { id: 'room-1', slug: 'bty-home', display_name: 'btyNorebang', status: 'open' };
  liveEvent = { id: 'evt-1', room_id: 'room-1', status: 'active', name: 'btyNorebang' };
});

describe('H1/H5 — a valid room with a current live event resolves for navigation', () => {
  it('returns the Native-compatible active envelope', async () => {
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(r.resolution).toBe('active');
    if (r.resolution !== 'active') return;
    expect(r.nav.roomSlug).toBe('bty-home');
    expect(r.nav.roomDisplayName).toBe('btyNorebang');
    expect(r.nav.eventId).toBe('evt-1');
    expect(r.nav.eventStatus).toBe('active');
    expect(r.nav.expiresAt).toBeTruthy();
  });

  it('H2/H3/H4 — needs NO guest name, song, request, or requestId', async () => {
    // The function takes ONE argument: the identifier. There is no parameter through which a
    // name/song/request could be demanded, which is why this cannot silently regress.
    expect(resolveRoomNavigation.length).toBe(1);
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(r.resolution).toBe('active');
  });

  it('H25 — reports a non-UUID navigation marker, not a fabricated handoff id', async () => {
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    if (r.resolution !== 'active') throw new Error('expected active');
    expect(r.nav.handoffId).toBe(roomNavHandoffMarker('bty-home'));
    expect(r.nav.handoffId).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

describe('H10–H14 — room-only navigation writes NOTHING', () => {
  it('performs zero writes of any kind', async () => {
    await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(writes(), `unexpected writes: ${JSON.stringify(writes())}`).toEqual([]);
  });

  it('H13 — never touches the handoff table', async () => {
    await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(dbOps.filter((o) => o.table === 'karaoke_guest_app_handoffs')).toEqual([]);
  });

  it('H14 — never writes handoff audit / open telemetry', async () => {
    await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(dbOps.filter((o) => o.table === 'karaoke_guest_app_handoff_audit')).toEqual([]);
    // open_count / first_opened_at / last_opened_at belong to a real request-backed handoff.
    // Simulating them here would corrupt that funnel with navigation that never happened.
    expect(dbOps.filter((o) => o.op === 'update')).toEqual([]);
  });

  it('H10/H11/H12 — never touches requests, queue, or sessions', async () => {
    await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    for (const t of ['karaoke_requests', 'karaoke_sessions', 'karaoke_guest_funnel_events']) {
      expect(dbOps.filter((o) => o.table === t), t).toEqual([]);
    }
  });

  it('H17/H29 — repeated opens stay write-free and identical', async () => {
    const first = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    const opsAfterFirst = dbOps.length;
    const second = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    const third = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(writes()).toEqual([]);
    // Idempotent by construction: nothing is stored, so there is no counter to advance and
    // the NAVIGATION is identical every time. `expiresAt` is an advisory timestamp Native
    // decodes and never acts on, so it is excluded rather than frozen — pinning wall-clock
    // would assert something the product does not promise.
    const navOf = (r: typeof first) =>
      r.resolution === 'active' ? { ...r.nav, expiresAt: undefined } : r;
    expect(navOf(second)).toEqual(navOf(first));
    expect(navOf(third)).toEqual(navOf(first));
    expect(dbOps.length).toBe(opsAfterFirst * 3);
  });
});

describe('H8/H9 — the CURRENT live event is revalidated at resolve time', () => {
  it('refuses when the event ended between CTA render and app open', async () => {
    // The exact product scenario: the CTA was rendered while live, the Guest waited, the Host
    // ended the event, and only then did the Guest open the app.
    liveEvent = null;
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(r.resolution).toBe('invalid');
    expect(writes()).toEqual([]);
  });

  it('refuses a non-active event — never a stale or previous one', async () => {
    liveEvent = { id: 'evt-OLD', room_id: 'room-1', status: 'ended', name: 'yesterday' };
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(r.resolution).toBe('invalid');
  });

  it('reads the event on EVERY resolve — never caches a previous answer', async () => {
    await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    const firstReads = dbOps.filter((o) => o.table === 'karaoke_events').length;
    expect(firstReads).toBeGreaterThan(0);
    liveEvent = null;
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    expect(r.resolution).toBe('invalid'); // the second call saw the NEW truth
  });
});

describe('H6/H7/H26 — unknown, invalid, and malformed refuse safely', () => {
  it('H6 — an unknown room refuses', async () => {
    room = null;
    const r = await resolveRoomNavigation(roomNavIdentifier('no-such-room')!);
    expect(r.resolution).toBe('invalid');
    expect(writes()).toEqual([]);
  });

  it('H7/H26 — a malformed identifier refuses without touching the database at all', async () => {
    for (const bad of ['', 'rnav1-', 'garbage', 'rnav1-BAD', 'rnav2-bty-home']) {
      dbOps = [];
      const r = await resolveRoomNavigation(bad);
      expect(r.resolution, bad).toBe('invalid');
      expect(dbOps, `${bad} should not reach the DB`).toEqual([]);
    }
  });

  it('refusal is the SAME generic outcome in every case (no existence oracle)', async () => {
    room = null;
    const unknownRoom = await resolveRoomNavigation(roomNavIdentifier('nope')!);
    room = { id: 'room-1', slug: 'bty-home', display_name: 'x', status: 'open' };
    liveEvent = null;
    const noEvent = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    const malformed = await resolveRoomNavigation('garbage');
    expect(unknownRoom).toEqual(noEvent);
    expect(noEvent).toEqual(malformed);
  });
});

describe('H22/H23 — no locale of any kind participates', () => {
  it('takes no locale parameter and returns no locale field', async () => {
    const r = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    if (r.resolution !== 'active') throw new Error('expected active');
    const keys = Object.keys(r.nav).sort();
    expect(keys).toEqual(
      ['eventId', 'eventStatus', 'expiresAt', 'handoffId', 'roomDisplayName', 'roomSlug'].sort(),
    );
    // Nothing named locale/lang/language can ride along, in either direction.
    expect(keys.some((k) => /locale|lang/i.test(k))).toBe(false);
  });

  it('the same room resolves identically regardless of anything the Web Guest chose', async () => {
    const a = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    const b = await resolveRoomNavigation(roomNavIdentifier('bty-home')!);
    if (a.resolution !== 'active' || b.resolution !== 'active') throw new Error('expected active');
    expect({ ...a.nav, expiresAt: undefined }).toEqual({ ...b.nav, expiresAt: undefined });
  });
});
