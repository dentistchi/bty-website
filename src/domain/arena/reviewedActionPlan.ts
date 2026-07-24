/**
 * Reviewed Action Plan — pure domain rules (Slice 3.1B-3N-5D.1).
 *
 * A "Reviewed Action Plan" is the honest projection of an APPROVED Field Action
 * contract: an authorized reviewer reviewed and ACCEPTED the learner's submitted
 * action PLAN (who/what/how/when). Per the locked Founder decision this is evidence
 * level E3 DECIDED + authorized review — it is NOT Applied, Verified Application,
 * Observed, Sustained, or Behavior Changed. Those terms are prohibited (the copy
 * lives in the UI; this module owns only the eligibility + ordering + date rules).
 *
 * Pure functions only — no DB, no I/O, no side effects. The service layer supplies
 * already-fetched rows; this module decides eligibility, the canonical review-date,
 * and the deterministic sort order so those rules are unit-testable in isolation.
 */

export const REVIEWED_ACTION_PLAN_ACTION_TYPE = "field_action" as const;
export const REVIEWED_ACTION_PLAN_STATUS = "approved" as const;

/** The timestamp fields, in the canonical precedence used for sorting + display. */
export type ReviewedActionPlanDates = {
  reviewedAt: string | null;
  verifiedAt: string | null;
  completedAt: string | null;
  submittedAt: string | null;
  createdAt: string | null;
};

/** Minimal shape needed to decide eligibility (mirrors the DB WHERE clause, testably). */
export type ReviewedActionPlanEligibilityInput = {
  actionType: string | null;
  status: string | null;
  verifiedAt: string | null;
};

/**
 * A contract qualifies as a Reviewed Action Plan iff it is an approved Field Action
 * that carries a verification timestamp (the review-verified completion invariant).
 * This mirrors the service query exactly so a mis-scoped row can never render.
 */
export function isReviewedActionPlanEligible(row: ReviewedActionPlanEligibilityInput): boolean {
  return (
    row.actionType === REVIEWED_ACTION_PLAN_ACTION_TYPE &&
    row.status === REVIEWED_ACTION_PLAN_STATUS &&
    typeof row.verifiedAt === "string" &&
    row.verifiedAt.trim() !== ""
  );
}

/**
 * The learner-facing REVIEW DATE. Prefer `reviewed_at` (the reviewer's decision
 * time); fall back to `verified_at`, then `completed_at`. Never fabricate: when all
 * three are absent the card shows no date rather than the client's local clock.
 */
export function reviewedActionPlanReviewDate(d: ReviewedActionPlanDates): string | null {
  return firstIso([d.reviewedAt, d.verifiedAt, d.completedAt]);
}

/**
 * The SORT key — a strictly broader precedence than the display date so ordering is
 * always total and stable even on legacy rows: reviewed → verified → completed →
 * submitted → created. Never the current wall-clock time.
 */
export function reviewedActionPlanSortKey(d: ReviewedActionPlanDates): string {
  return firstIso([d.reviewedAt, d.verifiedAt, d.completedAt, d.submittedAt, d.createdAt]) ?? "";
}

/**
 * Deterministic recency comparator: newest sort-key first, tie-broken by contract id
 * ascending (stable across refresh/relaunch — no reliance on array insertion order).
 */
export function compareReviewedActionPlanRecency(
  a: { contractId: string; dates: ReviewedActionPlanDates },
  b: { contractId: string; dates: ReviewedActionPlanDates },
): number {
  const ka = reviewedActionPlanSortKey(a.dates);
  const kb = reviewedActionPlanSortKey(b.dates);
  if (ka !== kb) return ka < kb ? 1 : -1; // desc by ISO string (lexicographic == chronological)
  return a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0;
}

function firstIso(candidates: Array<string | null>): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c;
  }
  return null;
}
