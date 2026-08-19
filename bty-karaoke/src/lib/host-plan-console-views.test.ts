// BUILD R4-R1 — operator-first Host Plans semantics, proved against a PRODUCTION-SHAPED fixture.
//
// The audit measured production exactly: 25 accounts = 13 active + 12 deletion tombstones, 12
// active assignments, and "13 anomalies" of which 12 were deleted accounts whose assignment the
// deletion flow had correctly ended. This fixture reproduces that shape so the console's headline
// number can be asserted against the real situation rather than an invented one.
//
// THE CLAIM UNDER TEST: an expected historical state is not an anomaly. Everything else follows.

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { [k: string]: unknown }
const DB: Record<string, Row[]> = {};
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    from(table: string) {
      return { select: async () => ({ data: DB[table] ?? [], error: null }) };
    },
  }),
}));

import { listHostPlanConsole } from './host-plan-console.server';

const acct = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ws = (n: number) => `wwwwwwww-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * Production shape as measured 2026-08-18:
 *   13 active  — 8 owning a live Room, 5 with none; 12 with a persisted active assignment and
 *                ONE (account 13) with none at all → the single genuine Needs Attention row.
 *   12 deleted — tombstoned, assignment correctly ENDED, room retired and renamed.
 */
function seed() {
  const accounts: Row[] = [];
  const members: Row[] = [];
  const ownership: Row[] = [];
  const rooms: Row[] = [];
  const assignments: Row[] = [];

  for (let i = 1; i <= 13; i++) {
    accounts.push({ id: acct(i), created_at: '2026-07-20T00:00:00Z', account_status: 'active' });
    if (i <= 8) {
      members.push({ account_id: acct(i), workspace_id: ws(i), status: 'active' });
      ownership.push({ room_id: `room-${i}`, workspace_id: ws(i) });
      rooms.push({ id: `room-${i}`, slug: `room-${i}`, display_name: `Room ${i}`, branding_theme: null });
    }
    // Account 13 has NO assignment row at all — the one actionable case in production.
    if (i !== 13) {
      assignments.push({
        id: `act-${i}`, account_id: acct(i), plan_code: 'FREE', source: 'SYSTEM_DEFAULT',
        status: 'active', started_at: '2026-07-20T00:00:00Z', ended_at: null,
      });
    }
  }
  for (let i = 14; i <= 25; i++) {
    accounts.push({ id: acct(i), created_at: '2026-08-01T00:00:00Z', account_status: 'deleted' });
    // Deletion ENDED the assignment — this is the contract working, not a fault.
    assignments.push({
      id: `end-${i}`, account_id: acct(i), plan_code: 'FREE', source: 'SYSTEM_DEFAULT',
      status: 'ended', started_at: '2026-08-01T00:00:00Z', ended_at: '2026-08-08T00:00:00Z',
    });
    // Seven tombstones still hold a retired, renamed Room.
    if (i <= 20) {
      members.push({ account_id: acct(i), workspace_id: ws(i), status: 'active' });
      ownership.push({ room_id: `room-${i}`, workspace_id: ws(i) });
      rooms.push({ id: `room-${i}`, slug: `room-${i}`, display_name: '(삭제된 방)', branding_theme: null });
    }
  }

  DB.karaoke_accounts = accounts;
  DB.karaoke_account_identities = accounts.map((a) => ({ account_id: a.id, provider: 'google' }));
  DB.karaoke_host_plan_assignments = assignments;
  DB.karaoke_host_plan_assignment_audit = [];
  DB.karaoke_workspace_members = members;
  DB.karaoke_room_ownership = ownership;
  DB.karaoke_rooms = rooms;
  DB.karaoke_events = [];
}
beforeEach(seed);

describe('R4-R1 — (7) the production-shaped headline', () => {
  it('reports Needs Attention = 1, not 13', async () => {
    const r = await listHostPlanConsole({ view: 'all' });
    expect(r.totals.needsAttention).toBe(1);
    // The raw whole-set anomaly count is UNCHANGED and still 13 — the observation is preserved,
    // only its interpretation is corrected.
    expect(r.totals.anomalies).toBe(13);
  });

  it('(4,11) Active/Free/Pro describe ACTIVE accounts only', async () => {
    const r = await listHostPlanConsole();
    expect(r.totals.activeHosts).toBe(13);
    expect(r.totals.activeFree).toBe(13);
    expect(r.totals.activePro).toBe(0);
    expect(r.totals.deleted).toBe(12);
    expect(r.totals.noRoom).toBe(5);
    // Whole-set counts still exist for anything that reads them.
    expect(r.totals.accounts).toBe(25);
  });
});

describe('R4-R1 — (5,6) which no_active_assignment is actionable', () => {
  it('(5) a DELETED account with no active assignment is NOT Needs Attention', async () => {
    const r = await listHostPlanConsole({ view: 'deleted' });
    const row = r.hosts[0];
    expect(row.accountStatus).toBe('deleted');
    expect(row.anomalies).toContain('no_active_assignment'); // still OBSERVED
    expect(row.actionable).not.toContain('no_active_assignment'); // but not actionable
    expect(row.needsAttention).toBe(false);
    expect(r.hosts.every((h) => !h.needsAttention)).toBe(true);
  });

  it('(6) an ACTIVE account with no active assignment IS Needs Attention', async () => {
    const r = await listHostPlanConsole({ view: 'needs-attention' });
    expect(r.hosts).toHaveLength(1);
    expect(r.hosts[0].accountId).toBe(acct(13));
    expect(r.hosts[0].accountStatus).toBe('active');
    expect(r.hosts[0].actionable).toContain('no_active_assignment');
    expect(r.hosts[0].needsAttention).toBe(true);
  });

  it('a genuine integrity fault survives deletion — only the EXPECTED state is filtered', async () => {
    // Two active assignments on a deleted account is not explained by the tombstone.
    DB.karaoke_host_plan_assignments = [
      ...(DB.karaoke_host_plan_assignments as Row[]),
      { id: 'dup-a', account_id: acct(14), plan_code: 'FREE', source: 'MANUAL', status: 'active', started_at: '2026-08-01T00:00:00Z', ended_at: null },
      { id: 'dup-b', account_id: acct(14), plan_code: 'PRO', source: 'MANUAL', status: 'active', started_at: '2026-08-02T00:00:00Z', ended_at: null },
    ];
    const r = await listHostPlanConsole({ view: 'deleted' });
    const row = r.hosts.find((h) => h.accountId === acct(14))!;
    expect(row.actionable).toContain('multiple_active_assignments');
    expect(row.needsAttention).toBe(true);
  });
});

describe('R4-R1 — (1,2,3,8,9,10) views', () => {
  it('(1,2) the DEFAULT view is Active and excludes every deleted account', async () => {
    const r = await listHostPlanConsole();
    expect(r.hosts).toHaveLength(13);
    expect(r.page.total).toBe(13);
    expect(r.hosts.every((h) => h.accountStatus === 'active')).toBe(true);
  });

  it('(3) deleted accounts stay reachable under Deleted / Archived', async () => {
    const r = await listHostPlanConsole({ view: 'deleted' });
    expect(r.hosts).toHaveLength(12);
    expect(r.hosts.every((h) => h.accountStatus === 'deleted')).toBe(true);
  });

  it('(8,9) No Room is active zero-room accounts only — never a tombstone', async () => {
    const r = await listHostPlanConsole({ view: 'no-room' });
    expect(r.hosts).toHaveLength(5);
    expect(r.hosts.every((h) => h.accountStatus === 'active' && !h.hasOwnedRoom)).toBe(true);
    // 5 deleted accounts also own no room; they must NOT appear here.
    expect(r.hosts.some((h) => h.accountStatus === 'deleted')).toBe(false);
  });

  it('(10) All still exposes every row, tombstones included', async () => {
    const r = await listHostPlanConsole({ view: 'all', limit: 100 });
    expect(r.hosts).toHaveLength(25);
    expect(r.hosts.filter((h) => h.accountStatus === 'deleted')).toHaveLength(12);
  });

  it('totals describe production regardless of the view being rendered', async () => {
    const a = await listHostPlanConsole({ view: 'deleted' });
    const b = await listHostPlanConsole({ view: 'no-room' });
    expect(a.totals).toEqual(b.totals);
    expect(a.totals.activeHosts).toBe(13);
  });

  it('the legacy anomalyOnly flag still maps onto Needs Attention', async () => {
    const r = await listHostPlanConsole({ anomalyOnly: true });
    expect(r.hosts).toHaveLength(1);
    expect(r.hosts[0].accountId).toBe(acct(13));
  });

  it('an account row with NO status normalizes to active, so it can never be hidden', async () => {
    DB.karaoke_accounts = [{ id: acct(99), created_at: '2026-07-01T00:00:00Z' }];
    DB.karaoke_account_identities = [];
    DB.karaoke_host_plan_assignments = [];
    const r = await listHostPlanConsole();
    expect(r.hosts).toHaveLength(1);
    expect(r.hosts[0].accountStatus).toBe('active');
  });
});

describe('R4-R1 — (16) still strictly read-only', () => {
  it('uses only select(); no insert/update/delete/rpc is reachable', async () => {
    const calls: string[] = [];
    vi.resetModules();
    vi.doMock('@/lib/supabase.server', () => ({
      karaokeDb: () => ({
        from(table: string) {
          calls.push(`from:${table}`);
          return {
            select: async () => ({ data: DB[table] ?? [], error: null }),
            insert: () => { throw new Error('write attempted'); },
            update: () => { throw new Error('write attempted'); },
            delete: () => { throw new Error('write attempted'); },
            upsert: () => { throw new Error('write attempted'); },
          };
        },
        rpc: () => { throw new Error('rpc attempted'); },
      }),
    }));
    const { listHostPlanConsole: fresh } = await import('./host-plan-console.server');
    await fresh({ view: 'all' });
    expect(calls.length).toBeGreaterThan(0);
    vi.doUnmock('@/lib/supabase.server');
    vi.resetModules();
  });
});
