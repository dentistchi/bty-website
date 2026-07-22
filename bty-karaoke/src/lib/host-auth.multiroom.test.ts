// Room-limit policy correction + creation idempotency (Part A), proved BEHAVIOURALLY
// against a fake Postgres whose create_karaoke_room (7-arg keyed) and
// create_additional_karaoke_room (6-arg keyed) model the real ones:
//   * NO Room-count limit,
//   * owned Rooms counted by the canonical active-membership → ownership path (NOT
//     claimed_by_account),
//   * request-level idempotency REQUIRED on (account_id, idempotency_key), for BOTH the
//     first Room and additional Rooms, with fail-closed blank key/fingerprint.
// The fake RPC bodies are synchronous (no awaits inside) so two concurrent same-key
// calls dedup exactly as the per-account advisory lock guarantees.

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row {
  [k: string]: unknown;
}

const db = {
  accounts: [] as Row[],
  plans: [] as Row[],
  workspaces: [] as Row[],
  members: [] as Row[],
  ownership: [] as Row[],
  rooms: [] as Row[],
  events: [] as Row[],
  idem: [] as Row[],
  seq: 0,
  eventInserts: 0,
};

const tableFor = (t: string): Row[] =>
  ({
    karaoke_accounts: db.accounts,
    karaoke_host_plan_assignments: db.plans,
    karaoke_workspaces: db.workspaces,
    karaoke_workspace_members: db.members,
    karaoke_room_ownership: db.ownership,
    karaoke_rooms: db.rooms,
    karaoke_events: db.events,
    karaoke_room_creation_idempotency: db.idem,
  })[t] ?? [];

// Canonical owned count: distinct Rooms owned via the account's ACTIVE-membership
// workspaces — independent of who the ownership row's claimed_by_account is.
function canonicalCount(accountId: string): number {
  const wsIds = db.members.filter((m) => m.account_id === accountId && m.status === 'active').map((m) => m.workspace_id);
  const roomIds = new Set(db.ownership.filter((o) => wsIds.includes(o.workspace_id)).map((o) => o.room_id));
  return roomIds.size;
}
function ownerWorkspace(accountId: string): string | undefined {
  return db.members.find((m) => m.account_id === accountId && m.status === 'active')?.workspace_id as string | undefined;
}
function idemLookup(accountId: string, key: string) {
  return db.idem.find((r) => r.account_id === accountId && r.idempotency_key === key);
}

/** Models create_karaoke_room (7-arg keyed): first Room + required idempotency. */
function fakeFirstRpc(p: Record<string, unknown>) {
  const accountId = String(p.p_account_id);
  const key = String(p.p_idempotency_key ?? '').trim() || null;
  const fp = String(p.p_request_fingerprint ?? '').trim() || null;
  if (!key) return { outcome: 'invalid_idempotency_key' };
  if (!fp) return { outcome: 'invalid_request_fingerprint' };
  if (!db.accounts.some((a) => a.id === accountId)) return { outcome: 'account_not_found' };
  const prior = idemLookup(accountId, key);
  if (prior) {
    if (prior.request_fingerprint !== fp) return { outcome: 'idempotency_conflict' };
    const r = db.rooms.find((x) => x.id === prior.room_id);
    if (!prior.room_id || !r) return { outcome: 'idempotency_target_missing' };
    return { outcome: 'created', slug: r.slug, roomId: r.id, replayed: true };
  }
  if (canonicalCount(accountId) > 0) {
    const wsIds = db.members.filter((m) => m.account_id === accountId && m.status === 'active').map((m) => m.workspace_id);
    const o = db.ownership.find((x) => wsIds.includes(x.workspace_id))!;
    const r = db.rooms.find((x) => x.id === o.room_id)!;
    return { outcome: 'has_room', slug: r.slug, roomId: r.id };
  }
  let ws = ownerWorkspace(accountId);
  if (!ws) {
    ws = `ws-${++db.seq}`;
    db.workspaces.push({ id: ws, created_by: accountId });
    db.members.push({ id: `mem-${++db.seq}`, workspace_id: ws, account_id: accountId, status: 'active', created_at: '2026-07-25T00:00:00Z' });
  }
  const roomId = `room-${++db.seq}`;
  db.rooms.push({ id: roomId, slug: p.p_slug, display_name: p.p_display_name, status: 'open' });
  db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: accountId });
  db.idem.push({ account_id: accountId, idempotency_key: key, request_fingerprint: fp, room_id: roomId });
  return { outcome: 'created', slug: p.p_slug, roomId, replayed: false };
}

/** Models create_additional_karaoke_room (6-arg keyed): uncapped + required idempotency. */
function fakeAdditionalRpc(p: Record<string, unknown>) {
  const accountId = String(p.p_account_id);
  const key = String(p.p_idempotency_key ?? '').trim() || null;
  const fp = String(p.p_request_fingerprint ?? '').trim() || null;
  if (!key) return { outcome: 'invalid_idempotency_key' };
  if (!fp) return { outcome: 'invalid_request_fingerprint' };
  if (!db.accounts.some((a) => a.id === accountId)) return { outcome: 'account_not_found' };
  const prior = idemLookup(accountId, key);
  if (prior) {
    if (prior.request_fingerprint !== fp) return { outcome: 'idempotency_conflict' };
    const r = db.rooms.find((x) => x.id === prior.room_id);
    if (!prior.room_id || !r) return { outcome: 'idempotency_target_missing' };
    return { outcome: 'created', slug: r.slug, roomId: r.id, replayed: true };
  }
  const count = canonicalCount(accountId);
  if (count === 0) return { outcome: 'first_room_required', count };
  const ws = ownerWorkspace(accountId);
  if (!ws) return { outcome: 'ownership_state_invalid', count };
  const roomId = `room-${++db.seq}`;
  db.rooms.push({ id: roomId, slug: p.p_slug, display_name: p.p_display_name, status: 'open' });
  db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: accountId });
  db.idem.push({ account_id: accountId, idempotency_key: key, request_fingerprint: fp, room_id: roomId });
  return { outcome: 'created', slug: p.p_slug, roomId, count: count + 1, replayed: false };
}

vi.mock('@/lib/dj-auth.server', () => ({
  sha256Hex: async (s: string) => `hash(${s})`,
  randomToken: () => 'tok',
}));
vi.mock('@/lib/host-plan.server', () => ({ ensureDefaultFreePlan: async () => {} }));
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string, p: Record<string, unknown>) => {
      const data =
        name === 'create_karaoke_room'
          ? fakeFirstRpc(p)
          : name === 'create_additional_karaoke_room'
            ? fakeAdditionalRpc(p)
            : null;
      return Promise.resolve(data ? { data, error: null } : { data: null, error: { message: `unknown rpc ${name}` } });
    },
    from(table: string) {
      const eqs: Array<[string, unknown]> = [];
      let inFilter: { col: string; vals: unknown[] } | null = null;
      let headCount = false;
      const matched = () => {
        let rows = tableFor(table).filter((r) => eqs.every(([c, v]) => r[c] === v));
        if (inFilter) rows = rows.filter((r) => inFilter!.vals.includes(r[inFilter!.col]));
        return rows;
      };
      const b = {
        select: (_c?: unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) headCount = true;
          return b;
        },
        eq: (c: string, v: unknown) => { eqs.push([c, v]); return b; },
        in: (c: string, vals: unknown[]) => { inFilter = { col: c, vals }; return b; },
        order: () => b,
        limit: () => b,
        maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown; error: unknown; count?: number }) => unknown) =>
          Promise.resolve(resolve(headCount ? { data: null, error: null, count: matched().length } : { data: matched(), error: null })),
      };
      return b;
    },
  }),
}));

import { createFirstRoomForAccount, createAdditionalRoomForAccount, createRoomForAccount, countOwnedRooms } from './host-auth.server';

function seedAccount(accountId: string) {
  db.accounts.push({ id: accountId });
  const ws = `ws-${accountId}`;
  db.workspaces.push({ id: ws, created_by: accountId });
  db.members.push({ id: `mem-${accountId}`, workspace_id: ws, account_id: accountId, status: 'active', created_at: '2026-07-25T00:00:00Z' });
  return ws;
}
function seedRoom(accountId: string, ws: string, claimedBy = accountId) {
  const roomId = `seed-${accountId}-${db.seq++}`;
  db.rooms.push({ id: roomId, slug: roomId, display_name: 'Seed', status: 'open' });
  db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: claimedBy });
  return roomId;
}

beforeEach(() => {
  db.accounts = []; db.plans = []; db.workspaces = []; db.members = []; db.ownership = []; db.rooms = []; db.events = []; db.idem = [];
  db.seq = 0; db.eventInserts = 0;
});

describe('First-Room idempotency', () => {
  it('(1) same key + same payload → ONE Room, replays the SAME Room', async () => {
    seedAccount('a'); // 0 owned Rooms
    const a = await createFirstRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp' });
    const b = await createFirstRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp' });
    expect(a.outcome).toBe('created');
    expect(b.outcome).toBe('created');
    if (a.outcome === 'created' && b.outcome === 'created') expect(b.roomId).toBe(a.roomId);
    expect(canonicalCount('a')).toBe(1);
    expect(db.idem.length).toBe(1);
  });

  it('(2) same key + DIFFERENT payload → idempotency_conflict, no second Room', async () => {
    seedAccount('a');
    await createFirstRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp-A' });
    const r = await createFirstRoomForAccount({ accountId: 'a', displayName: 'Y', idempotencyKey: 'K', requestFingerprint: 'fp-B' });
    expect(r.outcome).toBe('idempotency_conflict');
    expect(canonicalCount('a')).toBe(1);
  });

  it('(9) concurrent same-key first-Room → exactly ONE Room / ownership / ledger row', async () => {
    seedAccount('a');
    const [x, y] = await Promise.all([
      createFirstRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'ONE', requestFingerprint: 'fp' }),
      createFirstRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'ONE', requestFingerprint: 'fp' }),
    ]);
    expect(x.outcome).toBe('created');
    expect(y.outcome).toBe('created');
    expect(db.rooms.length).toBe(1);
    expect(db.ownership.length).toBe(1);
    expect(db.idem.length).toBe(1);
  });
});

describe('Additional-Room: no cap + required idempotency', () => {
  it('(8) FREE Host may create Rooms 2, 3, 4 (no cap)', async () => {
    const ws = seedAccount('free'); seedRoom('free', ws); // 1 owned
    for (const [k, n] of [['k2', 'Two'], ['k3', 'Three'], ['k4', 'Four']] as const) {
      const r = await createAdditionalRoomForAccount({ accountId: 'free', displayName: n, idempotencyKey: k, requestFingerprint: `fp-${k}` });
      expect(r.outcome).toBe('created');
    }
    expect(canonicalCount('free')).toBe(4);
  });

  it('(3) blank key → invalid_idempotency_key, writes nothing', async () => {
    const ws = seedAccount('a'); seedRoom('a', ws);
    const before = db.rooms.length;
    const r = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: '   ', requestFingerprint: 'fp' });
    expect(r.outcome).toBe('invalid_idempotency_key');
    expect(db.rooms.length).toBe(before);
  });

  it('(4) blank fingerprint → invalid_request_fingerprint, writes nothing', async () => {
    const ws = seedAccount('a'); seedRoom('a', ws);
    const before = db.rooms.length;
    const r = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: '' });
    expect(r.outcome).toBe('invalid_request_fingerprint');
    expect(db.rooms.length).toBe(before);
  });

  it('same key + same payload replays; + different payload conflicts', async () => {
    const ws = seedAccount('a'); seedRoom('a', ws);
    const first = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp' });
    const replay = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp' });
    const conflict = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'Z', idempotencyKey: 'K', requestFingerprint: 'fp-Z' });
    expect(first.outcome).toBe('created');
    expect(replay.outcome).toBe('created');
    if (replay.outcome === 'created') expect(replay.replayed).toBe(true);
    expect(conflict.outcome).toBe('idempotency_conflict');
    expect(canonicalCount('a')).toBe(2); // seed + exactly one new Room
  });

  it('(10) concurrent same-key additional-Room → exactly ONE new Room / ownership / ledger row', async () => {
    const ws = seedAccount('a'); seedRoom('a', ws);
    const roomsBefore = db.rooms.length;
    const idemBefore = db.idem.length;
    const [x, y] = await Promise.all([
      createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'ONE', requestFingerprint: 'fp' }),
      createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'ONE', requestFingerprint: 'fp' }),
    ]);
    expect(x.outcome).toBe('created');
    expect(y.outcome).toBe('created');
    expect(db.rooms.length).toBe(roomsBefore + 1);
    expect(db.idem.length).toBe(idemBefore + 1);
  });

  it('zero owned → first_room_required (valid key), writes nothing', async () => {
    seedAccount('a'); // 0 owned
    const before = db.rooms.length;
    const r = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp' });
    expect(r.outcome).toBe('first_room_required');
    expect(db.rooms.length).toBe(before);
  });
});

describe('Canonical ownership counting (membership, not claimed_by_account)', () => {
  it('(5) a Room owned via the account\'s workspace counts even if claimed_by_account differs', async () => {
    const ws = seedAccount('a');
    seedRoom('a', ws, 'someone-else'); // owned via a's workspace, but claimed by another id
    expect(await countOwnedRooms('a')).toBe(1);
    // Not treated as a first Room: the additional path proceeds to create.
    const r = await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'Second', idempotencyKey: 'K', requestFingerprint: 'fp' });
    expect(r.outcome).toBe('created');
    expect(canonicalCount('a')).toBe(2);
  });
});

describe('createRoomForAccount routing + Event/plan invariants', () => {
  it('(7 support) 0 owned → first RPC; ≥1 owned → additional RPC', async () => {
    seedAccount('newbie'); // 0 owned
    const first = await createRoomForAccount({ accountId: 'newbie', displayName: 'First', idempotencyKey: 'k1' });
    expect(first.kind).toBe('entered');
    const second = await createRoomForAccount({ accountId: 'newbie', displayName: 'Second', idempotencyKey: 'k2' });
    expect(second.kind).toBe('added');
    expect(canonicalCount('newbie')).toBe(2);
  });

  it('creation writes ZERO Events', async () => {
    const ws = seedAccount('a'); seedRoom('a', ws);
    await createAdditionalRoomForAccount({ accountId: 'a', displayName: 'X', idempotencyKey: 'K', requestFingerprint: 'fp' });
    expect(db.eventInserts).toBe(0);
  });
});
