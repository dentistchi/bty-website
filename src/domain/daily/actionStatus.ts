/**
 * Today Action Status — pure domain (Slice 3.1B-3M, Action Hygiene V1).
 *
 * Deterministic ONLY. AI never enters this file: which bucket a stored Action Contract status maps to,
 * the "verification pending / awaiting resolution" ordering, and the deep links are all decided here
 * from the canonical stored `status`. The AI layer may not classify, suppress, reorder, invent
 * verification, or declare completion. No I/O, no Date.now(), no DB, no display strings (localized
 * title/sourceTitle/deepLink are composed in the service layer, exactly like TodayReminder titles).
 *
 * KEY SEMANTIC FIX: classify by STORED status BEFORE deadline state. The old projection labeled every
 * open contract past its deadline as red "Overdue" — including `submitted` ones the learner already
 * acted on. That is wrong and punitive. Now:
 *   pending   → action_due          (the ONLY status that may read "Action overdue"; in DON'T MISS TODAY)
 *   rejected  → action_revision     (needs correction/resubmit; in DON'T MISS TODAY, never plain "Overdue")
 *   submitted → verification_pending (learner acted, awaiting verification; calm secondary section)
 *   escalated → awaiting_resolution  (escalated, awaiting a resolution path; secondary section)
 *   approved / missed / draft / committed / anything else → none (never emitted into Today)
 * No lifecycle WRITE is implied — this is a read-only classification of existing rows.
 */

/** The five deterministic Today buckets a stored Action Contract status maps to. */
export type ActionContractBucket =
  | "action_due" // pending → DON'T MISS TODAY, overdue/due_today/upcoming by deadline
  | "action_revision" // rejected → DON'T MISS TODAY, needs_revision
  | "verification_pending" // submitted → secondary "Verification pending" section
  | "awaiting_resolution" // escalated → secondary "Awaiting resolution" section
  | "none"; // approved / missed / draft / committed / unknown → not emitted

/**
 * Classify a stored Action Contract `status` into its Today bucket. Pure + total: an unknown status
 * (including approved/missed/draft/committed) maps to "none" so it never leaks into Today. Escalation
 * is NOT verification — it maps to its own awaiting_resolution bucket, never to completion.
 */
export function classifyActionContract(status: string | null | undefined): ActionContractBucket {
  switch (status) {
    case "pending":
      return "action_due";
    case "rejected":
      return "action_revision";
    case "submitted":
      return "verification_pending";
    case "escalated":
      return "awaiting_resolution";
    default:
      return "none";
  }
}

/** The secondary Action-status states (never red "overdue"). */
export type ActionStatusState = "verification_pending" | "awaiting_resolution";

/**
 * One Action-status item — a NAVIGATION SUMMARY of an already-submitted/escalated contract. Never a
 * private Reflection / Shared Understanding / AI output / employee score / DB-only implementation field.
 */
export type ActionStatusItem = {
  /** Stable, source-derived id (never an array index). Used for dedup + React keys + tie-break. */
  stableId: string;
  contractId: string;
  /** Canonical source discriminator (`field_action` etc.) — lets the focused Field Actions view
   *  scope "Awaiting review" to field_action contracts. Optional/additive; null when unknown. */
  actionType?: string | null;
  status: ActionStatusState;
  title: string;
  /** Raw canonical behavior family tag (owner's own data). The UI renders a label only if a settled one exists. */
  patternFamily: string;
  /** Source training/scenario title ONLY when canonically resolvable; else null (never a guess). */
  sourceTitle: string | null;
  /** The ORIGINAL commitment deadline (labeled as such). NOT a submission date (no canonical submitted_at). */
  originalDeadline: string | null;
  deepLink: string;
};

/**
 * Fixed, explicitly documented rank (settled product semantics): items still needing verification come
 * before items escalated for resolution. AI never sets this.
 */
const ACTION_STATUS_STATE_RANK: Record<ActionStatusState, number> = {
  verification_pending: 0,
  awaiting_resolution: 1,
};

/**
 * Deterministic order: state rank, then OLDEST original deadline first (nulls last), then stableId.
 * Total order — same inputs always render in the same order. AI cannot reorder or suppress.
 */
export function sortActionStatus(items: ActionStatusItem[]): ActionStatusItem[] {
  return [...items].sort((a, b) => {
    const r = ACTION_STATUS_STATE_RANK[a.status] - ACTION_STATUS_STATE_RANK[b.status];
    if (r !== 0) return r;
    // Oldest original deadline first; a null deadline sorts last (never invented). ISO strings compare
    // chronologically with plain < / > (no locale collation quirks).
    if (a.originalDeadline !== b.originalDeadline) {
      if (a.originalDeadline === null) return 1;
      if (b.originalDeadline === null) return -1;
      return a.originalDeadline < b.originalDeadline ? -1 : 1;
    }
    return a.stableId.localeCompare(b.stableId);
  });
}
