// Manager Plan Console V1 — the READ-ONLY service proved behaviourally against a fake
// Postgres seeded to mirror production (3 accounts: Apple+Google owner of bty-home, a
// Room-less Google account, a Google owner of chi-norebang; a FREE→PRO→FREE pilot
// history + 2 audit rows). Proves: one summary per account, current plan from the
// entitlement authority, persisted-status shown separately, owned-room/provider
// accuracy, no PII, pagination/filters, detail ordering + audit linking + masking, and
// anomaly detection (duplicate-active, orphan, missing-active fallback).

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row {
  [k: string]: unknown;
}
const DB: Record<string, Row[]> = {};

// karaokeDb().from(table).select(cols) → Promise<{data, error}> (read-only).
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    from(table: string) {
      return { select: async () => ({ data: DB[table] ?? [], error: null }) };
    },
  }),
}));

import { listHostPlanConsole, getHostPlanConsoleDetail } from './host-plan-console.server';

const A = 'aaaaaaaa-0000-4000-8000-000000000001'; // Apple+Google, owns bty-home (pilot)
const B = 'bbbbbbbb-0000-4000-8000-000000000002'; // Google only, no Room
const C = 'cccccccc-0000-4000-8000-000000000003'; // Google only, owns chi-norebang
const WSA = 'wsa00000-0000-4000-8000-000000000001';
const WSC = 'wsc00000-0000-4000-8000-000000000003';
const KEY_B = 'gate-b-2026-07-22T04-15-41-100Z-86915fd0-4538-40f3-976f-eb644b452360';
const KEY_E = 'gate-e-2026-07-22T04-38-42-064Z-ce575b49-2c60-4723-b09c-8a3a57b71883';

function seed() {
  DB.karaoke_accounts = [
    { id: A, created_at: '2026-07-19T00:00:00Z' },
    { id: B, created_at: '2026-07-20T00:00:00Z' },
    { id: C, created_at: '2026-07-21T00:00:00Z' },
  ];
  DB.karaoke_account_identities = [
    { account_id: A, provider: 'apple' },
    { account_id: A, provider: 'google' },
    { account_id: B, provider: 'google' },
    { account_id: C, provider: 'google' },
  ];
  DB.karaoke_host_plan_assignments = [
    { id: 'a1', account_id: A, plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'ended', started_at: '2026-07-22T04:00:00Z', ended_at: '2026-07-22T04:15:00Z' },
    { id: 'a2', account_id: A, plan_code: 'PRO', source: 'MANUAL', status: 'ended', started_at: '2026-07-22T04:15:00Z', ended_at: '2026-07-22T04:38:00Z' },
    { id: 'a3', account_id: A, plan_code: 'FREE', source: 'MANUAL', status: 'active', started_at: '2026-07-22T04:38:00Z', ended_at: null },
    { id: 'b1', account_id: B, plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'active', started_at: '2026-07-20T00:00:00Z', ended_at: null },
    { id: 'c1', account_id: C, plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'active', started_at: '2026-07-21T00:00:00Z', ended_at: null },
  ];
  DB.karaoke_host_plan_assignment_audit = [
    { id: 'au1', account_id: A, previous_plan: 'FREE', new_plan: 'PRO', previous_assignment_id: 'a1', new_assignment_id: 'a2', source: 'MANUAL', reason: 'Commander Gate B pilot lifecycle verification', changed_by: null, idempotency_key: KEY_B, created_at: '2026-07-22T04:15:00Z' },
    { id: 'au2', account_id: A, previous_plan: 'PRO', new_plan: 'FREE', previous_assignment_id: 'a2', new_assignment_id: 'a3', source: 'MANUAL', reason: 'Commander Gate E pilot downgrade verification', changed_by: null, idempotency_key: KEY_E, created_at: '2026-07-22T04:38:00Z' },
  ];
  DB.karaoke_workspaces = [{ id: WSA }, { id: WSC }];
  DB.karaoke_workspace_members = [
    { account_id: A, workspace_id: WSA, status: 'active' },
    { account_id: C, workspace_id: WSC, status: 'active' },
  ];
  DB.karaoke_room_ownership = [
    { room_id: 'room-bty', workspace_id: WSA },
    { room_id: 'room-chi', workspace_id: WSC },
  ];
  DB.karaoke_rooms = [
    { id: 'room-bty', slug: 'bty-home', display_name: 'btyNorebang', branding_theme: 'midnight_gold' },
    { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', display_name: 'Chi Family Norebang', branding_theme: 'warm_stage' },
    { id: 'room-ghost', slug: 'ghost', display_name: null, branding_theme: null }, // unowned; must not attach
  ];
  DB.karaoke_events = [
    ...Array.from({ length: 7 }, (_, i) => ({ room_id: 'room-bty', status: 'ended', _i: i })),
    { room_id: 'room-bty', status: 'active' },
  ];
}

beforeEach(seed);

describe('listHostPlanConsole', () => {
  it('(6) returns exactly one summary per canonical account', async () => {
    const r = await listHostPlanConsole();
    expect(r.hosts).toHaveLength(3);
    expect(r.totals.accounts).toBe(3);
  });

  it('(7/8) current plan matches the entitlement authority; persisted status is separate', async () => {
    const r = await listHostPlanConsole();
    const a = r.hosts.find((h) => h.accountId === A)!;
    expect(a.plan.code).toBe('FREE'); // resolver-equivalent from the active row
    expect(a.plan.source).toBe('MANUAL');
    expect(a.plan.fallback).toBe(false);
    expect(a.persistedActive).toEqual({ present: true, count: 1 });
  });

  it('(9/10) owned-room count and provider summary are accurate; label uses the Room name (never the person name)', async () => {
    const r = await listHostPlanConsole();
    const a = r.hosts.find((h) => h.accountId === A)!;
    const b = r.hosts.find((h) => h.accountId === B)!;
    const c = r.hosts.find((h) => h.accountId === C)!;
    expect([a.ownedRoomCount, b.ownedRoomCount, c.ownedRoomCount]).toEqual([1, 0, 1]);
    expect(a.providers).toBe('apple+google');
    expect(b.providers).toBe('google');
    expect(a.label).toBe('btyNorebang');
    expect(a.labelKind).toBe('room_name');
    expect(b.labelKind).toBe('internal'); // Room-less → privacy-safe internal label
    expect(b.hasOwnedRoom).toBe(false);
  });

  it('(1/2) totals match the baseline: 3 accounts, 3 FREE, 0 PRO, 0 anomalies', async () => {
    const r = await listHostPlanConsole();
    expect(r.totals).toEqual({ accounts: 3, free: 3, pro: 0, anomalies: 0 });
  });

  it('(11/12) summaries carry no email / provider subject / credential', async () => {
    const r = await listHostPlanConsole();
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/email|provider_subject|subject|token|bearer|@/i);
  });

  it('(3/4) pilot history + audit counts are exposed', async () => {
    const a = (await listHostPlanConsole()).hosts.find((h) => h.accountId === A)!;
    expect(a.historyCount).toBe(3);
    expect(a.auditCount).toBe(2);
  });

  it('(13) pagination/limit is applied', async () => {
    const r = await listHostPlanConsole({ limit: 2, offset: 0 });
    expect(r.hosts).toHaveLength(2);
    expect(r.page).toMatchObject({ limit: 2, offset: 0, count: 2, total: 3 });
  });

  it('(14/15/16) FREE / PRO / anomaly filters work (totals stay whole-set)', async () => {
    expect((await listHostPlanConsole({ plan: 'FREE' })).hosts).toHaveLength(3);
    expect((await listHostPlanConsole({ plan: 'PRO' })).hosts).toHaveLength(0);
    const anom = await listHostPlanConsole({ anomalyOnly: true });
    expect(anom.hosts).toHaveLength(0);
    expect(anom.totals.accounts).toBe(3); // summary counts reflect the full set
  });

  it('(17) search matches Room name and slug', async () => {
    expect((await listHostPlanConsole({ q: 'chi' })).hosts.map((h) => h.accountId)).toEqual([C]);
    expect((await listHostPlanConsole({ q: 'bty-home' })).hosts.map((h) => h.accountId)).toEqual([A]);
  });
});

describe('getHostPlanConsoleDetail', () => {
  it('(18/19) assignment history is started_at asc and audit history is created_at asc', async () => {
    const d = (await getHostPlanConsoleDetail(A))!;
    expect(d.assignments.map((a) => `${a.status} ${a.source} ${a.planCode}`)).toEqual([
      'ended SYSTEM_DEFAULT FREE',
      'ended MANUAL PRO',
      'active MANUAL FREE',
    ]);
    expect(d.audits.map((a) => `${a.previousPlan}->${a.newPlan}`)).toEqual(['FREE->PRO', 'PRO->FREE']);
  });

  it('(20/21) audits link to real assignments and mask the idempotency key', async () => {
    const d = (await getHostPlanConsoleDetail(A))!;
    expect(d.audits.every((a) => a.linked)).toBe(true);
    expect(d.audits[0].idempotencyKeyMasked).toContain('…');
    expect(d.audits[0].idempotencyKeyMasked).not.toBe(KEY_B);
    expect(d.audits[0].reason).toBe('Commander Gate B pilot lifecycle verification');
    expect(d.audits[0].changedByRef).toBe('system'); // null actor
  });

  it('(22) capabilities equal the resolver capabilities (all true in V1)', async () => {
    const d = (await getHostPlanConsoleDetail(A))!;
    expect(Object.values(d.current.capabilities).every(Boolean)).toBe(true);
  });

  it('owned rooms carry event count + active flag; unowned rooms never attach', async () => {
    const d = (await getHostPlanConsoleDetail(A))!;
    expect(d.rooms).toHaveLength(1);
    expect(d.rooms[0]).toMatchObject({ slug: 'bty-home', eventCount: 8, hasActiveEvent: true });
    const dc = (await getHostPlanConsoleDetail(C))!;
    expect(dc.rooms[0]).toMatchObject({ slug: 'chi-norebang-xqjbyszq', eventCount: 0, hasActiveEvent: false });
  });

  it('(23) a no-active-assignment account is a FREE FALLBACK, shown distinctly from a persisted FREE', async () => {
    DB.karaoke_host_plan_assignments = DB.karaoke_host_plan_assignments.filter((r) => r.account_id !== B);
    const d = (await getHostPlanConsoleDetail(B))!;
    expect(d.current.code).toBe('FREE');
    expect(d.current.fallback).toBe(true);
    expect(d.persistedIntegrity.hasPersistedActive).toBe(false);
    expect(d.anomalies).toContain('no_active_assignment');
  });

  it('(24) duplicate active assignments are detected as an anomaly', async () => {
    DB.karaoke_host_plan_assignments.push({ id: 'c2', account_id: C, plan_code: 'PRO', source: 'MANUAL', status: 'active', started_at: '2026-07-22T00:00:00Z', ended_at: null });
    const d = (await getHostPlanConsoleDetail(C))!;
    expect(d.persistedIntegrity.duplicateActive).toBe(true);
    expect(d.anomalies).toContain('multiple_active_assignments');
    const list = await listHostPlanConsole();
    expect(list.totals.anomalies).toBe(1);
  });

  it('(25) an assignment whose account does not exist surfaces as an orphan anomaly', async () => {
    const ORPHAN = 'dddddddd-0000-4000-8000-000000000009';
    DB.karaoke_host_plan_assignments.push({ id: 'x1', account_id: ORPHAN, plan_code: 'FREE', source: 'SYSTEM_DEFAULT', status: 'active', started_at: '2026-07-22T00:00:00Z', ended_at: null });
    const list = await listHostPlanConsole();
    const orphan = list.hosts.find((h) => h.accountId === ORPHAN)!;
    expect(orphan.anomalies).toContain('assignment_without_account');
    expect(list.totals.anomalies).toBeGreaterThanOrEqual(1);
  });

  it('returns null for a genuinely unknown account (no data anywhere)', async () => {
    expect(await getHostPlanConsoleDetail('eeeeeeee-0000-4000-8000-000000000000')).toBeNull();
  });
});
