// Google Login + Android Web Access V1 — EVENT TRIPWIRES for the web Host path.
//
// Every browser-facing operation must create ZERO Events. Proved against a fake
// Postgres that counts karaoke_events INSERTs — a tripwire, not a source grep.

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row { [k: string]: unknown }
const db = {
  accounts: [] as Row[], identities: [] as Row[], workspaces: [] as Row[],
  members: [] as Row[], ownership: [] as Row[], sessions: [] as Row[],
  rooms: [] as Row[], events: [] as Row[], requests: [] as Row[],
  seq: 0, eventInserts: 0,
};
const tableFor = (t: string): Row[] => ({
  karaoke_accounts: db.accounts, karaoke_account_identities: db.identities,
  karaoke_workspaces: db.workspaces, karaoke_workspace_members: db.members,
  karaoke_room_ownership: db.ownership, karaoke_host_sessions: db.sessions,
  karaoke_rooms: db.rooms, karaoke_events: db.events, karaoke_requests: db.requests,
}[t] ?? []);

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: () => Promise.resolve({ data: null, error: null }),
    from(table: string) {
      const eqs: Array<[string, unknown]> = [];
      let ins: Row | null = null; let upd: Row | null = null;
      let inF: { col: string; vals: unknown[] } | null = null;
      const matched = () => {
        let rows = tableFor(table).filter((r) => eqs.every(([c, v]) => r[c] === v));
        if (inF) rows = rows.filter((r) => inF!.vals.includes(r[inF!.col]));
        return rows;
      };
      const applyInsert = () => {
        const defaults: Row = (table === 'karaoke_host_sessions' || table === 'karaoke_workspace_members')
          ? { status: 'active' } : {};
        const row = { id: `${table}-${++db.seq}`, ...defaults, ...ins } as Row;
        if (table === 'karaoke_events') db.eventInserts += 1;   // ← tripwire
        if (table === 'karaoke_account_identities' &&
            db.identities.find((i) => i.provider === row.provider && i.provider_subject === row.provider_subject)) {
          return { data: null, error: { code: '23505' } };
        }
        tableFor(table).push(row);
        return { data: row, error: null };
      };
      const b = {
        select: () => b, insert: (r: Row) => { ins = r; return b; },
        update: (r: Row) => { upd = r; return b; }, delete: () => b,
        eq: (c: string, v: unknown) => { eqs.push([c, v]); return b; },
        in: (c: string, vals: unknown[]) => { inF = { col: c, vals }; return b; },
        order: () => b, limit: () => b,
        maybeSingle: async () => {
          if (ins) return applyInsert();
          if (upd) { for (const r of matched()) Object.assign(r, upd); return { data: null, error: null }; }
          return { data: matched()[0] ?? null, error: null };
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
  resolveAccountForIdentity, createHostSession, authorizeHost, revokeHostSession,
  listHostRooms, listAccountIdentities, linkIdentityToAccount, claimRoomForAccount,
} from './host-auth.server';

beforeEach(() => {
  db.accounts = []; db.identities = []; db.workspaces = []; db.members = [];
  db.ownership = []; db.sessions = []; db.rooms = []; db.events = []; db.requests = [];
  db.seq = 0; db.eventInserts = 0;
  db.rooms.push({ id: 'room-pilot', slug: 'bty-home', display_name: 'BTY Home', status: 'open' });
});

describe('web Host path creates ZERO Events', () => {
  it('google first login → account only, no Room, no Event', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'google', subject: 'g-1', email: 'a@b.c' });
    expect(db.accounts).toHaveLength(1);
    expect(db.eventInserts).toBe(0);
    expect(db.ownership).toHaveLength(0);   // login never creates ownership
    expect(db.rooms).toHaveLength(1);       // never creates a Room
    expect(acct.id).toBeTruthy();
  });

  it('the whole browser journey creates zero Events', async () => {
    // login → session restore → My Norebang → Login Methods → link → claim → logout
    const acct = await resolveAccountForIdentity({ provider: 'google', subject: 'g-1' });
    const { token } = await createHostSession(acct.id);
    await authorizeHost(token);                       // session restore
    await listHostRooms(acct.id);                     // /host + My Norebang GET
    await listAccountIdentities(acct.id);             // Login Methods GET
    await linkIdentityToAccount({ accountId: acct.id, provider: 'apple', subject: 'a-1' });
    await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });
    await listHostRooms(acct.id);                     // My Norebang after claim
    await revokeHostSession(token);                   // logout
    expect(db.eventInserts).toBe(0);
    expect(db.events).toHaveLength(0);
  });

  it('repeated My Norebang loads never create an Event', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'google', subject: 'g-1' });
    for (let i = 0; i < 10; i++) await listHostRooms(acct.id);
    expect(db.eventInserts).toBe(0);
  });

  it('logout revokes the session but leaves account, ownership and Events intact', async () => {
    const acct = await resolveAccountForIdentity({ provider: 'google', subject: 'g-1' });
    await claimRoomForAccount({ accountId: acct.id, roomId: 'room-pilot' });
    const { token } = await createHostSession(acct.id);
    await revokeHostSession(token);
    expect(await authorizeHost(token)).toBeNull();    // session dead
    expect(db.accounts).toHaveLength(1);              // account preserved
    expect(db.rooms).toHaveLength(1);                 // Room preserved
    expect(db.eventInserts).toBe(0);                  // no Event touched
  });
});
