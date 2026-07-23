/**
 * Host Leadership Attention — pure domain (Slice 3.1B-3L).
 *
 * Deterministic ONLY. AI never enters this file: which Host obligations exist, their priority, and
 * their final ordering are all decided here from canonical state + timestamps. The AI layer may not
 * add, remove, reorder, or infer urgency for any of these. No I/O, no Date.now(), no DB, no display
 * strings (the localized `reason`/`deepLink`/`trainingTitle` are composed in the service layer, exactly
 * as TodayReminder titles/links are — this file holds the value object + the priority rule).
 *
 * V1 categories (all derivable from EXISTING durable state — no migration, no acknowledgement field):
 *   FOLLOW_UP_OVERDUE  — a learner's PENDING follow-up whose BTY day has passed (foundry_participant_followups)
 *   FOLLOW_UP_NEEDED   — a shared response the Host explicitly flagged (host_review_status='FOLLOW_UP_NEEDED')
 *   SHARED_REVIEW_DUE  — a submitted shared response not yet reviewed (host_review_status NULL | 'NOT_REVIEWED')
 * Each clears through its own existing canonical transition (learner responds / Host re-reviews); there is
 * NO Host seen/handled state in V1 (see the deferred NEW_RESPONSE contract in hostAttentionService.ts).
 */

export type HostAttentionCategory = "FOLLOW_UP_OVERDUE" | "FOLLOW_UP_NEEDED" | "SHARED_REVIEW_DUE";

/** One Host attention item — a NAVIGATION SUMMARY only. Never a private body, note, or inferred score. */
export type HostAttentionItem = {
  /** Stable, source-derived id (never an array index). Category-prefixed so distinct categories over the
   *  same row never collide. Used for dedup + React keys + deterministic final ordering. */
  stableId: string;
  category: HostAttentionCategory;
  /** The OWNED event this item belongs to (authorization is enforced in the service). */
  eventId: string;
  /** The exact row to scroll/highlight in the control room: followup id (FOLLOW_UP_OVERDUE) or
   *  progress id (FOLLOW_UP_NEEDED / SHARED_REVIEW_DUE). */
  focusId: string;
  participantDisplayName: string;
  trainingTitle: string;
  /** Localized, one-line status reason (composed in the service — never in this pure file). */
  reason: string;
  /** Canonical source timestamp used for the intra-category tie-break (never null for V1 items). */
  sourceTimestamp: string;
  /** Exact control-room deep link (composed in the service). */
  deepLink: string;
};

/**
 * Deterministic priority (Commander-ratified): overdue learner follow-up first, then Host-flagged
 * follow-up-needed, then shared responses awaiting first review. Pure category rank — AI never sets it.
 */
const CATEGORY_RANK: Record<HostAttentionCategory, number> = {
  FOLLOW_UP_OVERDUE: 0,
  FOLLOW_UP_NEEDED: 1,
  SHARED_REVIEW_DUE: 2,
};

/**
 * Total deterministic order: category rank, then OLDEST sourceTimestamp first, then stableId. Never
 * tz/locale/random dependent, so the same inputs always render in the same order. AI cannot reorder.
 */
export function sortHostAttention(items: HostAttentionItem[]): HostAttentionItem[] {
  return [...items].sort((a, b) => {
    const r = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (r !== 0) return r;
    const ts = a.sourceTimestamp.localeCompare(b.sourceTimestamp); // oldest first within a category
    if (ts !== 0) return ts;
    return a.stableId.localeCompare(b.stableId);
  });
}
