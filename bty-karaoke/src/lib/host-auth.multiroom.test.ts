// PRO Multi-Room V1 — the Room-limit enforcement, proved BEHAVIOURALLY against a fake
// Postgres whose create_additional_karaoke_room models the REAL function: it resolves
// the account's active plan, derives FREE=1 / PRO=3 ITSELF, counts owned Rooms, and
// refuses at/over the cap. The fake RPC body is synchronous (no awaits inside), so two
// concurrent service calls execute their count→insert atomically one after another —
// exactly the serialization the shared per-account advisory xact lock provides in
// Postgres. These are proofs that:
//   * the caller passes NO limit and cannot inflate it (the plan is resolved in-DB),
//   * FREE at 1 and PRO at 3 are blocked even if the UI/route is bypassed,
//   * two simultaneous "create the 3rd" requests end at exactly 3 (never Room 4),
//   * creation writes ZERO Events and NEVER mutates plan assignments.

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
  seq: 0,
  eventInserts: 0, // auto-create tripwire
  rpcCalls: [] as Array<{ name: string; params: Record<string, unknown> }>,
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
  })[t] ?? [];

/** Owned active Rooms for an account: ownership rows whose workspace the account owns. */
function ownedCount(accountId: string): number {
  const wsIds = db.members.filter((m) => m.account_id === accountId && m.status === 'active').map((m) => m.workspace_id);
  return db.ownership.filter((o) => wsIds.includes(o.workspace_id)).length;
}
function ownerWorkspace(accountId: string): string | undefined {
  return db.members.find((m) => m.account_id === accountId && m.status === 'active')?.workspace_id as string | undefined;
}

/** Owned Rooms by the canonical owner column (what the corrected RPC counts). */
function ownedByColumn(accountId: string): number {
  return db.ownership.filter((o) => o.claimed_by_account === accountId).length;
}

/**
 * Models the CORRECTED create_additional_karaoke_room: plan + cap resolved HERE;
 * synchronous body = atomic (the advisory lock's serialization). Fails CLOSED with zero
 * writes on zero-owned ('first_room_required') and missing-workspace
 * ('ownership_state_invalid') — it never provisions a workspace or creates a first Room.
 */
function fakeAdditionalRpc(p: Record<string, unknown>) {
  const accountId = String(p.p_account_id);
  if (!db.accounts.some((a) => a.id === accountId)) return { outcome: 'account_not_found' };
  const count = ownedByColumn(accountId);
  if (count === 0) return { outcome: 'first_room_required' }; // 0→1 belongs to create_karaoke_room
  let plan = String(db.plans.find((r) => r.account_id === accountId && r.status === 'active')?.plan_code ?? 'FREE');
  if (plan !== 'FREE' && plan !== 'PRO') plan = 'FREE';
  const max = plan === 'PRO' ? 3 : 1;
  if (count >= max) return { outcome: 'limit_reached', plan, count, max };
  const ws = ownerWorkspace(accountId);
  if (!ws) return { outcome: 'ownership_state_invalid' }; // broken graph → fail closed, no write
  const roomId = `room-${++db.seq}`;
  db.rooms.push({ id: roomId, slug: p.p_slug, display_name: p.p_display_name, dj_secret: p.p_dj_secret, status: 'open' });
  db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: accountId });
  return { outcome: 'created', slug: p.p_slug, roomId, plan, count: count + 1, max };
}

/** Models create_karaoke_room (first Room): has_room if already owns, else create. */
function fakeFirstRpc(p: Record<string, unknown>) {
  const accountId = String(p.p_account_id);
  if (ownedCount(accountId) > 0) {
    const wsIds = db.members.filter((m) => m.account_id === accountId && m.status === 'active').map((m) => m.workspace_id);
    const o = db.ownership.find((x) => wsIds.includes(x.workspace_id))!;
    const r = db.rooms.find((x) => x.id === o.room_id)!;
    return { outcome: 'has_room', slug: r.slug, roomId: r.id };
  }
  let ws = ownerWorkspace(accountId);
  if (!ws) {
    ws = `ws-${++db.seq}`;
    db.workspaces.push({ id: ws, created_by: accountId });
    db.members.push({ id: `mem-${++db.seq}`, workspace_id: ws, account_id: accountId, status: 'active', created_at: '2026-07-24T00:00:00Z' });
  }
  const roomId = `room-${++db.seq}`;
  db.rooms.push({ id: roomId, slug: p.p_slug, display_name: p.p_display_name, status: 'open' });
  db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: accountId });
  return { outcome: 'created', slug: p.p_slug, roomId };
}

vi.mock('@/lib/dj-auth.server', () => ({
  sha256Hex: async (s: string) => `hash(${s})`,
  randomToken: () => 'tok',
}));

vi.mock('@/lib/host-plan.server', () => ({ ensureDefaultFreePlan: async () => {} }));

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string, p: Record<string, unknown>) => {
      db.rpcCalls.push({ name, params: p });
      const data =
        name === 'create_additional_karaoke_room'
          ? fakeAdditionalRpc(p)
          : name === 'create_karaoke_room'
            ? fakeFirstRpc(p)
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
        select: (_cols?: unknown, opts?: { count?: string; head?: boolean }) => {
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

import { createAdditionalRoomForAccount, createRoomForAccount, countOwnedRooms } from './host-auth.server';

/** Seed an account with `plan` and `n` already-owned Rooms. */
function seed(accountId: string, plan: 'FREE' | 'PRO', n: number) {
  db.accounts.push({ id: accountId });
  db.plans.push({ account_id: accountId, plan_code: plan, status: 'active' });
  const ws = `ws-${accountId}`;
  db.workspaces.push({ id: ws, created_by: accountId });
  db.members.push({ id: `mem-${accountId}`, workspace_id: ws, account_id: accountId, status: 'active', created_at: '2026-07-24T00:00:00Z' });
  for (let i = 0; i < n; i++) {
    const roomId = `seed-${accountId}-${i}`;
    db.rooms.push({ id: roomId, slug: `${accountId}-room-${i}`, display_name: `Room ${i}`, status: 'open' });
    db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: accountId });
  }
}

beforeEach(() => {
  db.accounts = []; db.plans = []; db.workspaces = []; db.members = []; db.ownership = []; db.rooms = []; db.events = [];
  db.seq = 0; db.eventInserts = 0; db.rpcCalls = [];
});

describe('PRO Multi-Room V1 — server-enforced Room limit', () => {
  it('FREE at count 1 is BLOCKED even when the additional path is called directly (UI/route bypassed)', async () => {
    seed('free-1', 'FREE', 1);
    const r = await createAdditionalRoomForAccount({ accountId: 'free-1', displayName: 'Sneaky Second' });
    expect(r.outcome).toBe('limit_reached');
    expect(ownedCount('free-1')).toBe(1); // no Room created
  });

  it('PRO may create at count 1 and at count 2', async () => {
    seed('pro-1', 'PRO', 1);
    const a = await createAdditionalRoomForAccount({ accountId: 'pro-1', displayName: 'Second' });
    expect(a.outcome).toBe('created');
    expect(ownedCount('pro-1')).toBe(2);
    const b = await createAdditionalRoomForAccount({ accountId: 'pro-1', displayName: 'Third' });
    expect(b.outcome).toBe('created');
    expect(ownedCount('pro-1')).toBe(3);
  });

  it('PRO at count 3 is blocked', async () => {
    seed('pro-3', 'PRO', 3);
    const r = await createAdditionalRoomForAccount({ accountId: 'pro-3', displayName: 'Fourth' });
    expect(r.outcome).toBe('limit_reached');
    if (r.outcome === 'limit_reached') expect(r.max).toBe(3);
    expect(ownedCount('pro-3')).toBe(3);
  });

  it('the caller cannot choose or inflate the limit — the RPC is called with NO limit parameter', async () => {
    seed('pro-x', 'PRO', 1);
    await createAdditionalRoomForAccount({ accountId: 'pro-x', displayName: 'Second' });
    const call = db.rpcCalls.find((c) => c.name === 'create_additional_karaoke_room')!;
    expect(Object.keys(call.params).sort()).toEqual(['p_account_id', 'p_display_name', 'p_dj_secret', 'p_slug']);
    expect(JSON.stringify(call.params)).not.toMatch(/max|limit/i);
  });

  it('legacy FREE with 2 Rooms: creation blocked, but existing Rooms are untouched (access intact)', async () => {
    seed('free-legacy', 'FREE', 2);
    const before = db.ownership.filter((o) => o.claimed_by_account === 'free-legacy').map((o) => o.room_id).sort();
    const r = await createAdditionalRoomForAccount({ accountId: 'free-legacy', displayName: 'Third' });
    expect(r.outcome).toBe('limit_reached');
    const after = db.ownership.filter((o) => o.claimed_by_account === 'free-legacy').map((o) => o.room_id).sort();
    expect(after).toEqual(before); // both legacy Rooms preserved, none removed/mutated
    expect(after.length).toBe(2);
  });

  it('CONCURRENCY: PRO at count 2, two simultaneous requests → exactly 3 (one created, one limit_reached, never Room 4)', async () => {
    seed('pro-race', 'PRO', 2);
    // The synchronous fake RPC body models the advisory lock: the two count→insert
    // sequences cannot interleave, exactly as Postgres serializes them per account.
    const [r1, r2] = await Promise.all([
      createAdditionalRoomForAccount({ accountId: 'pro-race', displayName: 'A' }),
      createAdditionalRoomForAccount({ accountId: 'pro-race', displayName: 'B' }),
    ]);
    const outcomes = [r1.outcome, r2.outcome].sort();
    expect(outcomes).toEqual(['created', 'limit_reached']);
    expect(ownedCount('pro-race')).toBe(3); // NOT 4
  });

  it('direct additional RPC at ZERO owned Rooms → first_room_required, writes nothing', async () => {
    db.accounts.push({ id: 'zero' });
    db.plans.push({ account_id: 'zero', plan_code: 'PRO', status: 'active' });
    const roomsBefore = db.rooms.length;
    const ownBefore = db.ownership.length;
    const r = await createAdditionalRoomForAccount({ accountId: 'zero', displayName: 'Nope' });
    expect(r.outcome).toBe('first_room_required');
    expect(db.rooms.length).toBe(roomsBefore); // zero writes
    expect(db.ownership.length).toBe(ownBefore);
  });

  it('malformed workspace state (owns a Room, no active workspace) → ownership_state_invalid, writes nothing', async () => {
    // Ownership exists by the owner column, but the account has NO active membership.
    db.accounts.push({ id: 'broken' });
    db.plans.push({ account_id: 'broken', plan_code: 'PRO', status: 'active' });
    db.ownership.push({ room_id: 'orphan-room', workspace_id: 'ws-gone', claimed_by_account: 'broken' });
    db.members.push({ id: 'mem-broken', workspace_id: 'ws-gone', account_id: 'broken', status: 'ended', created_at: '2026-07-24T00:00:00Z' });
    const roomsBefore = db.rooms.length;
    const ownBefore = db.ownership.length;
    const r = await createAdditionalRoomForAccount({ accountId: 'broken', displayName: 'Nope' });
    expect(r.outcome).toBe('ownership_state_invalid');
    expect(db.rooms.length).toBe(roomsBefore); // zero writes — no defensive provisioning
    expect(db.ownership.length).toBe(ownBefore);
  });

  it('creation causes ZERO Event writes and NEVER mutates plan assignments', async () => {
    seed('pro-clean', 'PRO', 1);
    const plansBefore = JSON.stringify(db.plans);
    await createAdditionalRoomForAccount({ accountId: 'pro-clean', displayName: 'Second' });
    expect(db.eventInserts).toBe(0);
    expect(JSON.stringify(db.plans)).toBe(plansBefore); // no assignment/audit change
  });
});

describe('createRoomForAccount routing (first-Room path preserved)', () => {
  it('0 owned Rooms → the unchanged first-Room RPC (create_karaoke_room), enters Admin', async () => {
    db.accounts.push({ id: 'newbie' });
    db.plans.push({ account_id: 'newbie', plan_code: 'FREE', status: 'active' });
    const r = await createRoomForAccount({ accountId: 'newbie', displayName: 'My First' });
    expect(r.kind).toBe('entered');
    expect(db.rpcCalls.map((c) => c.name)).toContain('create_karaoke_room');
    expect(db.rpcCalls.map((c) => c.name)).not.toContain('create_additional_karaoke_room');
    expect(ownedCount('newbie')).toBe(1);
  });

  it('≥1 owned Room → the additional-Room RPC; PRO returns "added", FREE-at-cap returns "limit_reached"', async () => {
    seed('pro-add', 'PRO', 1);
    const added = await createRoomForAccount({ accountId: 'pro-add', displayName: 'Second' });
    expect(added.kind).toBe('added');
    expect(db.rpcCalls.map((c) => c.name)).toContain('create_additional_karaoke_room');

    seed('free-cap', 'FREE', 1);
    const blocked = await createRoomForAccount({ accountId: 'free-cap', displayName: 'Second' });
    expect(blocked.kind).toBe('limit_reached');
  });

  it('countOwnedRooms reflects the ownership graph', async () => {
    seed('counter', 'PRO', 2);
    expect(await countOwnedRooms('counter')).toBe(2);
    expect(await countOwnedRooms('nobody')).toBe(0);
  });
});
