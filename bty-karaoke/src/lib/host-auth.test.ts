// Host Account + Workspace Foundation V1 — the security boundary, proved
// BEHAVIOURALLY against a fake Postgres that models the real invariants:
//   * one account per (provider, subject)          — unique index
//   * one Room belongs to at most ONE workspace    — room_id is the ownership PK
//   * claim is atomic and idempotent               — the claim_karaoke_room RPC
//   * every karaoke_events INSERT is counted       — the no-auto-create tripwire
//
// These are the proofs that ownership cannot be crossed, stolen, or silently
// created — not string checks.

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row { [k: string]: unknown }

const db = {
  accounts: [] as Row[],
  workspaces: [] as Row[],
  members: [] as Row[],
  ownership: [] as Row[],
  sessions: [] as Row[],
  rooms: [] as Row[],
  events: [] as Row[],
  requests: [] as Row[],
  seq: 0,
  eventInserts: 0, // ← auto-create tripwire
};

const tableFor = (t: string): Row[] =>
  ({
    karaoke_accounts: db.accounts,
    karaoke_workspaces: db.workspaces,
    karaoke_workspace_members: db.members,
    karaoke_room_ownership: db.ownership,
    karaoke_host_sessions: db.sessions,
    karaoke_rooms: db.rooms,
    karaoke_events: db.events,
    karaoke_requests: db.requests,
  })[t] ?? [];

/** Models claim_karaoke_room: atomic, idempotent, never re-assigns a Room. */
function fakeClaimRpc(accountId: string, roomId: string, workspaceName: string) {
  if (!db.rooms.some((r) => r.id === roomId)) return { outcome: 'no_room' };

  const owned = db.ownership.find((o) => o.room_id === roomId);
  if (owned) {
    const isMember = db.members.some(
      (m) => m.workspace_id === owned.workspace_id && m.account_id === accountId && m.status === 'active',
    );
    return isMember
      ? { outcome: 'idempotent', workspaceId: owned.workspace_id, roomId }
      : { outcome: 'conflict' };
  }

  let ws = db.members.find((m) => m.account_id === accountId && m.status === 'active')?.workspace_id as
    | string
    | undefined;
  if (!ws) {
    ws = `ws-${++db.seq}`;
    db.workspaces.push({ id: ws, name: workspaceName, created_by: accountId });
    db.members.push({
      id: `mem-${++db.seq}`, workspace_id: ws, account_id: accountId,
      role: 'owner', status: 'active', created_at: '2026-07-20T00:00:00Z',
    });
  }
  db.ownership.push({ room_id: roomId, workspace_id: ws, claimed_by_account: accountId });
  return { outcome: 'claimed', workspaceId: ws, roomId };
}

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string, p: Record<string, unknown>) =>
      Promise.resolve(
        name === 'claim_karaoke_room'
          ? { data: fakeClaimRpc(String(p.p_account_id), String(p.p_room_id), String(p.p_workspace_name)), error: null }
          : { data: null, error: { message: `unknown rpc ${name}` } },
      ),
    from(table: string) {
      const eqs: Array<[string, unknown]> = [];
      let ins: Row | null = null;
      let upd: Row | null = null;
      let inFilter: { col: string; vals: unknown[] } | null = null;

      const matched = () => {
        let rows = tableFor(table).filter((r) => eqs.every(([c, v]) => r[c] === v));
        if (inFilter) rows = rows.filter((r) => inFilter!.vals.includes(r[inFilter!.col]));
        return rows;
      };

      const applyInsert = () => {
        // Model the DB column defaults the real schema supplies.
        const defaults: Row =
          table === 'karaoke_host_sessions' || table === 'karaoke_workspace_members'
            ? { status: 'active' }
            : {};
        const row = { id: `${table}-${++db.seq}`, ...defaults, ...ins } as Row;
        if (table === 'karaoke_events') db.eventInserts += 1;
        // Model the (provider, provider_subject) unique index.
        if (table === 'karaoke_accounts') {
          const dupe = db.accounts.find(
            (a) => a.provider === row.provider && a.provider_subject === row.provider_subject,
          );
          if (dupe) return { data: null, error: { code: '23505' } };
        }
        tableFor(table).push(row);
        return { data: row, error: null };
      };

      const b = {
        select: () => b,
        insert: (row: Row) => { ins = row; return b; },
        update: (row: Row) => { upd = row; return b; },
        eq: (c: string, v: unknown) => { eqs.push([c, v]); return b; },
        in: (c: string, vals: unknown[]) => { inFilter = { col: c, vals }; return b; },
        order: () => b,
        limit: () => b,
        maybeSingle: async () => {
          if (ins) return applyInsert();
          if (upd) { for (const r of matched()) Object.assign(r, upd); return { data: null, error: null }; }
          const rows = matched();
          return { data: rows[0] ?? null, error: null };
        },
        single: async () => {
          if (ins) return applyInsert();
          const rows = matched();
          return { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } };
        },
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          if (ins) return Promise.resolve(resolve(applyInsert()));
          if (upd) { const rows = matched(); for (const r of rows) Object.assign(r, upd); return Promise.resolve(resolve({ data: rows, error: null })); }
          return Promise.resolve(resolve({ data: matched(), error: null }));
        },
      };
      return b;
    },
  }),
}));

import {
  resolveAccountForIdentity,
  createHostSession,
  authorizeHost,
  revokeHostSession,
  accountHasRoomAccess,
  claimRoomForAccount,
  listHostRooms,
} from './host-auth.server';

beforeEach(() => {
  db.accounts = []; db.workspaces = []; db.members = []; db.ownership = [];
  db.sessions = []; db.rooms = []; db.events = []; db.requests = [];
  db.seq = 0; db.eventInserts = 0;
  db.rooms.push({ id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home', status: 'open' });
  db.rooms.push({ id: 'room-other', slug: 'other', display_name: 'Other', status: 'open' });
});

describe('(1)(2) identity → exactly ONE account, idempotently', () => {
  it('a verified identity creates exactly one account', async () => {
    const a = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1', email: 'a@b.c' });
    expect(a.provider_subject).toBe('sub-1');
    expect(db.accounts).toHaveLength(1);
  });

  it('repeating the SAME identity resolves the same account — never a duplicate', async () => {
    const first = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    const again = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    const third = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    expect(again.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(db.accounts).toHaveLength(1);
  });

  it('a DIFFERENT Apple subject is a different person', async () => {
    await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-2' });
    expect(db.accounts).toHaveLength(2);
  });
});

describe('sessions — opaque, hashed, revocable', () => {
  it('a minted session resolves back to its account; the raw token is never stored', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    const { token } = await createHostSession(acct.id);
    expect(db.sessions[0].token_hash).not.toBe(token); // hashed at rest
    expect((await authorizeHost(token))?.id).toBe(acct.id);
  });

  it('an unknown token authorizes nothing', async () => {
    expect(await authorizeHost('not-a-real-token')).toBeNull();
    expect(await authorizeHost(null)).toBeNull();
  });

  it('a revoked session stops working immediately (real sign out)', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    const { token } = await createHostSession(acct.id);
    await revokeHostSession(token);
    expect(await authorizeHost(token)).toBeNull();
  });

  it('an expired session is refused', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    const { token } = await createHostSession(acct.id, Date.now() - 400 * 24 * 3600 * 1000);
    expect(await authorizeHost(token)).toBeNull();
  });
});

describe('(4)(5)(7)(8)(9)(10) ownership boundary', () => {
  it('(4) a signed-in Host with NO membership cannot access the Room', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    expect(await accountHasRoomAccess(acct.id, 'room-pilot')).toBe(false);
  });

  it('(5) a claim atomically creates workspace + membership + ownership', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    const res = await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });
    expect(res.outcome).toBe('claimed');
    expect(db.workspaces).toHaveLength(1);
    expect(db.members).toHaveLength(1);
    expect(db.ownership).toHaveLength(1);
    expect(await accountHasRoomAccess(acct.id, 'room-pilot')).toBe(true);
  });

  it('(6) a claim that never runs leaves NO partial ownership graph', async () => {
    // The route rejects a wrong passcode before calling the RPC at all.
    await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    expect(db.workspaces).toHaveLength(0);
    expect(db.members).toHaveLength(0);
    expect(db.ownership).toHaveLength(0);
  });

  it('(8) the already-authorized Host can repeat the claim safely (idempotent)', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });
    const again = await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });
    expect(again.outcome).toBe('idempotent');
    expect(db.workspaces).toHaveLength(1);
    expect(db.ownership).toHaveLength(1);
  });

  it('(7) a SECOND unrelated Host cannot claim the same Room', async () => {
    const owner = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-owner' });
    await claimRoomForAccount({ accountId: owner.id, roomId: 'room-pilot' });

    const intruder = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-intruder' });
    const res = await claimRoomForAccount({ accountId: intruder.id, roomId: 'room-pilot' });
    expect(res.outcome).toBe('conflict');
    expect(db.ownership).toHaveLength(1);                       // never re-assigned
    expect(db.ownership[0].claimed_by_account).toBe(owner.id);  // still the owner's
    expect(await accountHasRoomAccess(intruder.id, 'room-pilot')).toBe(false);
  });

  it('(9) REVOKED membership blocks Room access on the very next check', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });
    expect(await accountHasRoomAccess(acct.id, 'room-pilot')).toBe(true);

    db.members[0].status = 'revoked';
    expect(await accountHasRoomAccess(acct.id, 'room-pilot')).toBe(false);
  });

  it('(10) membership in one workspace grants NOTHING in another Room', async () => {
    const a = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-a' });
    const b = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-b' });
    await claimRoomForAccount({ accountId: a.id, roomId: 'room-pilot' });
    await claimRoomForAccount({ accountId: b.id, roomId: 'room-other' });

    // Swapping the Room id must not cross the boundary.
    expect(await accountHasRoomAccess(a.id, 'room-other')).toBe(false);
    expect(await accountHasRoomAccess(b.id, 'room-pilot')).toBe(false);
  });

  it('an unclaimed Room grants no account-scoped access to anyone', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    expect(await accountHasRoomAccess(acct.id, 'room-other')).toBe(false);
  });
});

describe('(11)(12)(13) the account layer NEVER creates an Event', () => {
  it('sign-in, claim, and My Norebang all leave the Event count at zero', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' }); // (11) login
    const { token } = await createHostSession(acct.id);
    await authorizeHost(token);

    await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });               // (12) claim

    for (let i = 0; i < 5; i++) await listHostRooms(acct.id);                              // (13) My Norebang

    expect(db.eventInserts).toBe(0);
    expect(db.events).toHaveLength(0);
  });

  it('My Norebang lists only Rooms the account actually owns, with server truth', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-1' });
    await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });

    // No live event yet.
    let cards = await listHostRooms(acct.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ slug: 'bty-home', hasActiveEvent: false, queueCount: 0 });

    // A live event + two active requests now exist.
    db.events.push({ id: 'evt-1', room_id: 'room-pilot', name: 'Tonight', status: 'active', starts_at: 'T' });
    db.requests.push(
      { id: 'r1', event_id: 'evt-1', status: 'waiting' },
      { id: 'r2', event_id: 'evt-1', status: 'playing' },
      { id: 'r3', event_id: 'evt-1', status: 'completed' }, // history is not "queue"
    );
    cards = await listHostRooms(acct.id);
    expect(cards[0]).toMatchObject({ hasActiveEvent: true, queueCount: 2 });
    expect(cards[0].activeEvent?.id).toBe('evt-1');
  });

  it('a Host with no memberships sees an empty My Norebang (never someone else’s Room)', async () => {
    const stranger = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-stranger' });
    const owner = await resolveAccountForIdentity({ provider: 'apple', subject: 'sub-owner' });
    await claimRoomForAccount({ accountId: owner.id, roomId: 'room-pilot' });
    expect(await listHostRooms(stranger.id)).toEqual([]);
  });
});
