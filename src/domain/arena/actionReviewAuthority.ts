/**
 * Action Review Authority — pure decision (Slice 3.1B-3N, Phase 5A).
 *
 * Answers "may the authenticated actor review THIS Action Contract?" from already-loaded
 * server facts. NO I/O here — the service loader (actionReviewAuthorityResolver.server.ts)
 * gathers facts via the trusted admin client and calls this.
 *
 * INVARIANTS (default-deny; explicit edge only):
 *   - authority comes ONLY from an active, effective, one-hop ACTION_REVIEWER edge
 *     reviewer_membership -> learner_membership, same organization, non-self.
 *   - the learner membership is derived from the contract owner (contract.user_id),
 *     NEVER from client input.
 *   - same organization / role title / responsibility / admin status / content authorship
 *     grant NOTHING without an explicit edge.
 *   - fail closed: multiple effective edges => AMBIGUOUS_AUTHORITY (never "any match").
 */

import type { BtyActionContractVerificationMode } from "@/domain/action-contract";

/** Verification modes a Host may review remotely (qr stays QR-witness-only). */
export const ACTION_REVIEW_REVIEWABLE_MODES: ReadonlyArray<BtyActionContractVerificationMode> = [
  "hybrid",
  "link",
];

export type ReviewableVerificationMode = "hybrid" | "link";

export type ActionReviewAuthorityDenyReason =
  | "ACTOR_MISSING"
  | "CONTRACT_NOT_FOUND"
  | "LEARNER_MEMBERSHIP_MISSING"
  | "LEARNER_MEMBERSHIP_INACTIVE"
  | "LEARNER_MEMBERSHIP_UNBOUND"
  | "VERIFICATION_MODE_NOT_REVIEWABLE"
  | "REVIEWER_MEMBERSHIP_MISSING"
  | "REVIEWER_MEMBERSHIP_INACTIVE"
  | "REVIEWER_MEMBERSHIP_UNBOUND"
  | "AUTHORITY_EDGE_MISSING"
  | "AUTHORITY_EDGE_REVOKED_OR_INEFFECTIVE"
  | "ORGANIZATION_MISMATCH"
  | "SELF_REVIEW_FORBIDDEN"
  | "AMBIGUOUS_AUTHORITY";

export type ActionReviewAuthorityDecision =
  | {
      allowed: true;
      actorUserId: string;
      actionContractId: string;
      authorityId: string;
      reviewerMembershipId: string;
      learnerMembershipId: string;
      organizationId: string;
      verificationMode: ReviewableVerificationMode;
    }
  | { allowed: false; reason: ActionReviewAuthorityDenyReason };

export type MembershipFact = {
  id: string;
  userId: string | null;
  organizationId: string | null;
  status: string;
};

export type AuthorityEdgeFact = {
  id: string;
  reviewerMembershipId: string;
  learnerMembershipId: string;
  organizationId: string | null;
  authorityKey: string;
  status: string;
  revokedAt: string | null;
  startedOn: string; // YYYY-MM-DD
};

export type ActionReviewFacts = {
  actorUserId: string | null;
  actionContractId: string;
  /** Loaded contract, or null if not found. ownerUserId derives the learner membership. */
  contract: { id: string; ownerUserId: string | null; verificationMode: string | null } | null;
  /** ALL memberships (any status) of the actor. */
  actorMemberships: MembershipFact[];
  /** ALL memberships (any status) of the contract owner (learner). */
  learnerMemberships: MembershipFact[];
  /** ACTION_REVIEWER edges (any status) among the actor↔learner membership id space. */
  edges: AuthorityEdgeFact[];
  /** Server "today" (YYYY-MM-DD, UTC-day basis) for the started_on effectiveness test. */
  today: string;
};

const AUTHORITY_KEY = "ACTION_REVIEWER";

function isReviewableMode(mode: string | null): mode is ReviewableVerificationMode {
  return mode === "hybrid" || mode === "link";
}

const isActiveBound = (m: MembershipFact): boolean => m.status === "active" && !!m.userId;

/** Membership-set diagnosis so deny reasons are specific + deterministic. */
function classifyMemberships(
  memberships: MembershipFact[],
  missing: ActionReviewAuthorityDenyReason,
  inactive: ActionReviewAuthorityDenyReason,
  unbound: ActionReviewAuthorityDenyReason,
): { ok: true; active: MembershipFact[] } | { ok: false; reason: ActionReviewAuthorityDenyReason } {
  if (memberships.length === 0) return { ok: false, reason: missing };
  const activeStatus = memberships.filter((m) => m.status === "active");
  if (activeStatus.length === 0) return { ok: false, reason: inactive };
  const activeBound = activeStatus.filter((m) => !!m.userId);
  if (activeBound.length === 0) return { ok: false, reason: unbound };
  return { ok: true, active: activeBound };
}

export function decideActionReviewAuthority(facts: ActionReviewFacts): ActionReviewAuthorityDecision {
  // 1. actor
  if (!facts.actorUserId) return { allowed: false, reason: "ACTOR_MISSING" };

  // 2. contract
  if (!facts.contract) return { allowed: false, reason: "CONTRACT_NOT_FOUND" };
  const learnerUserId = facts.contract.ownerUserId;
  if (!learnerUserId) return { allowed: false, reason: "LEARNER_MEMBERSHIP_MISSING" };

  // 3. self-review (reviewer user must differ from learner user)
  if (facts.actorUserId === learnerUserId) return { allowed: false, reason: "SELF_REVIEW_FORBIDDEN" };

  // 4. verification mode must be remotely reviewable
  if (!isReviewableMode(facts.contract.verificationMode)) {
    return { allowed: false, reason: "VERIFICATION_MODE_NOT_REVIEWABLE" };
  }
  const verificationMode = facts.contract.verificationMode;

  // 5. reviewer + learner active-bound membership sets
  const reviewer = classifyMemberships(
    facts.actorMemberships,
    "REVIEWER_MEMBERSHIP_MISSING",
    "REVIEWER_MEMBERSHIP_INACTIVE",
    "REVIEWER_MEMBERSHIP_UNBOUND",
  );
  if (!reviewer.ok) return { allowed: false, reason: reviewer.reason };
  const learner = classifyMemberships(
    facts.learnerMemberships,
    "LEARNER_MEMBERSHIP_MISSING",
    "LEARNER_MEMBERSHIP_INACTIVE",
    "LEARNER_MEMBERSHIP_UNBOUND",
  );
  if (!learner.ok) return { allowed: false, reason: learner.reason };

  const reviewerById = new Map(reviewer.active.map((m) => [m.id, m]));
  const learnerById = new Map(learner.active.map((m) => [m.id, m]));

  // 6. edges whose BOTH endpoints are active-bound actor/learner memberships + correct key
  const edgesForActivePairs = facts.edges.filter(
    (e) =>
      e.authorityKey === AUTHORITY_KEY &&
      reviewerById.has(e.reviewerMembershipId) &&
      learnerById.has(e.learnerMembershipId),
  );

  // 7. effective = active + not revoked + started_on <= today + org-consistent
  const orgConsistent = (e: AuthorityEdgeFact): boolean => {
    const rm = reviewerById.get(e.reviewerMembershipId);
    const lm = learnerById.get(e.learnerMembershipId);
    return (
      !!rm &&
      !!lm &&
      rm.organizationId != null &&
      rm.organizationId === lm.organizationId &&
      e.organizationId === rm.organizationId
    );
  };
  const isEffective = (e: AuthorityEdgeFact): boolean =>
    e.status === "active" && e.revokedAt == null && e.startedOn <= facts.today && orgConsistent(e);

  const effective = edgesForActivePairs.filter(isEffective);

  // 8. decide
  if (effective.length === 0) {
    // An active, non-revoked, in-window edge that fails ONLY the org check -> ORGANIZATION_MISMATCH.
    const activeInWindow = edgesForActivePairs.filter(
      (e) => e.status === "active" && e.revokedAt == null && e.startedOn <= facts.today,
    );
    if (activeInWindow.some((e) => !orgConsistent(e))) {
      return { allowed: false, reason: "ORGANIZATION_MISMATCH" };
    }
    if (edgesForActivePairs.length > 0) {
      // some edge exists for the active pair but is revoked / future-dated / inactive
      return { allowed: false, reason: "AUTHORITY_EDGE_REVOKED_OR_INEFFECTIVE" };
    }
    return { allowed: false, reason: "AUTHORITY_EDGE_MISSING" };
  }

  // distinct effective edges (by id) -> more than one means ambiguous duplicate authority
  const distinct = new Map(effective.map((e) => [e.id, e]));
  if (distinct.size > 1) return { allowed: false, reason: "AMBIGUOUS_AUTHORITY" };

  const edge = effective[0];
  const rm = reviewerById.get(edge.reviewerMembershipId)!;
  return {
    allowed: true,
    actorUserId: facts.actorUserId,
    actionContractId: facts.actionContractId,
    authorityId: edge.id,
    reviewerMembershipId: edge.reviewerMembershipId,
    learnerMembershipId: edge.learnerMembershipId,
    organizationId: rm.organizationId as string,
    verificationMode,
  };
}

/**
 * THE EDGE AUTHORITY ON ITS OWN (Slice 3.2M-4).
 *
 * Everything below except the contract lookup and the verification-mode test is a general
 * question: may THIS actor act on THIS learner, by an explicit one-hop reviewer edge? Guided
 * observation needs exactly that and has no action contract, so the answer is extracted here
 * rather than duplicated — and rather than manufacturing a fake contract to call the wrapper,
 * which would put a lie in the database to satisfy a function signature.
 *
 * Identical semantics: default-deny, non-self, active-bound memberships on both sides, an
 * ACTION_REVIEWER edge that is active, unrevoked, in-window and org-consistent, and
 * fail-closed on more than one effective edge.
 */
export type EdgeAuthorityFacts = {
  actorUserId: string | null;
  /** Resolved on the SERVER from the parent record — never from client input. */
  learnerUserId: string | null;
  actorMemberships: MembershipFact[];
  learnerMemberships: MembershipFact[];
  edges: AuthorityEdgeFact[];
  today: string;
};

export type EdgeAuthorityDecision =
  | {
      allowed: true;
      actorUserId: string;
      authorityId: string;
      reviewerMembershipId: string;
      learnerMembershipId: string;
      organizationId: string;
    }
  | { allowed: false; reason: ActionReviewAuthorityDenyReason };

export function decideEdgeAuthority(facts: EdgeAuthorityFacts): EdgeAuthorityDecision {
  if (!facts.actorUserId) return { allowed: false, reason: "ACTOR_MISSING" };
  if (!facts.learnerUserId) return { allowed: false, reason: "LEARNER_MEMBERSHIP_MISSING" };
  if (facts.actorUserId === facts.learnerUserId) return { allowed: false, reason: "SELF_REVIEW_FORBIDDEN" };

  const reviewer = classifyMemberships(
    facts.actorMemberships,
    "REVIEWER_MEMBERSHIP_MISSING",
    "REVIEWER_MEMBERSHIP_INACTIVE",
    "REVIEWER_MEMBERSHIP_UNBOUND",
  );
  if (!reviewer.ok) return { allowed: false, reason: reviewer.reason };
  const learner = classifyMemberships(
    facts.learnerMemberships,
    "LEARNER_MEMBERSHIP_MISSING",
    "LEARNER_MEMBERSHIP_INACTIVE",
    "LEARNER_MEMBERSHIP_UNBOUND",
  );
  if (!learner.ok) return { allowed: false, reason: learner.reason };

  const reviewerById = new Map(reviewer.active.map((m) => [m.id, m]));
  const learnerById = new Map(learner.active.map((m) => [m.id, m]));

  const edgesForActivePairs = facts.edges.filter(
    (e) =>
      e.authorityKey === AUTHORITY_KEY &&
      reviewerById.has(e.reviewerMembershipId) &&
      learnerById.has(e.learnerMembershipId),
  );

  const orgConsistent = (e: AuthorityEdgeFact): boolean => {
    const rm = reviewerById.get(e.reviewerMembershipId);
    const lm = learnerById.get(e.learnerMembershipId);
    return (
      !!rm && !!lm && rm.organizationId != null && rm.organizationId === lm.organizationId &&
      e.organizationId === rm.organizationId
    );
  };
  const isEffective = (e: AuthorityEdgeFact): boolean =>
    e.status === "active" && e.revokedAt == null && e.startedOn <= facts.today && orgConsistent(e);

  const effective = edgesForActivePairs.filter(isEffective);
  if (effective.length === 0) {
    const activeInWindow = edgesForActivePairs.filter(
      (e) => e.status === "active" && e.revokedAt == null && e.startedOn <= facts.today,
    );
    if (activeInWindow.some((e) => !orgConsistent(e))) return { allowed: false, reason: "ORGANIZATION_MISMATCH" };
    if (edgesForActivePairs.length > 0) return { allowed: false, reason: "AUTHORITY_EDGE_REVOKED_OR_INEFFECTIVE" };
    return { allowed: false, reason: "AUTHORITY_EDGE_MISSING" };
  }

  const distinct = new Map(effective.map((e) => [e.id, e]));
  if (distinct.size > 1) return { allowed: false, reason: "AMBIGUOUS_AUTHORITY" };

  const edge = effective[0]!;
  const rm = reviewerById.get(edge.reviewerMembershipId)!;
  return {
    allowed: true,
    actorUserId: facts.actorUserId,
    authorityId: edge.id,
    reviewerMembershipId: edge.reviewerMembershipId,
    learnerMembershipId: edge.learnerMembershipId,
    organizationId: rm.organizationId as string,
  };
}
