// Manager Plan Console + Audit Read View V1 — the READ-ONLY service/query layer.
//
// This is the only place the console reads plan data. It performs a small, FIXED set
// of BULK queries (never one-per-account) and assembles the operational view on the
// server, so it scales to hundreds of accounts without client-side joins and never
// hands the browser a service-role credential. It is strictly read-only: it issues no
// insert/update/delete, calls no RPC, and mutates nothing.
//
// Current plan + capabilities always come from `entitlementsFromActiveAssignment`
// (the single entitlement authority) — the console never re-derives plan rules. It
// additionally exposes the PERSISTED assignment integrity separately, so a FREE
// fallback (no persisted active row) is never shown as a genuine persisted FREE.

import { karaokeDb } from './supabase.server';
import { entitlementsFromActiveAssignment } from './host-plan.server';
import type { PlanCode, PlanSource, Capabilities } from '@/domain/host-plan';
import {
  providerSummary,
  detectAnomalies,
  actionableAnomalies,
  normalizeAccountStatus,
  maskId,
  maskIdempotencyKey,
  changedByRef,
  isUnknownPlanCode,
  type ProviderSummary,
  type AnomalyFlag,
  type AccountStatus,
} from '@/domain/host-plan-console';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

interface AssignmentRow {
  id: string;
  account_id: string;
  plan_code: string;
  source: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}
interface AuditRow {
  id: string;
  account_id: string;
  previous_plan: string | null;
  new_plan: string;
  previous_assignment_id: string | null;
  new_assignment_id: string;
  source: string;
  reason: string;
  changed_by: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface OwnedRoomView {
  slug: string;
  displayName: string | null;
  brandingTheme: string | null;
  eventCount: number;
  hasActiveEvent: boolean;
}
export interface PlanView {
  code: PlanCode;
  status: 'ACTIVE';
  source: PlanSource;
  startedAt: string | null;
  fallback: boolean;
}
export interface HostPlanSummary {
  /** Full account id — used ONLY as the detail-route key; the UI never renders it. */
  accountId: string;
  /** Privacy-safe masked id for display. */
  accountRef: string;
  label: string;
  labelKind: 'room_name' | 'room_slug' | 'internal';
  representativeRoomSlug: string | null;
  ownedRoomCount: number;
  hasOwnedRoom: boolean;
  plan: PlanView; // from the entitlement authority (resolver-equivalent)
  persistedActive: { present: boolean; count: number };
  providers: ProviderSummary;
  historyCount: number;
  auditCount: number;
  /** Every observed integrity flag — the raw observation, never narrowed. */
  anomalies: AnomalyFlag[];
  /** BUILD R4-R1 — lifecycle state of the account row. Absent/unknown ⇒ 'active'. */
  accountStatus: AccountStatus;
  /** The subset of `anomalies` an operator can act on (see `actionableAnomalies`). */
  actionable: AnomalyFlag[];
  /** True iff this row genuinely wants operator attention. */
  needsAttention: boolean;
}
export interface HostPlanListResult {
  totals: {
    /** WHOLE-SET counts, unchanged since V1 so nothing that reads them shifts meaning. */
    accounts: number;
    free: number;
    pro: number;
    anomalies: number;
    /** BUILD R4-R1 — the OPERATOR-facing counts: active accounts only. */
    activeHosts: number;
    activeFree: number;
    activePro: number;
    needsAttention: number;
    noRoom: number;
    deleted: number;
  };
  page: { limit: number; offset: number; count: number; total: number };
  hosts: HostPlanSummary[];
}

export interface AssignmentHistoryView {
  planCode: string;
  status: string;
  source: string;
  startedAt: string;
  endedAt: string | null;
  current: boolean;
}
export interface AuditHistoryView {
  previousPlan: string | null;
  newPlan: string;
  source: string;
  reason: string;
  changedByRef: string;
  createdAt: string;
  linked: boolean; // both referenced assignment ids resolve within this account
  idempotencyKeyMasked: string;
}
export interface HostPlanDetail {
  accountId: string;
  accountRef: string;
  label: string;
  labelKind: 'room_name' | 'room_slug' | 'internal';
  providers: ProviderSummary;
  current: PlanView & { capabilities: Capabilities };
  persistedIntegrity: {
    activeCount: number;
    hasPersistedActive: boolean;
    duplicateActive: boolean;
    unknownPlanCodes: string[];
    auditLinkIssues: number;
  };
  rooms: OwnedRoomView[];
  assignments: AssignmentHistoryView[];
  audits: AuditHistoryView[];
  anomalies: AnomalyFlag[];
}

/**
 * BUILD R4-R1 — which slice of the whole set to return. `active` is the DEFAULT because 12 of the
 * 25 production rows are account-deletion tombstones, and an operator screen whose first job is to
 * show live Hosts should not open on a list that is half gravestones. Nothing is removed from the
 * data: every view is reachable, and `all` still returns every row.
 */
export type ConsoleView = 'active' | 'needs-attention' | 'no-room' | 'deleted' | 'all';

export interface ListParams {
  limit?: number;
  offset?: number;
  plan?: 'ALL' | 'FREE' | 'PRO';
  anomalyOnly?: boolean;
  q?: string;
  view?: ConsoleView;
}

// ---- shared bulk loaders ----------------------------------------------------

async function sel<T>(query: string): Promise<T[]> {
  const db = karaokeDb();
  const [table, cols] = query.split('|');
  const { data, error } = await db.from(table).select(cols);
  if (error) throw error;
  return (data ?? []) as T[];
}

interface AccountBundle {
  accountIds: Set<string>;
  providersByAccount: Map<string, string[]>;
  assignmentsByAccount: Map<string, AssignmentRow[]>;
  assignmentIds: Set<string>;
  auditsByAccount: Map<string, AuditRow[]>;
  roomsByAccount: Map<string, OwnedRoomView[]>;
  accountCreatedAt: Map<string, string>;
  accountStatus: Map<string, AccountStatus>;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

async function loadBundle(): Promise<AccountBundle> {
  const [accounts, identities, assignments, audits, members, ownership, rooms, events] = await Promise.all([
    sel<{ id: string; created_at: string; account_status?: string }>('karaoke_accounts|id, created_at, account_status'),
    sel<{ account_id: string; provider: string }>('karaoke_account_identities|account_id, provider'),
    sel<AssignmentRow>('karaoke_host_plan_assignments|id, account_id, plan_code, source, status, started_at, ended_at'),
    sel<AuditRow>(
      'karaoke_host_plan_assignment_audit|id, account_id, previous_plan, new_plan, previous_assignment_id, new_assignment_id, source, reason, changed_by, idempotency_key, created_at',
    ),
    sel<{ account_id: string; workspace_id: string; status: string }>('karaoke_workspace_members|account_id, workspace_id, status'),
    sel<{ room_id: string; workspace_id: string }>('karaoke_room_ownership|room_id, workspace_id'),
    sel<{ id: string; slug: string; display_name: string | null; branding_theme: string | null }>('karaoke_rooms|id, slug, display_name, branding_theme'),
    sel<{ room_id: string; status: string }>('karaoke_events|room_id, status'),
  ]);

  const accountIds = new Set(accounts.map((a) => a.id));
  const accountCreatedAt = new Map(accounts.map((a) => [a.id, a.created_at]));
  const accountStatus = new Map(accounts.map((a) => [a.id, normalizeAccountStatus(a.account_status)]));

  const providersByAccount = new Map<string, string[]>();
  for (const [acct, rows] of groupBy(identities, (i) => i.account_id)) {
    providersByAccount.set(acct, Array.from(new Set(rows.map((r) => r.provider))));
  }

  const assignmentsByAccount = groupBy(assignments, (a) => a.account_id);
  const assignmentIds = new Set(assignments.map((a) => a.id));
  const auditsByAccount = groupBy(audits, (a) => a.account_id);

  // Rooms per room_id → view (event count + active flag).
  const eventsByRoom = groupBy(events, (e) => e.room_id);
  const roomView = new Map<string, OwnedRoomView>();
  for (const r of rooms) {
    const evs = eventsByRoom.get(r.id) ?? [];
    roomView.set(r.id, {
      slug: r.slug,
      displayName: r.display_name,
      brandingTheme: r.branding_theme,
      eventCount: evs.length,
      hasActiveEvent: evs.some((e) => e.status === 'active'),
    });
  }
  // account → active workspaces → owned rooms.
  const roomsByWorkspace = groupBy(ownership, (o) => o.workspace_id);
  const roomsByAccount = new Map<string, OwnedRoomView[]>();
  for (const [acct, rows] of groupBy(members.filter((m) => m.status === 'active'), (m) => m.account_id)) {
    const list: OwnedRoomView[] = [];
    for (const m of rows) {
      for (const o of roomsByWorkspace.get(m.workspace_id) ?? []) {
        const rv = roomView.get(o.room_id);
        if (rv) list.push(rv);
      }
    }
    list.sort((a, b) => a.slug.localeCompare(b.slug));
    roomsByAccount.set(acct, list);
  }

  return { accountIds, providersByAccount, assignmentsByAccount, assignmentIds, auditsByAccount, roomsByAccount, accountCreatedAt, accountStatus };
}

// ---- per-account assembly ---------------------------------------------------

function labelFor(rooms: OwnedRoomView[], accountId: string): { label: string; labelKind: HostPlanSummary['labelKind']; slug: string | null } {
  const named = rooms.find((r) => r.displayName && r.displayName.trim().length > 0);
  if (named) return { label: named.displayName!.trim(), labelKind: 'room_name', slug: named.slug };
  if (rooms[0]) return { label: rooms[0].slug, labelKind: 'room_slug', slug: rooms[0].slug };
  return { label: `Host ${maskId(accountId)}`, labelKind: 'internal', slug: null };
}

function auditLinkIssues(audits: AuditRow[], assignmentIds: Set<string>): number {
  let n = 0;
  for (const a of audits) {
    if (a.previous_assignment_id && !assignmentIds.has(a.previous_assignment_id)) n++;
    else if (!assignmentIds.has(a.new_assignment_id)) n++;
  }
  return n;
}

function summarize(accountId: string, b: AccountBundle): HostPlanSummary {
  const assignments = b.assignmentsByAccount.get(accountId) ?? [];
  const audits = b.auditsByAccount.get(accountId) ?? [];
  const rooms = b.roomsByAccount.get(accountId) ?? [];
  const active = assignments.filter((a) => a.status === 'active');
  const activeRow = active[0] ?? null;
  const ent = entitlementsFromActiveAssignment(activeRow);
  const { label, labelKind, slug } = labelFor(rooms, accountId);

  const anomalies = detectAnomalies({
    accountExists: b.accountIds.has(accountId),
    activePlanCodes: active.map((a) => a.plan_code),
    allPlanCodes: assignments.map((a) => a.plan_code),
    auditLinkIssues: auditLinkIssues(audits, b.assignmentIds),
  });
  // An id seen only on an assignment/audit has no account row and therefore no status. It stays
  // 'active' so its orphan anomaly remains visible rather than being filed away under Deleted.
  const accountStatus = b.accountStatus.get(accountId) ?? 'active';
  const actionable = actionableAnomalies(accountStatus, anomalies);

  return {
    accountId,
    accountRef: maskId(accountId),
    label,
    labelKind,
    representativeRoomSlug: slug,
    ownedRoomCount: rooms.length,
    hasOwnedRoom: rooms.length > 0,
    plan: { code: ent.planCode, status: ent.planStatus, source: ent.source, startedAt: activeRow?.started_at ?? null, fallback: ent.fallback },
    persistedActive: { present: active.length > 0, count: active.length },
    providers: providerSummary(b.providersByAccount.get(accountId) ?? []),
    historyCount: assignments.length,
    auditCount: audits.length,
    anomalies,
    accountStatus,
    actionable,
    needsAttention: actionable.length > 0,
  };
}

// ---- public API -------------------------------------------------------------

export async function listHostPlanConsole(params: ListParams = {}): Promise<HostPlanListResult> {
  const b = await loadBundle();

  // Every canonical account, plus any account_id that appears on an assignment/audit
  // but has NO account row (orphan → surfaced as an anomaly, never hidden).
  const allAccountIds = new Set<string>(b.accountIds);
  for (const acct of b.assignmentsByAccount.keys()) allAccountIds.add(acct);
  for (const acct of b.auditsByAccount.keys()) allAccountIds.add(acct);

  let all = Array.from(allAccountIds).map((id) => summarize(id, b));
  // Stable deterministic order: labelled Hosts first (by label), internal/orphan last.
  all.sort((a, b2) => {
    if (a.hasOwnedRoom !== b2.hasOwnedRoom) return a.hasOwnedRoom ? -1 : 1;
    return a.label.localeCompare(b2.label);
  });

  // Totals are computed over the WHOLE set, before any view/plan/search filter, so the summary
  // always describes production rather than the current filter.
  const activeRows = all.filter((h) => h.accountStatus === 'active');
  const totals = {
    accounts: all.length,
    free: all.filter((h) => h.plan.code === 'FREE').length,
    pro: all.filter((h) => h.plan.code === 'PRO').length,
    anomalies: all.filter((h) => h.anomalies.length > 0).length,
    activeHosts: activeRows.length,
    activeFree: activeRows.filter((h) => h.plan.code === 'FREE').length,
    activePro: activeRows.filter((h) => h.plan.code === 'PRO').length,
    // Scoped to ACTIVE accounts: a tombstone with a residual integrity flag is history, not a task.
    needsAttention: activeRows.filter((h) => h.needsAttention).length,
    noRoom: activeRows.filter((h) => !h.hasOwnedRoom).length,
    deleted: all.filter((h) => h.accountStatus === 'deleted').length,
  };

  // Filters (server-side).
  const view: ConsoleView = params.view ?? (params.anomalyOnly ? 'needs-attention' : 'active');
  if (view === 'active') all = all.filter((h) => h.accountStatus === 'active');
  else if (view === 'deleted') all = all.filter((h) => h.accountStatus === 'deleted');
  else if (view === 'needs-attention') all = all.filter((h) => h.accountStatus === 'active' && h.needsAttention);
  else if (view === 'no-room') all = all.filter((h) => h.accountStatus === 'active' && !h.hasOwnedRoom);
  // 'all' keeps every row, tombstones included — nothing is ever unreachable.

  const plan = params.plan ?? 'ALL';
  if (plan !== 'ALL') all = all.filter((h) => h.plan.code === plan);
  const q = params.q?.trim().toLowerCase();
  if (q) {
    all = all.filter(
      (h) => h.label.toLowerCase().includes(q) || (h.representativeRoomSlug?.toLowerCase().includes(q) ?? false),
    );
  }

  const total = all.length;
  const limit = Math.min(Math.max(1, params.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, params.offset ?? 0);
  const hosts = all.slice(offset, offset + limit);

  return { totals, page: { limit, offset, count: hosts.length, total }, hosts };
}

export async function getHostPlanConsoleDetail(accountId: string): Promise<HostPlanDetail | null> {
  const b = await loadBundle();
  const known = b.accountIds.has(accountId) || b.assignmentsByAccount.has(accountId) || b.auditsByAccount.has(accountId);
  if (!known) return null;

  const assignments = (b.assignmentsByAccount.get(accountId) ?? [])
    .slice()
    .sort((a, c) => a.started_at.localeCompare(c.started_at));
  const audits = (b.auditsByAccount.get(accountId) ?? [])
    .slice()
    .sort((a, c) => a.created_at.localeCompare(c.created_at));
  const rooms = b.roomsByAccount.get(accountId) ?? [];
  const active = assignments.filter((a) => a.status === 'active');
  const activeRow = active[0] ?? null;
  const ent = entitlementsFromActiveAssignment(activeRow);
  const { label, labelKind } = labelFor(rooms, accountId);
  const linkIssues = auditLinkIssues(audits, b.assignmentIds);

  const anomalies = detectAnomalies({
    accountExists: b.accountIds.has(accountId),
    activePlanCodes: active.map((a) => a.plan_code),
    allPlanCodes: assignments.map((a) => a.plan_code),
    auditLinkIssues: linkIssues,
  });

  return {
    accountId,
    accountRef: maskId(accountId),
    label,
    labelKind,
    providers: providerSummary(b.providersByAccount.get(accountId) ?? []),
    current: {
      code: ent.planCode,
      status: ent.planStatus,
      source: ent.source,
      startedAt: activeRow?.started_at ?? null,
      fallback: ent.fallback,
      capabilities: ent.capabilities,
    },
    persistedIntegrity: {
      activeCount: active.length,
      hasPersistedActive: active.length > 0,
      duplicateActive: active.length > 1,
      unknownPlanCodes: Array.from(new Set(assignments.map((a) => a.plan_code).filter(isUnknownPlanCode))),
      auditLinkIssues: linkIssues,
    },
    rooms,
    assignments: assignments.map((a) => ({
      planCode: a.plan_code,
      status: a.status,
      source: a.source,
      startedAt: a.started_at,
      endedAt: a.ended_at,
      current: a.status === 'active',
    })),
    audits: audits.map((a) => ({
      previousPlan: a.previous_plan,
      newPlan: a.new_plan,
      source: a.source,
      reason: a.reason,
      changedByRef: changedByRef(a.changed_by),
      createdAt: a.created_at,
      linked:
        (a.previous_assignment_id === null || b.assignmentIds.has(a.previous_assignment_id)) &&
        b.assignmentIds.has(a.new_assignment_id),
      idempotencyKeyMasked: maskIdempotencyKey(a.idempotency_key),
    })),
    anomalies,
  };
}
