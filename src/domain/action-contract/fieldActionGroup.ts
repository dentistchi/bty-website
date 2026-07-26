/**
 * Field Action learner grouping (Practice → Field Actions canonical inventory V1).
 *
 * PURE domain mapping from a canonical stored `status` to the learner-facing lifecycle group. Uses
 * EXISTING lifecycle meaning only — it invents no Applied/Observed/Completed/Behavior-changed state
 * and never silently reclassifies. The four rendered groups mirror the canonical field_action
 * lifecycle (pending → submitted → approved/rejected, with escalated as an awaiting branch):
 *
 *   rejected  → needs_revision     ("Needs revision", editable + revision note)
 *   submitted → awaiting_review     ("Awaiting review", learner acted, awaiting the reviewer)
 *   escalated → awaiting_resolution ("Awaiting resolution", escalated, awaiting a resolution path)
 *   pending   → upcoming            ("Upcoming actions", still authoring/current)
 *   approved  → reviewed            ("Reviewed action plans", E3 decided & accepted)
 *
 * submitted and escalated are DISTINCT canonical stages (mirrors the Action Contract stage contract:
 * submitted = verification pending; escalated = awaiting resolution) and must never be conflated.
 *
 * Any status outside the field_action lifecycle maps to "other" (never rendered as a real group, and
 * never fabricated into one) — the inventory service scopes its query to the lifecycle statuses, so
 * "other" is not expected in practice; it exists so an unknown status is surfaced by count, not hidden.
 */

export type FieldActionLearnerGroup =
  | "needs_revision"
  | "awaiting_review"
  | "awaiting_resolution"
  | "upcoming"
  | "reviewed"
  | "other";

/** The canonical field_action lifecycle statuses the focused inventory surfaces. */
export const FIELD_ACTION_INVENTORY_STATUSES = [
  "pending",
  "submitted",
  "escalated",
  "rejected",
  "approved",
] as const;

export function fieldActionLearnerGroup(status: string | null | undefined): FieldActionLearnerGroup {
  switch (status) {
    case "rejected":
      return "needs_revision";
    case "submitted":
      return "awaiting_review";
    case "escalated":
      return "awaiting_resolution";
    case "pending":
      return "upcoming";
    case "approved":
      return "reviewed";
    default:
      return "other";
  }
}

/** Display order of the learner groups (most action-needed first). */
export const FIELD_ACTION_GROUP_ORDER: readonly FieldActionLearnerGroup[] = [
  "needs_revision",
  "awaiting_review",
  "awaiting_resolution",
  "upcoming",
  "reviewed",
];
