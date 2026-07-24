// PRO Pilot Request + Manager Approval V1 — the service layer over
// karaoke_pro_pilot_requests. This is the ONE place the app reads/writes pilot
// requests; routes call these helpers, never the table or RPCs directly.
//
// Invariants honored here (DB-enforced):
//   * at most ONE PENDING request per account (partial unique index);
//   * a request NEVER changes a plan — only an APPROVE does, and only through the
//     EXISTING canonical plan authority (change_karaoke_host_plan), invoked inside
//     the atomic decide RPC. There is no second plan authority here.
//   * approve/decline are durably idempotent (unique decision keys), never a flag.
//
// Privacy: nothing here returns an email, provider subject, OAuth/session token, or
// billing id. Manager display labels are derived from Room names (or a masked id).

import { karaokeDb } from './supabase.server';
import { resolveNorebangHostEntitlements, entitlementsFromActiveAssignment } from './host-plan.server';
import { maskId } from '@/domain/host-plan-console';
import type { PlanCode } from '@/domain/host-plan';

export type ProPilotStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface ProPilotRequestView {
  status: ProPilotStatus;
  requestedAt: string;
  decidedAt: string | null;
}

interface RequestRow {
  id: string;
  account_id: string;
  room_id: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
  decision_reason: string | null;
}

const REQUEST_COLS =
  'id, account_id, room_id, status, requested_at, decided_at, decision_reason';

function toStatus(s: string): ProPilotStatus {
  return s === 'APPROVED' || s === 'DECLINED' ? s : 'PENDING';
}

/** The account's most recent pilot request (PENDING/APPROVED/DECLINED), or null. */
export async function getProPilotRequestForAccount(accountId: string): Promise<ProPilotRequestView | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_pro_pilot_requests')
    .select(REQUEST_COLS)
    .eq('account_id', accountId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as RequestRow | null;
  if (!row) return null;
  return { status: toStatus(row.status), requestedAt: row.requested_at, decidedAt: row.decided_at };
}

/** The Host's own view for GET /api/host/pro-pilot-request: current plan + request. */
export async function getHostProPilotState(
  accountId: string,
): Promise<{ plan: PlanCode; request: ProPilotRequestView | null }> {
  const [ent, request] = await Promise.all([
    resolveNorebangHostEntitlements(accountId),
    getProPilotRequestForAccount(accountId),
  ]);
  return { plan: ent.planCode, request };
}

export type CreateProPilotError = 'already_pro' | 'account_not_found' | 'idempotency_key_required';
export type CreateProPilotOutcome =
  | { ok: true; requestId: string; status: ProPilotStatus; reused: boolean }
  | { ok: false; error: CreateProPilotError };

/**
 * Create (or return the existing PENDING / replayed) pilot request through the atomic
 * create RPC. A PRO account is rejected; a second PENDING is never inserted. This
 * writes only the request row — it never touches a plan, Event, Room, or the queue.
 */
export async function createProPilotRequest(input: {
  accountId: string;
  roomId: string | null;
  idempotencyKey: string;
}): Promise<CreateProPilotOutcome> {
  const { data, error } = await karaokeDb().rpc('create_karaoke_pro_pilot_request', {
    p_account_id: input.accountId,
    p_room_id: input.roomId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return { ok: false, error: String(row.error ?? 'account_not_found') as CreateProPilotError };
  }
  return {
    ok: true,
    requestId: String(row.requestId),
    status: toStatus(String(row.status)),
    reused: row.reused === true,
  };
}

export type DecideProPilotError =
  | 'request_not_found'
  | 'already_decided'
  | 'invalid_decision'
  | 'idempotency_key_required'
  | 'account_not_found'
  | 'plan_change_failed';
export type DecideProPilotOutcome =
  | { ok: true; replayed: boolean; requestId: string; status: ProPilotStatus }
  | { ok: false; error: DecideProPilotError; status?: ProPilotStatus };

/**
 * Approve or decline a PENDING request through the atomic decide RPC. APPROVE moves
 * the account to PRO via the EXISTING canonical plan authority (one transaction:
 * plan change + request APPROVED + one decision-audit row). DECLINE never changes the
 * plan. Both are durably idempotent; a retried decision writes nothing new.
 */
export async function decideProPilotRequest(input: {
  requestId: string;
  decision: 'approve' | 'decline';
  reason: string | null;
  decisionIdempotencyKey: string;
  managerActor?: string;
}): Promise<DecideProPilotOutcome> {
  const { data, error } = await karaokeDb().rpc('decide_karaoke_pro_pilot_request', {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_reason: input.reason,
    p_decision_idempotency_key: input.decisionIdempotencyKey,
    p_manager_actor: input.managerActor ?? 'bty_mgr',
    p_actor_account: null,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      error: String(row.error ?? 'request_not_found') as DecideProPilotError,
      status: row.status ? toStatus(String(row.status)) : undefined,
    };
  }
  return {
    ok: true,
    replayed: row.replayed === true,
    requestId: String(row.requestId),
    status: toStatus(String(row.status)),
  };
}

// ---- Manager list (read-only, bulk) -----------------------------------------

export interface ManagerProPilotRequest {
  requestId: string;
  /** Full account id — used only as the decision key; never rendered. */
  accountId: string;
  accountRef: string; // masked, privacy-safe
  hostLabel: string; // room-name-derived (never email/subject/relay id)
  roomLabel: string | null;
  currentPlan: PlanCode;
  status: ProPilotStatus;
  requestedAt: string;
  decidedAt: string | null;
}

export interface ManagerProPilotListResult {
  totals: { total: number; pending: number; approved: number; declined: number; uniqueAccounts: number };
  requests: ManagerProPilotRequest[];
}

async function selAll<T>(table: string, cols: string): Promise<T[]> {
  const { data, error } = await karaokeDb().from(table).select(cols);
  if (error) throw error;
  return (data ?? []) as T[];
}

/**
 * The Manager's operational list. PENDING first (then newest-first), with a
 * Room-derived Host/Room label and the account's CURRENT plan from the single
 * entitlement authority. Bulk queries only — no per-request N+1.
 */
export async function listProPilotRequests(
  params: { status?: ProPilotStatus } = {},
): Promise<ManagerProPilotListResult> {
  const [requests, assignments, rooms] = await Promise.all([
    selAll<RequestRow>('karaoke_pro_pilot_requests', REQUEST_COLS),
    selAll<{ account_id: string; plan_code: string; status: string }>(
      'karaoke_host_plan_assignments',
      'account_id, plan_code, status',
    ),
    selAll<{ id: string; slug: string; display_name: string | null }>(
      'karaoke_rooms',
      'id, slug, display_name',
    ),
  ]);

  const planByAccount = new Map<string, PlanCode>();
  for (const a of assignments) {
    if (a.status === 'active') {
      planByAccount.set(
        a.account_id,
        entitlementsFromActiveAssignment({
          id: '',
          account_id: a.account_id,
          plan_code: a.plan_code,
          source: 'MANUAL',
          status: 'active',
          started_at: '',
          ended_at: null,
        }).planCode,
      );
    }
  }
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const totals = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'PENDING').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    declined: requests.filter((r) => r.status === 'DECLINED').length,
    uniqueAccounts: new Set(requests.map((r) => r.account_id)).size,
  };

  let filtered = requests;
  if (params.status) filtered = filtered.filter((r) => r.status === params.status);

  // PENDING first, then newest requested_at.
  const rank = (s: string) => (s === 'PENDING' ? 0 : 1);
  filtered.sort((a, b) => rank(a.status) - rank(b.status) || b.requested_at.localeCompare(a.requested_at));

  const list: ManagerProPilotRequest[] = filtered.map((r) => {
    const room = r.room_id ? roomById.get(r.room_id) ?? null : null;
    const roomLabel = room ? (room.display_name?.trim() || room.slug) : null;
    return {
      requestId: r.id,
      accountId: r.account_id,
      accountRef: maskId(r.account_id),
      hostLabel: roomLabel ?? `Host ${maskId(r.account_id)}`,
      roomLabel,
      currentPlan: planByAccount.get(r.account_id) ?? 'FREE',
      status: toStatus(r.status),
      requestedAt: r.requested_at,
      decidedAt: r.decided_at,
    };
  });

  return { totals, requests: list };
}
