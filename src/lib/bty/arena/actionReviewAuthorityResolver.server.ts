/**
 * Action Review Authority resolver — service loader (Slice 3.1B-3N, Phase 5A).
 *
 * The SINGLE canonical authority source for Host review of an Action Contract. It gathers
 * server facts through the trusted admin (service-role) client and delegates the decision to
 * the pure domain function {@link decideActionReviewAuthority}. UI filtering is NOT authorization:
 * every future queue inclusion and every future mutation (Approve / Request-Revision) MUST call
 * this resolver again immediately before acting, and fail closed on its deny.
 *
 * Trusted inputs ONLY: the authenticated actor user id (from the server session) and the
 * Action Contract id (the requested resource). The learner membership is DERIVED from the
 * contract owner (bty_action_contracts.user_id) — never from client input. Client-supplied
 * reviewer/learner/org/edge ids are impossible to pass and would establish no authority.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideActionReviewAuthority,
  type ActionReviewAuthorityDecision,
  type ActionReviewFacts,
  type AuthorityEdgeFact,
  type MembershipFact,
} from "@/domain/arena/actionReviewAuthority";

const MEMBERSHIP_COLS = "id, user_id, organization_id, status";
const AUTHORITY_KEY = "ACTION_REVIEWER";

/** UTC-day basis, matching Postgres current_date on a UTC-configured instance. */
function serverToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function shortId(v: string | null | undefined): string {
  return v ? String(v).slice(0, 8) : "none";
}

async function loadMemberships(admin: SupabaseClient, userId: string): Promise<MembershipFact[]> {
  const { data } = await admin
    .from("bty_org_memberships")
    .select(MEMBERSHIP_COLS)
    .eq("user_id", userId);
  return ((data ?? []) as Array<{ id: string; user_id: string | null; organization_id: string | null; status: string }>).map(
    (r) => ({ id: r.id, userId: r.user_id, organizationId: r.organization_id, status: r.status }),
  );
}

/**
 * Resolve whether `actorUserId` may review `actionContractId`. Read-only; writes nothing.
 * Returns a structured allow/deny decision. Callers translate deny → generic 403/404 for the
 * client while retaining the internal reason for diagnostics.
 */
export async function resolveActionReviewAuthority(
  admin: SupabaseClient,
  input: { actorUserId: string; actionContractId: string },
  options?: { now?: Date },
): Promise<ActionReviewAuthorityDecision> {
  const actorUserId = typeof input.actorUserId === "string" ? input.actorUserId.trim() : "";
  const actionContractId = typeof input.actionContractId === "string" ? input.actionContractId.trim() : "";
  const today = serverToday(options?.now ?? new Date());

  // 1. Contract (derive learner from its canonical owner user_id).
  let contract: ActionReviewFacts["contract"] = null;
  if (actionContractId) {
    const { data } = await admin
      .from("bty_action_contracts")
      .select("id, user_id, verification_mode")
      .eq("id", actionContractId)
      .maybeSingle<{ id: string; user_id: string | null; verification_mode: string | null }>();
    if (data) {
      contract = { id: data.id, ownerUserId: data.user_id, verificationMode: data.verification_mode };
    }
  }

  // 2. Actor + learner memberships (bounded, by user_id — no broad org scans).
  const actorMemberships = actorUserId ? await loadMemberships(admin, actorUserId) : [];
  const learnerUserId = contract?.ownerUserId ?? null;
  const learnerMemberships = learnerUserId ? await loadMemberships(admin, learnerUserId) : [];

  // 3. Edges among the actor↔learner membership id space, correct key, any status.
  let edges: AuthorityEdgeFact[] = [];
  const actorMembershipIds = actorMemberships.map((m) => m.id);
  const learnerMembershipIds = learnerMemberships.map((m) => m.id);
  if (actorMembershipIds.length > 0 && learnerMembershipIds.length > 0) {
    const { data } = await admin
      .from("bty_org_action_review_authority")
      .select("id, reviewer_membership_id, learner_membership_id, organization_id, authority_key, status, revoked_at, started_on")
      .eq("authority_key", AUTHORITY_KEY)
      .in("reviewer_membership_id", actorMembershipIds)
      .in("learner_membership_id", learnerMembershipIds);
    edges = ((data ?? []) as Array<{
      id: string;
      reviewer_membership_id: string;
      learner_membership_id: string;
      organization_id: string | null;
      authority_key: string;
      status: string;
      revoked_at: string | null;
      started_on: string;
    }>).map((r) => ({
      id: r.id,
      reviewerMembershipId: r.reviewer_membership_id,
      learnerMembershipId: r.learner_membership_id,
      organizationId: r.organization_id,
      authorityKey: r.authority_key,
      status: r.status,
      revokedAt: r.revoked_at,
      startedOn: r.started_on,
    }));
  }

  const decision = decideActionReviewAuthority({
    actorUserId: actorUserId || null,
    actionContractId,
    contract,
    actorMemberships,
    learnerMemberships,
    edges,
    today,
  });

  // Privacy-clean structured log: shortened ids + internal reason only. No evidence/email/token.
  console.log("[action_review_authority]", {
    actor: shortId(actorUserId),
    contract: shortId(actionContractId),
    allowed: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
    authorityId: decision.allowed ? shortId(decision.authorityId) : null,
  });

  return decision;
}
