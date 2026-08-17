// BUILD 26T-R1B-R6-R1B-R17 — FREE FINAL-SONG-GRACE RETIREMENT (server contract).
//
// THE DEFECT THESE PIN. E1 retired FREE metering: `karaoke_begin_song_v2` mints no grace, consumes
// no FREE window, and hardcodes `finalSongGraceApplied: false`. But E1 changed only the MINTER.
// A separate reader — `graceForRequest` — sat on the `already_active` branch, which never calls the
// begin RPC, and returned `finalSongGraceApplied: true` for ANY surviving row in
// `karaoke_free_final_song_grace`. One pre-E1 row plus a stale open usage segment was enough for
// the server to announce a FREE daily quota that V1.0 does not have, which native Release 109
// renders as "오늘 남은 무료 시간은 모두 사용돼요".
//
// The ledger itself is NOT the defect and is deliberately preserved (it is exempt from account
// deletion). The repair is that the playback admission path no longer consults it. These tests
// therefore drive the REAL `ensurePlaying` with a grace row present and prove the path stays
// silent — asserting behaviour, not source text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const beginSong = vi.fn();
const endSong = vi.fn();
vi.mock('@/lib/metering.server', () => ({
  beginSong: (...a: unknown[]) => beginSong(...a),
  endSong: (...a: unknown[]) => endSong(...a),
}));

type Row = { id: string; status: string; position: number; created_at: string; ready_at: string | null };

let activeRows: Row[] = [];
/** An OPEN usage segment for the playing request — the precondition `activeLeaseForRequest` needs. */
let segmentRow: Record<string, unknown> | null = null;
/** A surviving PRE-E1 grace row. Present in most tests here; that is the whole point. */
let graceRow: Record<string, unknown> | null = null;
/** Every table this call actually touched, so "never consulted" is measured, not assumed. */
let tablesTouched: string[] = [];

function chain(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'is', 'update', 'not']) b[m] = () => b;
  b.maybeSingle = async () => {
    if (table === 'karaoke_event_usage_segments') return { data: segmentRow, error: null };
    if (table === 'karaoke_free_final_song_grace') return { data: graceRow, error: null };
    return { data: null, error: null };
  };
  b.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve(resolve({ data: table === 'karaoke_requests' ? activeRows : [], error: null }));
  return b;
}
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    from: (table: string) => {
      tablesTouched.push(table);
      return chain(table);
    },
  }),
}));

import { ensurePlaying } from './rooms.server';

const ROOM = 'room-1';
const REQ = 'req-1';
const LEASE = '2026-08-01T00:10:00.000Z';

const row = (id: string, position: number, over: Partial<Row> = {}): Row => ({
  id,
  status: 'waiting',
  position,
  created_at: `2026-08-01T00:0${position}:00.000Z`,
  ready_at: null,
  ...over,
});

/** The exact shape a surviving BUILD 20M-R4 ledger row has. */
const HISTORICAL_GRACE = {
  grace_seconds: 39,
  charged_seconds: 30,
  remaining_before_seconds: 30,
};

const GRACE_KEYS = [
  'finalSongGraceApplied',
  'finalSongGraceSeconds',
  'finalSongChargedSeconds',
  'remainingBeforeSeconds',
] as const;

function expectNoGrace(result: Record<string, unknown>) {
  for (const k of GRACE_KEYS) {
    expect(result[k]).toBeUndefined();
  }
  expect(result.finalSongGraceApplied).not.toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  activeRows = [];
  segmentRow = null;
  graceRow = null;
  tablesTouched = [];
});

describe('R17 §1 — already_active never reports grace, even with a historical ledger row', () => {
  beforeEach(() => {
    // The stale pre-E1 shape, reproduced exactly: the request is still `playing`, its usage
    // segment was never closed, and its grace row survives.
    activeRows = [row(REQ, 1, { status: 'playing', ready_at: '2026-08-01T00:05:00.000Z' })];
    segmentRow = { lease_ends_at: LEASE, duration_seconds: 69 };
    graceRow = { ...HISTORICAL_GRACE };
  });

  it('returns already_active WITHOUT any grace field', async () => {
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('already_active');
    expectNoGrace(r);
  });

  it('never queries karaoke_free_final_song_grace at all', async () => {
    await ensurePlaying(ROOM, REQ);
    expect(tablesTouched).not.toContain('karaoke_free_final_song_grace');
  });

  it('still recovers the lease detail — the repair removed grace, not lease visibility', async () => {
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.leaseEndsAt).toBe(LEASE);
    expect(r.durationSeconds).toBe(69);
  });

  it('is byte-identical whether or not the historical row exists', async () => {
    const withRow = await ensurePlaying(ROOM, REQ);
    graceRow = null;
    tablesTouched = [];
    const withoutRow = await ensurePlaying(ROOM, REQ);
    expect(withRow).toEqual(withoutRow);
  });

  it('a MUTANT that reinstates the ledger read would be caught', async () => {
    // Guards the guard: if `graceRow` were ever spread back into the result, `expectNoGrace`
    // above must fail. Proven here by asserting the fixture itself is non-empty and would be
    // visible — a silently empty fixture would make every assertion above vacuous.
    expect(graceRow).not.toBeNull();
    expect(graceRow).toMatchObject({ grace_seconds: 39 });
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(Object.keys(r)).not.toContain('finalSongGraceApplied');
  });
});

describe('R17 §2 — a new start never reports grace', () => {
  beforeEach(() => {
    activeRows = [row(REQ, 1, { ready_at: '2026-08-01T00:05:00.000Z' })];
    graceRow = { ...HISTORICAL_GRACE };
  });

  it('an E1 unmetered start carries no grace', async () => {
    // Exactly what E1 returns: metered false, no lease, grace explicitly false.
    beginSong.mockResolvedValue({
      outcome: 'ok',
      leaseEndsAt: null,
      durationSeconds: 200,
      finalSongGraceApplied: false,
      finalSongGraceSeconds: null,
      finalSongChargedSeconds: null,
      remainingBeforeSeconds: null,
      metered: false,
      entitlement: {},
    });
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('started');
    expect(r.finalSongGraceApplied).not.toBe(true);
  });

  it('the begin path does not consult the grace ledger either', async () => {
    beginSong.mockResolvedValue({ outcome: 'ok', durationSeconds: 200, metered: false, entitlement: {} });
    await ensurePlaying(ROOM, REQ);
    expect(tablesTouched).not.toContain('karaoke_free_final_song_grace');
  });
});

describe('R17 §3 — the historical ledger does not alter the admission RESULT', () => {
  it('the outcome is the same with and without a grace row', async () => {
    const start = async () => {
      activeRows = [row(REQ, 1, { ready_at: '2026-08-01T00:05:00.000Z' })];
      beginSong.mockResolvedValue({ outcome: 'ok', durationSeconds: 200, metered: false, entitlement: {} });
      return await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    };
    graceRow = { ...HISTORICAL_GRACE };
    const a = await start();
    graceRow = null;
    const b = await start();
    expect(a.outcome).toBe(b.outcome);
    expect(a.outcome).toBe('started');
  });
});

describe('R17 §4 — unrelated already_active / structural behaviour is intact', () => {
  it('a DIFFERENT song playing still yields conflict, not already_active', async () => {
    activeRows = [
      row('other', 1, { status: 'playing' }),
      row(REQ, 2, { ready_at: '2026-08-01T00:05:00.000Z' }),
    ];
    graceRow = { ...HISTORICAL_GRACE };
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('conflict');
    expectNoGrace(r);
  });

  it('an unknown request is still not_found', async () => {
    activeRows = [];
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('not_found');
  });

  it('a waiting song that never pressed Ready is still not_ready', async () => {
    activeRows = [row(REQ, 1, { ready_at: null })];
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('not_ready');
    expect(beginSong).not.toHaveBeenCalled();
  });

  it('already_active with NO open segment still returns no lease and no grace', async () => {
    activeRows = [row(REQ, 1, { status: 'playing' })];
    segmentRow = null;
    graceRow = { ...HISTORICAL_GRACE };
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('already_active');
    expect(r.leaseEndsAt).toBeUndefined();
    expectNoGrace(r);
  });
});

describe('R17 §5 — no FREE quota / duration / pass gating is reintroduced', () => {
  it('an unmetered E1 start is NOT converted into a quota refusal', async () => {
    activeRows = [row(REQ, 1, { ready_at: '2026-08-01T00:05:00.000Z' })];
    beginSong.mockResolvedValue({ outcome: 'ok', durationSeconds: 900, metered: false, entitlement: {} });
    const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
    expect(r.outcome).toBe('started');
    expect(r.outcome).not.toBe('upgrade_required');
  });

  it('the pre-existing fail-closed refusals still pass through unchanged', async () => {
    for (const outcome of ['duration_unavailable', 'pass_insufficient', 'upgrade_required'] as const) {
      activeRows = [row(REQ, 1, { ready_at: '2026-08-01T00:05:00.000Z' })];
      beginSong.mockResolvedValue({ outcome, entitlement: {}, durationSeconds: 291 });
      const r = await ensurePlaying(ROOM, REQ) as unknown as Record<string, unknown>;
      expect(r.outcome).toBe(outcome);
      expectNoGrace(r);
    }
  });
});
