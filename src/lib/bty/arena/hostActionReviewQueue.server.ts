/**
 * Host Action Review Queue — service loader (Slice 3.1B-3N, Phase 5B). READ-ONLY.
 *
 * Builds the reviewable queue and the read-only detail for ONE authenticated Host. Authority is
 * ALWAYS decided by the Phase 5A resolver {@link resolveActionReviewAuthority}: candidates are
 * narrowed by the actor's active edges (bounded), then EACH candidate is authoritatively
 * re-resolved — so the queue and the detail can never diverge. Appearing in the queue grants
 * nothing; a mutation phase must re-resolve again before writing.
 *
 * Privacy: explicit column allow-list, never select('*'); never selects raw_text / response_text /
 * email. Learner label = arena_profiles.display_name (the public leaderboard nickname), never a
 * real name or email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActionReviewAuthority } from "@/lib/bty/arena/actionReviewAuthorityResolver.server";
import {
  orderHostActionReviewQueue,
  type HostActionReviewDetail,
  type HostActionReviewQueueItem,
  type ReviewableMode,
} from "@/domain/arena/hostActionReviewQueue";

/** V1 hard cap on reviewable contracts (documented bound; no unbounded scan). */
export const HOST_ACTION_REVIEW_MAX = 50;

const MEMBERSHIP_COLS = "id, user_id, organization_id, status";
const CONTRACT_QUEUE_COLS =
  "id, user_id, contract_description, submitted_at, deadline_at, verification_mode, status, verified_at, created_at";
const CONTRACT_DETAIL_COLS =
  "id, user_id, who, what, how, step_when, contract_description, submitted_at, deadline_at, verification_mode, status, verified_at, created_at, action_type";

/** Human source label only — never the raw action_type / scenario / pattern (5C.3). */
function sourceLabel(actionType: string | null, locale: string): string | null {
  if (actionType === "field_action") return locale === "ko" ? "현실 적용" : "Real-world application";
  return null;
}

function statusLabel(locale: string): string {
  return locale === "ko" ? "검토를 기다리는 중" : "Awaiting your review";
}
function isActiveBound(m: { status: string; user_id: string | null }): boolean {
  return m.status === "active" && !!m.user_id;
}

/** Safe public nicknames for a set of learner user ids (arena_profiles.display_name → sub_name). */
async function learnerLabels(
  admin: SupabaseClient,
  userIds: string[],
  locale: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const fallback = locale === "ko" ? "학습자" : "Learner";
  const { data } = await admin
    .from("arena_profiles")
    .select("user_id, display_name, sub_name")
    .in("user_id", userIds);
  for (const p of (data ?? []) as Array<{ user_id: string; display_name: string | null; sub_name: string | null }>) {
    const label = (p.display_name ?? "").trim() || (p.sub_name ?? "").trim() || fallback;
    out.set(p.user_id, label);
  }
  for (const u of userIds) if (!out.has(u)) out.set(u, fallback);
  return out;
}

/** Narrow to the submitted hybrid/link contract candidates owned by learners the actor has edges to. */
async function candidateContractIds(
  admin: SupabaseClient,
  actorUserId: string,
): Promise<{ ownerUserIds: string[]; truncated: boolean }> {
  // actor active memberships
  const { data: actorMems } = await admin
    .from("bty_org_memberships")
    .select(MEMBERSHIP_COLS)
    .eq("user_id", actorUserId);
  const actorActiveIds = ((actorMems ?? []) as Array<{ id: string; user_id: string | null; status: string }>)
    .filter(isActiveBound)
    .map((m) => m.id);
  if (actorActiveIds.length === 0) return { ownerUserIds: [], truncated: false };

  // active edges reachable from the actor
  const { data: edges } = await admin
    .from("bty_org_action_review_authority")
    .select("learner_membership_id")
    .eq("authority_key", "ACTION_REVIEWER")
    .eq("status", "active")
    .is("revoked_at", null)
    .in("reviewer_membership_id", actorActiveIds);
  const learnerMembershipIds = [
    ...new Set(((edges ?? []) as Array<{ learner_membership_id: string }>).map((e) => e.learner_membership_id)),
  ];
  if (learnerMembershipIds.length === 0) return { ownerUserIds: [], truncated: false };

  // learner memberships -> owner user ids
  const { data: learnerMems } = await admin
    .from("bty_org_memberships")
    .select(MEMBERSHIP_COLS)
    .in("id", learnerMembershipIds);
  const ownerUserIds = [
    ...new Set(
      ((learnerMems ?? []) as Array<{ user_id: string | null; status: string }>)
        .filter(isActiveBound)
        .map((m) => m.user_id as string),
    ),
  ];
  return { ownerUserIds, truncated: false };
}

/**
 * The authenticated Host's reviewable queue. Empty for a non-Host / no-edge / no-candidate actor.
 * Never throws into the caller's surface intent — returns [] on read failure is the caller's choice;
 * here we surface real failures so a caller can fail-soft explicitly.
 */
export async function listHostActionReviewQueue(
  admin: SupabaseClient,
  actorUserId: string,
  locale: string,
  options?: { now?: Date },
): Promise<HostActionReviewQueueItem[]> {
  const actor = typeof actorUserId === "string" ? actorUserId.trim() : "";
  if (!actor) return [];
  const now = options?.now ?? new Date();

  const { ownerUserIds } = await candidateContractIds(admin, actor);
  if (ownerUserIds.length === 0) return [];

  // Bounded candidate load: submitted, remotely-reviewable, not yet verified, owned by reachable
  // learners. `verified_at IS NULL` + status/mode are the source of truth (NOT verification_status).
  const { data: rows } = await admin
    .from("bty_action_contracts")
    .select(CONTRACT_QUEUE_COLS)
    .eq("status", "submitted")
    .is("verified_at", null)
    .in("verification_mode", ["hybrid", "link"])
    .in("user_id", ownerUserIds)
    .limit(HOST_ACTION_REVIEW_MAX + 1);

  const candidates = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    contract_description: string | null;
    submitted_at: string | null;
    deadline_at: string | null;
    verification_mode: string | null;
    created_at: string | null;
  }>;
  if (candidates.length > HOST_ACTION_REVIEW_MAX) {
    console.warn("[host_action_review_queue] candidate cap hit", {
      actor: actor.slice(0, 8),
      cap: HOST_ACTION_REVIEW_MAX,
      seen: candidates.length,
    });
  }

  // Authoritative per-candidate resolve (bounded by the cap) — identical logic to the detail route.
  const allowed: Array<{ c: (typeof candidates)[number] }> = [];
  for (const c of candidates.slice(0, HOST_ACTION_REVIEW_MAX)) {
    const decision = await resolveActionReviewAuthority(admin, { actorUserId: actor, actionContractId: c.id }, { now });
    if (decision.allowed) allowed.push({ c });
  }
  if (allowed.length === 0) return [];

  const labels = await learnerLabels(admin, [...new Set(allowed.map((a) => a.c.user_id))], locale);
  const sorted = orderHostActionReviewQueue(
    allowed.map((a) => ({ actionContractId: a.c.id, submittedAt: a.c.submitted_at, createdAt: a.c.created_at })),
  );
  const byId = new Map(allowed.map((a) => [a.c.id, a.c]));
  return sorted.map((s): HostActionReviewQueueItem => {
    const c = byId.get(s.actionContractId)!;
    return {
      actionContractId: c.id,
      learnerLabel: labels.get(c.user_id) ?? (locale === "ko" ? "학습자" : "Learner"),
      actionSummary: (c.contract_description ?? "").trim(),
      submittedAt: c.submitted_at ?? null,
      originalDeadline: c.deadline_at ?? null,
      verificationMode: c.verification_mode as ReviewableMode,
      statusLabel: statusLabel(locale),
    };
  });
}

/**
 * Field Action review STAGE COUNTS for one authenticated Host (Slice 3.1B-3N-5D.1). READ-ONLY.
 *
 * Operational counts scoped by the SAME canonical authority path as the queue — the actor's active
 * ACTION_REVIEWER edges → reachable learner owner ids (via {@link candidateContractIds}). Counts
 * DISTINCT `field_action` contract ids per lifecycle stage; `action_type` is filtered explicitly so
 * `arena_run_completion` contracts can never be counted. These are responsibility-scoped operational
 * counts (a reviewer seeing their own assigned items' stages), NOT anonymous organizational analytics
 * — so they render honestly even below cohort size 5. Pure read: no write, no Arena/AIR/XP effect.
 */
export type HostActionReviewStageCounts = {
  /** status='submitted' AND verified_at IS NULL — awaiting the reviewer's decision. */
  verificationPending: number;
  /** status='rejected' — a revision was requested. */
  needsRevision: number;
  /** status='approved' — the action plan was reviewed & accepted. */
  reviewedAccepted: number;
  /** status='escalated' — awaiting resolution. */
  awaitingResolution: number;
};

export async function getHostActionReviewStageCounts(
  admin: SupabaseClient,
  actorUserId: string,
): Promise<HostActionReviewStageCounts> {
  const empty: HostActionReviewStageCounts = {
    verificationPending: 0,
    needsRevision: 0,
    reviewedAccepted: 0,
    awaitingResolution: 0,
  };
  const actor = typeof actorUserId === "string" ? actorUserId.trim() : "";
  if (!actor) return empty;

  const { ownerUserIds } = await candidateContractIds(admin, actor);
  if (ownerUserIds.length === 0) return empty;

  // Explicit action_type filter → Arena actions are never counted. Only the stage columns.
  const { data: rows } = await admin
    .from("bty_action_contracts")
    .select("id, status, verified_at")
    .eq("action_type", "field_action")
    .in("user_id", ownerUserIds)
    .returns<{ id: string; status: string | null; verified_at: string | null }[]>();

  // DISTINCT contract ids; each id lands in at most ONE bucket (buckets are disjoint by status).
  const seen = new Set<string>();
  const counts = { ...empty };
  for (const r of rows ?? []) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.status === "submitted" && r.verified_at == null) counts.verificationPending += 1;
    else if (r.status === "rejected") counts.needsRevision += 1;
    else if (r.status === "approved") counts.reviewedAccepted += 1;
    else if (r.status === "escalated") counts.awaitingResolution += 1;
  }
  return counts;
}

/**
 * Read-only detail for ONE contract. Re-runs the authority resolver on THIS request — a contract's
 * prior queue presence is not proof of current authority. Returns null on any deny (the route maps
 * null to a generic not-found-equivalent so existence is never leaked).
 */
export async function getHostActionReviewDetail(
  admin: SupabaseClient,
  actorUserId: string,
  actionContractId: string,
  locale: string,
  options?: { now?: Date },
): Promise<HostActionReviewDetail | null> {
  const actor = typeof actorUserId === "string" ? actorUserId.trim() : "";
  const contractId = typeof actionContractId === "string" ? actionContractId.trim() : "";
  if (!actor || !contractId) return null;
  const now = options?.now ?? new Date();

  const decision = await resolveActionReviewAuthority(admin, { actorUserId: actor, actionContractId: contractId }, { now });
  if (!decision.allowed) return null;

  const { data: row } = await admin
    .from("bty_action_contracts")
    .select(CONTRACT_DETAIL_COLS)
    .eq("id", contractId)
    .maybeSingle<{
      id: string;
      user_id: string;
      who: string | null;
      what: string | null;
      how: string | null;
      step_when: string | null;
      contract_description: string | null;
      submitted_at: string | null;
      deadline_at: string | null;
      verification_mode: string | null;
      action_type: string | null;
    }>();
  if (!row) return null;

  const labels = await learnerLabels(admin, [row.user_id], locale);
  return {
    actionContractId: row.id,
    learnerLabel: labels.get(row.user_id) ?? (locale === "ko" ? "학습자" : "Learner"),
    actionSummary: (row.contract_description ?? "").trim(),
    submittedAt: row.submitted_at ?? null,
    originalDeadline: row.deadline_at ?? null,
    verificationMode: decision.verificationMode,
    statusLabel: statusLabel(locale),
    who: row.who ?? null,
    what: row.what ?? null,
    how: row.how ?? null,
    stepWhen: row.step_when ?? null,
    sourceLabel: sourceLabel(row.action_type ?? null, locale),
  };
}
